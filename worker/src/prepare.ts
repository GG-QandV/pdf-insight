import { z } from 'zod';
import { findInjections, type SourcedPage } from './injection';
import type { Env } from './llm';
import { OCR_SYSTEM_PROMPT } from './prompt';
import type { PrepareRequest } from './request';
import { callValidated } from './validated';

const ocrSchema = z.object({
  pages: z.array(z.object({ page: z.number().int().min(1), text: z.string() })),
});

export interface Prepared {
  pageTexts: Required<SourcedPage>[];
  ocrPages: number[];
  findings: { page: number; source: 'text' | 'ocr'; excerpt: string }[];
  models: string[];
}

/**
 * Step 1: scanned pages are transcribed in a SEPARATE call (no analysis, no instructions
 * followed), so the injection detector can check the OCR text too — not only the text layer.
 */
export async function prepareDocument(env: Env, req: PrepareRequest): Promise<Prepared> {
  const models = new Set<string>();
  const ocrPages = req.images.map((i) => i.page);
  const ocrText = new Map<number, string>();

  if (req.images.length > 0) {
    const result = await callValidated(
      env,
      models,
      OCR_SYSTEM_PROMPT,
      {
        role: 'user',
        text: `Images in order are pages: ${ocrPages.join(', ')}. Return their transcription as JSON.`,
        images: req.images,
      },
      (raw) => {
        const parsed = ocrSchema.safeParse(raw);
        return parsed.success
          ? { ok: true, value: parsed.data }
          : { ok: false, issues: ['Expected {"pages":[{"page":number,"text":string}]}'] };
      },
    );
    for (const p of result.pages) if (ocrPages.includes(p.page)) ocrText.set(p.page, p.text.trim());
  }

  const pageTexts = req.pageTexts.map((p) => {
    const ocr = ocrText.get(p.page);
    return ocr !== undefined && p.text.trim().length < 25
      ? { page: p.page, text: ocr, source: 'ocr' as const }
      : { page: p.page, text: p.text, source: 'text' as const };
  });

  const findings = findInjections(pageTexts).map(({ page, source, excerpt }) => ({
    page,
    source,
    excerpt,
  }));
  return { pageTexts, ocrPages, findings, models: [...models] };
}
