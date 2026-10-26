import { insightSchema, type Insight } from '../../shared/schema';
import type { ExtractedPdf } from '../lib/pdf';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const CLIENT_TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function analyzePdf(fileName: string, pdf: ExtractedPdf): Promise<Insight> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, ...pdf }),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') throw new ApiError('CLIENT_TIMEOUT');
    throw new ApiError('NETWORK');
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.ok ? 'INVALID_RESPONSE' : 'UNKNOWN');
  }

  if (!res.ok) {
    const code =
      typeof body === 'object' && body !== null && 'error' in body
        ? (body as { error?: { code?: unknown } }).error?.code
        : undefined;
    throw new ApiError(typeof code === 'string' ? code : 'UNKNOWN');
  }

  // F-04: the result is validated again in the browser before it is rendered.
  const parsed = insightSchema.safeParse(body);
  if (!parsed.success) throw new ApiError('INVALID_RESPONSE');
  return parsed.data;
}
