import { describeIssues, insightSchema, type Insight } from '../../shared/schema';
import { normalizeInsight } from '../../shared/normalize';
import { chunkPages, type Chunk } from './chunk';
import { detectInjection } from './injection';
import { complete, parseModelJson, type ChatTurn, type Env } from './llm';
import { mergePartials, type PartialResult } from './merge';
import {
  MERGE_SYSTEM_PROMPT,
  PARTIAL_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  retryMessage,
  wrapDocument,
} from './prompt';
import type { AnalyzeRequest, PageImage } from './request';

export class InvalidAiResponseError extends Error {
  constructor(readonly issues: string[]) {
    super('AI response failed validation');
  }
}

const PARALLEL = 3;

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

function imagesFor(chunk: Chunk, images: PageImage[]): PageImage[] {
  return images.filter((img) => chunk.pages.includes(img.page));
}

/**
 * Calls the model, normalises, validates; on validation failure asks ONCE more
 * with the list of problems (brief: "1 ponowna próba, potem komunikat błędu").
 */
async function callValidated<T>(
  env: Env,
  models: Set<string>,
  system: string,
  turn: ChatTurn,
  finish: (raw: unknown) => { ok: true; value: T } | { ok: false; issues: string[] },
): Promise<T> {
  const turns: ChatTurn[] = [turn];
  let issues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, model } = await complete(env, system, turns);
    models.add(model);
    const result = finish(parseModelJson(text));
    if (result.ok) return result.value;
    issues = result.issues;
    turns.push({ role: 'assistant', text }, { role: 'user', text: retryMessage(issues) });
  }
  throw new InvalidAiResponseError(issues);
}

function validateFull(raw: unknown, req: AnalyzeRequest) {
  const normalized = normalizeInsight(raw, { fileName: req.fileName, pages: req.pages });
  const parsed = insightSchema.safeParse(normalized);
  return parsed.success
    ? ({ ok: true, value: parsed.data } as const)
    : ({ ok: false, issues: describeIssues(parsed.error) } as const);
}

export async function analyzeDocument(env: Env, req: AnalyzeRequest): Promise<Insight> {
  const scanned = new Set(req.images.map((i) => i.page));
  const { chunks, truncated } = chunkPages(req.pageTexts, scanned);
  const warnings: string[] = [];
  const models = new Set<string>();

  const injectionPages = detectInjection(req.pageTexts);
  if (injectionPages.length > 0) {
    warnings.push(
      `Strona ${injectionPages.join(', ')}: wykryto tekst wyglądający na polecenie dla AI. ` +
        'Potraktowano go jako treść dokumentu, nie jako instrukcję.',
    );
  }
  if (truncated)
    warnings.push('Dokument jest bardzo długi — przeanalizowano tylko jego początkową część.');

  let insight: Insight;
  if (chunks.length <= 1) {
    const chunk = chunks[0] ?? { index: 0, pages: [], text: '' };
    insight = await callValidated(
      env,
      models,
      SYSTEM_PROMPT,
      { role: 'user', text: wrapDocument(chunk.text, req), images: req.images },
      (raw) => validateFull(raw, req),
    );
  } else {
    // F-08: analyse each part, merge lists deterministically, synthesise summary with one more call.
    const partials = await mapLimited(chunks, PARALLEL, async (chunk) => {
      const { text, model } = await complete(env, PARTIAL_SYSTEM_PROMPT, [
        {
          role: 'user',
          text: wrapDocument(chunk.text, {
            ...req,
            part: `${chunk.index + 1}/${chunks.length} (strony ${chunk.pages[0]}–${chunk.pages.at(-1)})`,
          }),
          images: imagesFor(chunk, req.images),
        },
      ]);
      models.add(model);
      return normalizeInsight(parseModelJson(text), req) as unknown as PartialResult;
    });
    const merged = mergePartials(partials);
    const mergeInput = JSON.stringify({
      document: merged.document,
      partialSummaries: partials.map((p) => p.summary),
      keyPoints: merged.keyPoints,
    });
    insight = await callValidated(
      env,
      models,
      MERGE_SYSTEM_PROMPT,
      { role: 'user', text: mergeInput },
      (raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        return validateFull(
          {
            ...merged,
            document: { ...merged.document, ...((r.document as object | undefined) ?? {}) },
            summary: r.summary,
            keyPoints: r.keyPoints,
          },
          req,
        );
      },
    );
  }

  return {
    ...insight,
    meta: {
      model: [...models].join(', '),
      chunks: Math.max(chunks.length, 1),
      ocrPages: [...scanned].sort((a, b) => a - b),
      warnings,
      generatedAt: new Date().toISOString(),
    },
  };
}
