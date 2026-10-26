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

export function countSentences(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized === '') return 0;

  let count = 0;
  let start = 0;
  const terminator = /[.!?…]+(?=\s+[\p{Lu}\d„"(]|\s*$)/gu;
  let match: RegExpExecArray | null;
  while ((match = terminator.exec(normalized)) !== null) {
    const end = match.index;
    const before = normalized.slice(start, end);
    const lastToken = (before.split(' ').pop() ?? '').toLowerCase();
    const isAbbreviation =
      match[0] === '.' && (ABBREVIATIONS.has(lastToken) || /^\p{L}$/u.test(lastToken));
    const atEnd = match.index + match[0].length >= normalized.length;
    if (!isAbbreviation || atEnd) {
      count += 1;
      start = match.index + match[0].length;
    }
  }
  if (normalized.slice(start).trim() !== '') count += 1;
  return count;
}
