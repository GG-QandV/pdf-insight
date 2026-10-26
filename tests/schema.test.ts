import { describe, expect, it } from 'vitest';
import { describeIssues, insightSchema } from '../shared/schema';
import { validInsight } from './fixtures';

describe('insightSchema', () => {
  it('accepts the example from the brief', () => {
    expect(insightSchema.safeParse(validInsight()).success).toBe(true);
  });

  it('allows extra fields such as meta', () => {
    const withMeta = {
      ...validInsight(),
      meta: {
        model: 'm',
        chunks: 1,
        ocrPages: [11],
        warnings: [],
        generatedAt: '2026-10-26T10:00:00Z',
      },
    };
    expect(insightSchema.safeParse(withMeta).success).toBe(true);
  });

  it('accepts null title/date and empty lists when information is missing', () => {
    const data = validInsight();
    data.document.title = null;
    data.document.date = null;
    data.amounts = [];
    data.dates = [];
    data.entities = { organizations: [], people: [] };
    data.keywords = [];
    expect(insightSchema.safeParse(data).success).toBe(true);
  });

  it.each([
    [
      'unknown document type',
      (d: ReturnType<typeof validInsight>) => ({ ...d, document: { ...d.document, type: 'list' } }),
    ],
    [
      'language not ISO 639-1',
      (d: ReturnType<typeof validInsight>) => ({
        ...d,
        document: { ...d.document, language: 'pol' },
      }),
    ],
    [
      'date not ISO 8601',
      (d: ReturnType<typeof validInsight>) => ({
        ...d,
        document: { ...d.document, date: '01.09.2026' },
      }),
    ],
    [
      'impossible date',
      (d: ReturnType<typeof validInsight>) => ({
        ...d,
        dates: [{ date: '2026-02-30', context: 'x' }],
      }),
    ],
    [
      'currency not ISO 4217',
      (d: ReturnType<typeof validInsight>) => ({
        ...d,
        amounts: [{ value: 1, currency: 'zł', context: 'x' }],
      }),
    ],
    [
      'amount as string',
      (d: ReturnType<typeof validInsight>) => ({
        ...d,
        amounts: [{ value: '12 500', currency: 'PLN', context: 'x' }],
      }),
    ],
    [
      'too few key points',
      (d: ReturnType<typeof validInsight>) => ({ ...d, keyPoints: ['a', 'b'] }),
    ],
    [
      'too many key points',
      (d: ReturnType<typeof validInsight>) => ({
        ...d,
        keyPoints: ['1', '2', '3', '4', '5', '6', '7', '8'],
      }),
    ],
    [
      'summary with 2 sentences',
      (d: ReturnType<typeof validInsight>) => ({ ...d, summary: 'Jedno zdanie. Drugie zdanie.' }),
    ],
    [
      'summary with 6 sentences',
      (d: ReturnType<typeof validInsight>) => ({ ...d, summary: 'A a. B b. C c. D d. E e. F f.' }),
    ],
    [
      'missing required field',
      (d: ReturnType<typeof validInsight>) => ({ ...d, keywords: undefined }),
    ],
  ])('rejects %s', (_name, mutate) => {
    expect(insightSchema.safeParse(mutate(validInsight())).success).toBe(false);
  });

  it('describes issues with field paths for the retry prompt', () => {
    const result = insightSchema.safeParse({ ...validInsight(), keyPoints: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(describeIssues(result.error)[0]).toMatch(/^keyPoints:/);
  });
});
