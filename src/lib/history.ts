import { z } from 'zod';
import { insightSchema, type Insight } from '../../shared/schema';

/** F-09: last analyses stored locally in the browser. */
const KEY = 'pdf-insight:history:v1';
export const HISTORY_LIMIT = 10;

const entrySchema = z.object({
  id: z.string(),
  savedAt: z.string(),
  durationMs: z.number(),
  insight: insightSchema,
});

export type HistoryEntry = z.infer<typeof entrySchema>;

/** localStorage may be unavailable (private mode, blocked storage) — never throw. */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Entries that no longer match the schema are dropped instead of breaking the UI.
    return parsed.flatMap((e) => {
      const r = entrySchema.safeParse(e);
      return r.success ? [r.data] : [];
    });
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: history is a convenience, the analysis result is still shown.
  }
}

export function addToHistory(
  entries: HistoryEntry[],
  insight: Insight,
  durationMs: number,
): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    durationMs,
    insight,
  };
  const next = [entry, ...entries].slice(0, HISTORY_LIMIT);
  persist(next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  persist([]);
  return [];
}
