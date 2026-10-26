import { z } from 'zod';

export const LIMITS = {
  maxBodyBytes: 12 * 1024 * 1024,
  maxTextChars: 400_000,
  maxImages: 5,
  maxImageBase64Chars: 2_000_000,
  maxPages: 2000,
} as const;

export const analyzeRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  pages: z.number().int().min(1).max(LIMITS.maxPages),
  pageTexts: z
    .array(z.object({ page: z.number().int().min(1), text: z.string() }))
    .min(1)
    .max(LIMITS.maxPages),
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

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type PageImage = AnalyzeRequest['images'][number];
