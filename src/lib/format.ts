export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value);
  } catch {
    // Unknown ISO code for this browser's Intl data: fall back to plain number + code.
    return `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2 }).format(value)} ${currency}`;
  }
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
}
