import { uniqueStrings } from '../../shared/normalize';

/** Normalized (not yet validated) partial result, see shared/normalize.ts. */
export interface PartialResult {
  document: { language: string; type: string; title: string | null; date: string | null };
  summary: string;
  keyPoints: string[];
  entities: { organizations: string[]; people: string[] };
  amounts: { value: number; currency: string; context: string }[];
  dates: { date: string; context: string }[];
  keywords: string[];
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v !== '') counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function dedupeBy<T>(items: T[], key: (item: T) => string, limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Deterministic merge of list fields from all parts. Summary and key points are
 * synthesised by a separate LLM call (see analyze.ts); here they are only collected.
 */
export function mergePartials(parts: PartialResult[]): PartialResult {
  const first = parts[0];
  if (!first) throw new Error('No partial results to merge');
  return {
    document: {
      language: mostCommon(parts.map((p) => p.document.language)) ?? first.document.language,
      type: mostCommon(parts.map((p) => p.document.type).filter((t) => t !== 'inne')) ?? 'inne',
      title: parts.find((p) => p.document.title !== null)?.document.title ?? null,
      date: parts.find((p) => p.document.date !== null)?.document.date ?? null,
    },
    summary: parts.map((p) => p.summary).join(' '),
    keyPoints: uniqueStrings(
      parts.flatMap((p) => p.keyPoints),
      40,
    ),
    entities: {
      organizations: uniqueStrings(parts.flatMap((p) => p.entities.organizations)),
      people: uniqueStrings(parts.flatMap((p) => p.entities.people)),
    },
    amounts: dedupeBy(
      parts.flatMap((p) => p.amounts),
      (a) => `${a.value}|${a.currency}|${a.context.toLocaleLowerCase()}`,
      30,
    ),
    dates: dedupeBy(
      parts.flatMap((p) => p.dates),
      (d) => `${d.date}|${d.context.toLocaleLowerCase()}`,
      30,
    ),
    keywords: uniqueStrings(
      parts.flatMap((p) => p.keywords),
      15,
    ),
  };
}
