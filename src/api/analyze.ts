import { z } from 'zod';
import { injectionFindingSchema, insightSchema, type Insight } from '../../shared/schema';
import type { ExtractedPdf } from '../lib/pdf';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const CLIENT_TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function post(path: string, payload: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  return body;
}

const preparedSchema = z.object({
  pageTexts: z.array(
    z.object({ page: z.number().int(), text: z.string(), source: z.enum(['text', 'ocr']) }),
  ),
  ocrPages: z.array(z.number().int()),
  findings: z.array(injectionFindingSchema),
});

export type Prepared = z.infer<typeof preparedSchema>;
export type InjectionDecision = 'exclude' | 'include';

/** Step 1: OCR of scanned pages + prompt-injection check of the whole text. */
export async function prepareDocument(fileName: string, pdf: ExtractedPdf): Promise<Prepared> {
  const parsed = preparedSchema.safeParse(await post('/api/prepare', { fileName, ...pdf }));
  if (!parsed.success) throw new ApiError('INVALID_RESPONSE');
  return parsed.data;
}

/** Step 2: analysis with the user's decision about suspicious fragments. */
export async function analyzeDocument(
  fileName: string,
  pages: number,
  prepared: Prepared,
  injectionDecision: InjectionDecision,
): Promise<Insight> {
  const body = await post('/api/analyze', {
    fileName,
    pages,
    pageTexts: prepared.pageTexts,
    ocrPages: prepared.ocrPages,
    injectionDecision,
  });
  // F-04: the result is validated again in the browser before it is rendered.
  const parsed = insightSchema.safeParse(body);
  if (!parsed.success) throw new ApiError('INVALID_RESPONSE');
  return parsed.data;
}
