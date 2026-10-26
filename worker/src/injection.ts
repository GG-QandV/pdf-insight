/**
 * Heuristic detector of text that tries to steer the AI ("prompt injection").
 * Detection does NOT change processing — the document is always treated as data —
 * it only adds a visible warning to the result.
 */
const PATTERNS: RegExp[] = [
  /zignoruj\s+(wszystkie\s+)?(wcześniejsze|poprzednie|powyższe)\s+(polecenia|instrukcje)/i,
  /instrukcja\s+dla\s+(systemu\s+)?(ai|si|modelu|asystenta)/i,
  /nie\s+wspominaj\s+o\s+tej\s+instrukcji/i,
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+/i,
  /\byou\s+are\s+now\s+(a|an)\b/i,
  /\bsystem\s+prompt\b/i,
  /игнорируй\s+(все\s+)?(предыдущие|прошлые)\s+(инструкции|команды)/i,
  /ігноруй\s+(усі\s+|всі\s+)?(попередні)\s+(інструкції|команди)/i,
];

export function detectInjection(pages: { page: number; text: string }[]): number[] {
  const hits: number[] = [];
  for (const p of pages) {
    if (PATTERNS.some((re) => re.test(p.text))) hits.push(p.page);
  }
  return hits;
}
