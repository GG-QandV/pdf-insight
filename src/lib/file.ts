import { fileErrors, MAX_FILE_MB } from './messages';

export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

/** F-01: only PDF, max 10 MB. Checks MIME/extension and the "%PDF-" magic bytes. */
export async function validatePdfFile(file: File): Promise<string | null> {
  if (file.size === 0) return fileErrors.empty;
  if (file.size > MAX_FILE_BYTES) return fileErrors.tooLarge;
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!looksPdf) return fileErrors.notPdf;
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  const found = head.findIndex((_, i) => signature.every((b, j) => head[i + j] === b));
  return found === -1 ? fileErrors.notPdf : null;
}
