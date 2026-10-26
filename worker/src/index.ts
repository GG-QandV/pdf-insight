import type { z } from 'zod';
import { analyzeDocument, LEAK_ISSUE } from './analyze';
import { LlmError, type Env } from './llm';
import { prepareDocument } from './prepare';
import { analyzeRequestSchema, LIMITS, prepareRequestSchema, totalChars } from './request';
import { InvalidAiResponseError } from './validated';

/** Error codes are mapped to Polish messages in the SPA (src/lib/messages.ts). */
type ErrorCode =
  | 'BAD_REQUEST'
  | 'FORBIDDEN_ORIGIN'
  | 'TOO_LARGE'
  | 'RATE_LIMITED'
  | 'AI_BUSY'
  | 'AI_TIMEOUT'
  | 'AI_INVALID'
  | 'AI_INJECTED'
  | 'AI_UPSTREAM'
  | 'AI_CONFIG'
  | 'NOT_FOUND';

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...cors,
    },
  });
}

function fail(
  code: ErrorCode,
  status: number,
  cors: Record<string, string>,
  details?: string[],
): Response {
  return json({ error: { code, ...(details ? { details } : {}) } }, status, cors);
}

// Fallback limiter when the Rate Limiting binding is not configured (per isolate, best effort).
const memoryHits = new Map<string, number[]>();
function memoryLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = (memoryHits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  memoryHits.set(key, hits);
  return hits.length <= limit;
}

async function withinRateLimit(request: Request, env: Env): Promise<boolean> {
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key });
    return success;
  }
  return memoryLimit(key);
}

/** Shared pipeline for both steps: size + rate limits, JSON + schema, error mapping. */
async function handle<S extends z.ZodTypeAny>(
  request: Request,
  env: Env,
  cors: Record<string, string>,
  schema: S,
  run: (data: z.output<S>) => Promise<unknown>,
): Promise<Response> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > LIMITS.maxBodyBytes) return fail('TOO_LARGE', 413, cors);
  if (!(await withinRateLimit(request, env))) return fail('RATE_LIMITED', 429, cors);

  const raw = await request.text();
  if (raw.length > LIMITS.maxBodyBytes) return fail('TOO_LARGE', 413, cors);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail('BAD_REQUEST', 400, cors);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', 400, cors);
  const data = parsed.data as z.output<S>;
  if (totalChars((data as { pageTexts: { text: string }[] }).pageTexts) > LIMITS.maxTextChars)
    return fail('TOO_LARGE', 413, cors);

  try {
    return json(await run(data), 200, cors);
  } catch (err) {
    if (err instanceof InvalidAiResponseError) {
      const leak = err.issues.length > 0 && err.issues.every((i) => i.startsWith(LEAK_ISSUE));
      return fail(leak ? 'AI_INJECTED' : 'AI_INVALID', 502, cors, err.issues);
    }
    if (err instanceof LlmError) {
      const status = err.code === 'AI_BUSY' ? 503 : err.code === 'AI_TIMEOUT' ? 504 : 502;
      return fail(err.code, status, cors);
    }
    return fail('AI_UPSTREAM', 502, cors);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/api/health' && request.method === 'GET')
      return json({ ok: true }, 200, cors);

    const step =
      url.pathname === '/api/prepare'
        ? 'prepare'
        : url.pathname === '/api/analyze'
          ? 'analyze'
          : null;
    if (step && request.method === 'POST') {
      // Browsers always send Origin on cross-origin POST; reject anything not on the allow-list.
      if (!origin || !allowedOrigins(env).includes(origin))
        return fail('FORBIDDEN_ORIGIN', 403, cors);
      return step === 'prepare'
        ? handle(request, env, cors, prepareRequestSchema, (d) => prepareDocument(env, d))
        : handle(request, env, cors, analyzeRequestSchema, (d) => analyzeDocument(env, d));
    }
    return fail('NOT_FOUND', 404, cors);
  },
} satisfies ExportedHandler<Env>;
