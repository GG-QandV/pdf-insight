import type { PageImage } from './request';

export interface Env {
  LLM_PROVIDER?: string; // "gemini" (default) | "openai"
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  // Workers Rate Limiting binding (typed structurally so shared code needs no Workers types).
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  images?: PageImage[];
}

export class LlmError extends Error {
  constructor(
    readonly code: 'AI_BUSY' | 'AI_TIMEOUT' | 'AI_UPSTREAM' | 'AI_CONFIG',
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 25_000;

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new LlmError('AI_TIMEOUT', 'LLM request timed out');
    }
    throw new LlmError('AI_UPSTREAM', 'LLM request failed');
  }
  if (res.status === 429 || res.status === 503)
    throw new LlmError('AI_BUSY', `LLM busy (${res.status})`);
  if (!res.ok) throw new LlmError('AI_UPSTREAM', `LLM error ${res.status}`);
  return res.json();
}

async function geminiComplete(env: Env, system: string, turns: ChatTurn[]): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new LlmError('AI_CONFIG', 'GEMINI_API_KEY missing');
  const model = env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const data = (await postJson(
    url,
    { 'x-goog-api-key': env.GEMINI_API_KEY },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [
          { text: t.text },
          ...(t.images ?? []).map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data },
          })),
        ],
      })),
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (text === '') throw new LlmError('AI_UPSTREAM', 'Empty LLM response');
  return text;
}

async function openAiComplete(env: Env, system: string, turns: ChatTurn[]): Promise<string> {
  if (!env.OPENAI_API_KEY || !env.OPENAI_BASE_URL || !env.OPENAI_MODEL) {
    throw new LlmError('AI_CONFIG', 'OPENAI_* settings missing');
  }
  const data = (await postJson(
    `${env.OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`,
    { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    {
      model: env.OPENAI_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        ...turns.map((t) => ({
          role: t.role,
          content:
            t.images && t.images.length > 0
              ? [
                  { type: 'text', text: t.text },
                  ...t.images.map((img) => ({
                    type: 'image_url',
                    image_url: { url: `data:${img.mimeType};base64,${img.data}` },
                  })),
                ]
              : t.text,
        })),
      ],
    },
  )) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '';
  if (text === '') throw new LlmError('AI_UPSTREAM', 'Empty LLM response');
  return text;
}

export function modelName(env: Env): string {
  return env.LLM_PROVIDER === 'openai'
    ? (env.OPENAI_MODEL ?? 'unknown')
    : (env.GEMINI_MODEL ?? 'gemini-2.5-flash');
}

export function complete(env: Env, system: string, turns: ChatTurn[]): Promise<string> {
  return env.LLM_PROVIDER === 'openai'
    ? openAiComplete(env, system, turns)
    : geminiComplete(env, system, turns);
}

/** Parses the model's JSON, tolerating a ```json fence around it. */
export function parseModelJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
