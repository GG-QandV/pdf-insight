/**
 * Prompt-injection handling (text that tries to steer the AI).
 *
 * 1. findInjections   — heuristic detector over the text layer AND the OCR text of scans;
 * 2. applyDecision    — the user's choice: cut the fragment out, or keep it marked as data;
 * 3. leaksInto        — after the analysis: does the result repeat the fragment's content?
 */
const PATTERNS: RegExp[] = [
  /zignoruj\s+(wszystkie\s+)?(wcześniejsze|poprzednie|powyższe)\s+(polecenia|instrukcje)/gi,
  /instrukcja\s+dla\s+(systemu\s+)?(ai|si|modelu|asystenta)/gi,
  /nie\s+wspominaj\s+o\s+tej\s+instrukcji/gi,
  /w\s+podsumowaniu\s+napisz/gi,
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts)/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+/gi,
  /in\s+(the|your)\s+summary,?\s+(write|say|state)\b/gi,
  /\byou\s+are\s+now\s+(a|an)\b/gi,
  /\bsystem\s+prompt\b/gi,
  /игнорируй\s+(все\s+)?(предыдущие|прошлые)\s+(инструкции|команды)/gi,
  /ігноруй\s+(усі\s+|всі\s+)?(попередні)\s+(інструкції|команди)/gi,
];

const MERGE_GAP = 200;
const MAX_EXCERPT = 600;

export type TextSource = 'text' | 'ocr';

export interface SourcedPage {
  page: number;
  text: string;
  source?: TextSource;
}

export interface Finding {
  page: number;
  source: TextSource;
  start: number;
  end: number;
  excerpt: string;
}

function sentenceStart(text: string, from: number): number {
  const lineStart = text.lastIndexOf('\n', from - 1) + 1;
  const dot = text.lastIndexOf('. ', from - 1);
  return Math.max(lineStart, dot === -1 ? 0 : dot + 2);
}

function sentenceEnd(text: string, from: number): number {
  const m = /[.!?](\s|$)/.exec(text.slice(from));
  return m ? from + m.index + 1 : text.length;
}

/** Finds suspicious fragments, expanded to whole sentences and merged when close together. */
export function findInjections(pages: SourcedPage[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of pages) {
    const ranges: [number, number][] = [];
    for (const re of PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p.text)) !== null) ranges.push([m.index, m.index + m[0].length]);
    }
    if (ranges.length === 0) continue;
    ranges.sort((a, b) => a[0] - b[0]);

    const merged: [number, number][] = [];
    for (const r of ranges) {
      const last = merged.at(-1);
      if (last && r[0] - last[1] <= MERGE_GAP) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }
    for (const [s, e] of merged) {
      const start = sentenceStart(p.text, s);
      const end = Math.min(sentenceEnd(p.text, e), start + MAX_EXCERPT);
      findings.push({
        page: p.page,
        source: p.source ?? 'text',
        start,
        end,
        excerpt: p.text.slice(start, end).replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return findings;
}

export type InjectionDecision = 'exclude' | 'include';

export const EXCLUDED_MARKER = '[USUNIĘTO: fragment wyglądający na polecenie dla AI]';

/**
 * exclude — the fragment is replaced by a marker and never reaches the model;
 * include — it stays, wrapped in <suspicious> so the model treats it as quoted data.
 */
export function applyDecision(
  pages: SourcedPage[],
  findings: Finding[],
  decision: InjectionDecision,
): SourcedPage[] {
  return pages.map((p) => {
    const own = findings.filter((f) => f.page === p.page).sort((a, b) => b.start - a.start);
    let text = p.text;
    for (const f of own) {
      const fragment = text.slice(f.start, f.end);
      const replacement =
        decision === 'exclude'
          ? EXCLUDED_MARKER
          : `<suspicious>${fragment.replace(/<\/?\s*suspicious\s*>/gi, '[tag]')}</suspicious>`;
      text = text.slice(0, f.start) + replacement + text.slice(f.end);
    }
    return { ...p, text };
  });
}

function tokens(text: string): string[] {
  return text.toLocaleLowerCase('pl').match(/[\p{L}\p{N}]+/gu) ?? [];
}

function grams(words: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
}

const NGRAM = 5;

/**
 * True when the output repeats a 5-word sequence that exists only in the suspicious
 * fragments (sequences that also occur elsewhere in the document are legitimate facts).
 */
export function leaksInto(pages: SourcedPage[], findings: Finding[], output: string): boolean {
  if (findings.length === 0) return false;
  const rest = applyDecision(pages, findings, 'exclude')
    .map((p) => p.text)
    .join('\n');
  const legit = grams(tokens(rest), NGRAM);
  const out = grams(tokens(output), NGRAM);
  for (const f of findings) {
    for (const g of grams(tokens(f.excerpt), NGRAM)) {
      if (!legit.has(g) && out.has(g)) return true;
    }
  }
  return false;
}
