export interface PageText {
  page: number;
  text: string;
}

export interface Chunk {
  index: number;
  pages: number[];
  text: string;
}

export const CHUNK_CHARS = 45_000;
export const MAX_CHUNKS = 8;

function pageBlock(p: PageText, scanned: boolean): string {
  const body = p.text.trim();
  if (body === '' && scanned)
    return `[Strona ${p.page} — skan bez warstwy tekstowej, treść na obrazie]`;
  if (body === '') return `[Strona ${p.page} — pusta]`;
  return `[Strona ${p.page}]\n${body}`;
}

/** Splits a single oversized page on paragraph/line boundaries. */
function splitLong(text: string, size: number): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = rest.lastIndexOf(' ', size);
    if (cut < size * 0.5) cut = size;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.trim() !== '') parts.push(rest);
  return parts;
}

/**
 * Greedy packing of whole pages into chunks of at most `size` characters,
 * keeping "[Strona N]" markers so the model can reference page numbers.
 */
export function chunkPages(
  pages: PageText[],
  scannedPages: ReadonlySet<number> = new Set(),
  size = CHUNK_CHARS,
): { chunks: Chunk[]; truncated: boolean } {
  const chunks: Chunk[] = [];
  let current: Chunk = { index: 0, pages: [], text: '' };

  const flush = () => {
    if (current.pages.length > 0) chunks.push(current);
    current = { index: chunks.length, pages: [], text: '' };
  };

  for (const p of [...pages].sort((a, b) => a.page - b.page)) {
    const block = pageBlock(p, scannedPages.has(p.page));
    if (block.length > size) {
      flush();
      for (const piece of splitLong(block, size)) {
        current.pages.push(p.page);
        current.text = piece;
        flush();
      }
      continue;
    }
    if (current.text.length + block.length + 2 > size) flush();
    current.pages.push(p.page);
    current.text = current.text === '' ? block : `${current.text}\n\n${block}`;
  }
  flush();

  const truncated = chunks.length > MAX_CHUNKS;
  return { chunks: chunks.slice(0, MAX_CHUNKS), truncated };
}
