import { describe, expect, it } from 'vitest';
import {
  normalizeCurrency,
  normalizeDate,
  normalizeInsight,
  parseAmount,
} from '../shared/normalize';
import { insightSchema } from '../shared/schema';

describe('parseAmount', () => {
  it.each([
    ['184 500,00', 184500],
    ['184.500,00', 184500],
    ['184,500.00', 184500],
    ['12 300,00 PLN', 12300],
    ['8 600', 8600],
    ['2,5', 2.5],
    [12500, 12500],
  ])('%s → %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('returns null for non-numbers', () => {
    expect(parseAmount('brak')).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe('normalizeCurrency', () => {
  it.each([
    ['zł', 'PLN'],
    ['PLN', 'PLN'],
    ['€', 'EUR'],
    ['usd', 'USD'],
    ['$', 'USD'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCurrency(input)).toBe(expected);
  });

  it('rejects unknown symbols', () => {
    expect(normalizeCurrency('złotówki')).toBeNull();
  });
});

describe('normalizeDate', () => {
  it('converts European formats to ISO 8601', () => {
    expect(normalizeDate('12.03.2026')).toBe('2026-03-12');
    expect(normalizeDate('1/4/2026')).toBe('2026-04-01');
    expect(normalizeDate('2026-03-12T00:00:00Z')).toBe('2026-03-12');
    expect(normalizeDate('marzec 2026')).toBeNull();
  });
});

describe('normalizeInsight', () => {
  it('fixes common model slips so the result passes the schema', () => {
    const raw = {
      document: {
        language: 'PL',
        type: 'Umowa',
        title: 'Umowa ramowa',
        date: '12.03.2026',
        fileName: 'ignored.pdf',
      },
      summary:
        'Umowa dotyczy wdrożenia CRM. Wynagrodzenie wynosi 184 500,00 zł netto. Umowa obowiązuje 24 miesiące.',
      keyPoints: ['Wdrożenie CRM', 'Wdrożenie CRM', '120 użytkowników', 'SLA 99,5%'],
      entities: {
        organizations: ['Nordwave Logistics sp. z o.o.'],
        people: ['Anna Kowalczyk', ''],
      },
      amounts: [
        { value: '184 500,00', currency: 'zł', context: 'wynagrodzenie' },
        { value: 'n/a', currency: 'PLN', context: 'bez kwoty' },
      ],
      dates: [{ date: '01.04.2026', context: 'początek' }],
      keywords: ['CRM'],
    };
    const out = normalizeInsight(raw, { fileName: 'umowa.pdf', pages: 12 });
    const parsed = insightSchema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.document).toMatchObject({
      fileName: 'umowa.pdf',
      pages: 12,
      language: 'pl',
      type: 'umowa',
      date: '2026-03-12',
    });
    expect(parsed.data.keyPoints).toHaveLength(3);
    expect(parsed.data.amounts).toEqual([
      { value: 184500, currency: 'PLN', context: 'wynagrodzenie' },
    ]);
    expect(parsed.data.entities.people).toEqual(['Anna Kowalczyk']);
  });

  it('maps unknown document types to "inne" and garbage to empty structures', () => {
    const out = normalizeInsight('not json', { fileName: 'x.pdf', pages: 1 }) as {
      document: { type: string };
      amounts: unknown[];
    };
    expect(out.document.type).toBe('inne');
    expect(out.amounts).toEqual([]);
  });
});

describe('list caps', () => {
  it('bounds amounts and dates when the model returns too many', () => {
    const raw = {
      amounts: Array.from({ length: 44 }, (_, i) => ({
        value: i + 1,
        currency: 'PLN',
        context: `k${i}`,
      })),
      dates: Array.from({ length: 27 }, (_, i) => ({
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        context: `d${i}`,
      })),
    };
    const out = normalizeInsight(raw, { fileName: 'a.pdf', pages: 1 }) as {
      amounts: unknown[];
      dates: unknown[];
    };
    expect(out.amounts).toHaveLength(15);
    expect(out.dates).toHaveLength(15);
  });
});
