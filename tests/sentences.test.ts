import { describe, expect, it } from 'vitest';
import { countSentences } from '../shared/sentences';

describe('countSentences', () => {
  it('counts simple sentences', () => {
    expect(countSentences('Pierwsze zdanie. Drugie zdanie! Trzecie?')).toBe(3);
  });

  it('does not split on abbreviations, initials and numbers', () => {
    const text =
      'Siedziba mieści się przy ul. Portowa 18 w Gdańsku. Umowę podpisał A. Kowalczyk dnia 12.03.2026 r. w Gdańsku. Wartość to 184 500,00 zł, tj. 226 935,00 zł brutto.';
    expect(countSentences(text)).toBe(3);
  });

  it('handles empty text', () => {
    expect(countSentences('   ')).toBe(0);
  });
});
