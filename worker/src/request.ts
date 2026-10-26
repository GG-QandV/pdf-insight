import { z } from 'zod';

export const LIMITS = {
  maxBodyBytes: 12 * 1024 * 1024,
  maxTextChars: 400_000,
  maxImages: 5,
  maxImageBase64Chars: 2_000_000,
  maxPages: 2000,
} as const;

const base = {
  fileName: z.string().trim().min(1).max(255),
  pages: z.number().int().min(1).max(LIMITS.maxPages),
};

const pageTexts = <T extends z.ZodTypeAny>(item: T) => z.array(item).min(1).max(LIMITS.maxPages);

/** Step 1 (/api/prepare): text layer + images of scanned pages. */
export const prepareRequestSchema = z.object({
  ...base,
  pageTexts: pageTexts(z.object({ page: z.number().int().min(1), text: z.string() })),
  images: z
    .array(
      z.object({
        page: z.number().int().min(1),
        mimeType: z.enum(['image/jpeg', 'image/png']),
        data: z
          .string()
          .max(LIMITS.maxImageBase64Chars)
          .regex(/^[A-Za-z0-9+/=]+$/, 'base64'),
      }),
    )
    .max(LIMITS.maxImages)
    .default([]),
});

/** Step 2 (/api/analyze): full text (incl. OCR) + the user's decision on suspicious fragments. */
export const analyzeRequestSchema = z.object({
  ...base,
  pageTexts: pageTexts(
    z.object({
      page: z.number().int().min(1),
      text: z.string(),
      source: z.enum(['text', 'ocr']).default('text'),
    }),
  ),
  ocrPages: z.array(z.number().int().min(1)).max(LIMITS.maxImages).default([]),
  injectionDecision: z.enum(['exclude', 'include']).default('exclude'),
});

export type PrepareRequest = z.infer<typeof prepareRequestSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type PageImage = PrepareRequest['images'][number];

export function totalChars(texts: { text: string }[]): number {
  return texts.reduce((n, p) => n + p.text.length, 0);
}
