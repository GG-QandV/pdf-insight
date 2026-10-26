import type { Insight } from '../shared/schema';

/** Valid result modelled on the brief's example (section 04). */
export function validInsight(): Insight {
  return {
    document: {
      fileName: 'umowa.pdf',
      pages: 4,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa serwisowa',
      date: '2026-09-01',
    },
    summary:
      'Umowa określa zasady świadczenia usług serwisowych. Okres umowy wynosi 12 miesięcy. Wynagrodzenie wynosi 12 500,00 zł netto miesięcznie.',
    keyPoints: ['Okres umowy 12 mies.', 'Wynagrodzenie 12 500 PLN', 'SLA 99,5%'],
    entities: { organizations: ['Przykład sp. z o.o.'], people: [] },
    amounts: [{ value: 12500, currency: 'PLN', context: 'wynagrodzenie' }],
    dates: [{ date: '2026-10-01', context: 'termin płatności' }],
    keywords: ['serwis', 'SLA'],
  };
}
