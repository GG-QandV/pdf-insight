import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface PageImage {
  page: number;
  mimeType: 'image/jpeg';
  data: string; // base64 without data: prefix
}

export interface ExtractedPdf {
  pages: number;
  pageTexts: { page: number; text: string }[];
  images: PageImage[];
}

export class PdfReadError extends Error {
  constructor(readonly kind: 'password' | 'invalid') {
    super(kind);
  }
}

/** A page with fewer visible characters than this is treated as a scan (F-10). */
const SCAN_THRESHOLD = 25;
const MAX_OCR_PAGES = 5;
const OCR_WIDTH_PX = 1400;

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  // GitHub Pages pitfall: the worker must be resolved relative to the Vite `base`.
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === 'object' && item !== null && 'str' in item;
}

async function pageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent();
  let out = '';
  for (const item of content.items) {
    if (!isTextItem(item)) continue;
    out += item.str + (item.hasEOL ? '\n' : '');
  }
  return out
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function renderPageJpeg(page: PDFPageProxy): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2.5, OCR_WIDTH_PX / base.width) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PdfReadError('invalid');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

export async function extractPdf(
  file: File,
  onScannedPages?: (count: number) => void,
): Promise<ExtractedPdf> {
  const pdfjs = await loadPdfJs();
  let doc: PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (err) {
    if (err instanceof Error && err.name === 'PasswordException')
      throw new PdfReadError('password');
    throw new PdfReadError('invalid');
  }

  try {
    const pageTexts: ExtractedPdf['pageTexts'] = [];
    const scanned: number[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const text = await pageText(page);
      pageTexts.push({ page: n, text });
      if (text.replace(/\s/g, '').length < SCAN_THRESHOLD) scanned.push(n);
      page.cleanup();
    }

    const ocrPages = scanned.slice(0, MAX_OCR_PAGES);
    if (ocrPages.length > 0) onScannedPages?.(ocrPages.length);
    const images: PageImage[] = [];
    for (const n of ocrPages) {
      const page = await doc.getPage(n);
      images.push({ page: n, mimeType: 'image/jpeg', data: await renderPageJpeg(page) });
      page.cleanup();
    }
    return { pages: doc.numPages, pageTexts, images };
  } finally {
    void doc.destroy();
  }
}
