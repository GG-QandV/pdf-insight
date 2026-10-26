import { z } from 'zod';
import { countSentences } from './sentences';

/**
 * Result schema from the brief (section 04). Fields may be added, never removed.
 * Shared by the Worker (validates the LLM output) and the SPA (validates before rendering).
 */

export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data musi mieć format ISO 8601 (RRRR-MM-DD)')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined) return false;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Nieistniejąca data');

const nonEmpty = z.string().trim().min(1);

export const documentSchema = z.object({
  fileName: nonEmpty,
  pages: z.number().int().min(1),
  language: z.string().regex(/^[a-z]{2}$/, 'Kod języka ISO 639-1'),
  type: z.enum(DOCUMENT_TYPES),
  title: nonEmpty.nullable(),
  date: isoDate.nullable(),
});

export const amountSchema = z.object({
  value: z.number().finite(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Kod waluty ISO 4217'),
  context: nonEmpty,
});

export const dateEntrySchema = z.object({
  date: isoDate,
  context: nonEmpty,
});

/** Extra, optional block — allowed by the brief ("pola można dodawać"). */
export const metaSchema = z.object({
  model: z.string(),
  chunks: z.number().int().min(1),
  ocrPages: z.array(z.number().int().min(1)),
  warnings: z.array(z.string()),
  generatedAt: z.string(),
});

export const insightSchema = z.object({
  document: documentSchema,
  summary: nonEmpty.refine((text) => {
    const n = countSentences(text);
    return n >= 3 && n <= 5;
  }, 'Podsumowanie musi mieć 3–5 zdań'),
  keyPoints: z.array(nonEmpty).min(3).max(7),
  entities: z.object({
    organizations: z.array(nonEmpty),
    people: z.array(nonEmpty),
  }),
  amounts: z.array(amountSchema),
  dates: z.array(dateEntrySchema),
  keywords: z.array(nonEmpty),
  meta: metaSchema.optional(),
});

export type Insight = z.infer<typeof insightSchema>;
export type InsightDocument = z.infer<typeof documentSchema>;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Human-readable list of validation problems (used for the single retry prompt). */
export function describeIssues(error: z.ZodError): string[] {
  return error.issues
    .slice(0, 10)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}
