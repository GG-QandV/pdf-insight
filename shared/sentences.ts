/**
 * Sentence counter tolerant to common abbreviations (Polish + English),
 * so that "ul. Portowa", "np. SLA" or "A. Kowalczyk" do not split a sentence.
 */

// Only abbreviations that are usually followed by a capitalised word (names, streets, numbers).
// Tokens like "r.", "zł." or "S.A." often end a sentence, so they are NOT listed here.
const ABBREVIATIONS = new Set([
  'ul',
  'al',
  'pl',
  'os',
  'nr',
  'dr',
  'inż',
  'mgr',
  'prof',
  'hab',
  'św',
  'tel',
  'np',
  'm.in',
  'tj',
  'tzw',
  'wg',
  'ok',
  'art',
  'ust',
  'pkt',
  'zał',
  'poz',
  'str',
  'mr',
  'mrs',
  'ms',
  'e.g',
  'i.e',
]);

/** Splits text into sentences using the same rules as the validator. */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized === '') return [];

  const out: string[] = [];
  let start = 0;
  const terminator = /[.!?…]+(?=\s+[\p{Lu}\d„"(]|\s*$)/gu;
  let match: RegExpExecArray | null;
  while ((match = terminator.exec(normalized)) !== null) {
    const before = normalized.slice(start, match.index);
    const lastToken = (before.split(' ').pop() ?? '').toLowerCase();
    const isAbbreviation =
      match[0] === '.' && (ABBREVIATIONS.has(lastToken) || /^\p{L}$/u.test(lastToken));
    const atEnd = match.index + match[0].length >= normalized.length;
    if (!isAbbreviation || atEnd) {
      out.push(normalized.slice(start, match.index + match[0].length).trim());
      start = match.index + match[0].length;
    }
  }
  const rest = normalized.slice(start).trim();
  if (rest !== '') out.push(rest);
  return out;
}

export function countSentences(text: string): number {
  return splitSentences(text).length;
}
