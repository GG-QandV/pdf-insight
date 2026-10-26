/**
 * Deterministic clean-up of raw LLM output before schema validation.
 * The model is asked for the exact shape, but small format slips
 * ("184 500,00", "zł", "12.03.2026") are fixed here instead of failing the request.
 */

const CURRENCY_ALIASES: Record<string, string> = {
  ZŁ: 'PLN',
  ZL: 'PLN',
  ZŁOTY: 'PLN',
  ZŁOTYCH: 'PLN',
  PLN: 'PLN',
  '€': 'EUR',
  EURO: 'EUR',
  EUR: 'EUR',
  $: 'USD',
  US$: 'USD',
  USD: 'USD',
  '£': 'GBP',
  GBP: 'GBP',
  CHF: 'CHF',
  UAH: 'UAH',
  CZK: 'CZK',
  KČ: 'CZK',
};

export function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().replace(/\.$/, '').toUpperCase();
  if (key in CURRENCY_ALIASES) return CURRENCY_ALIASES[key] ?? null;
  return /^[A-Z]{3}$/.test(key) ? key : null;
}

/** Parses numbers written as 184 500,00 / 184.500,00 / 184,500.00 / 12500. */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d,.-]/g, '');
  if (s === '' || s === '-') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // the later separator is the decimal one
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && s.indexOf(',') === lastComma ? s.replace(',', '') : s.replace(/,/g, '.');
  } else if (lastDot > -1 && s.indexOf('.') !== lastDot) {
    s = s.replace(/\./g, '');
  }
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/** Accepts ISO dates and common European formats (DD.MM.YYYY, DD/MM/YYYY). */
export function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const eu = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (eu) return `${eu[3]}-${eu[2]?.padStart(2, '0')}-${eu[1]?.padStart(2, '0')}`;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.replace(/\s+/g, ' ').trim();
  return s === '' || s.toLowerCase() === 'null' ? null : s;
}

export function uniqueStrings(values: unknown, limit = 50): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = cleanString(v);
    if (s === null) continue;
    const key = s.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

export interface NormalizeContext {
  fileName: string;
  pages: number;
}

/** Returns an object in the target shape; validation is still done by the schema afterwards. */
export function normalizeInsight(raw: unknown, ctx: NormalizeContext): Record<string, unknown> {
  const r = isRecord(raw) ? raw : {};
  const doc = isRecord(r.document) ? r.document : {};
  const entities = isRecord(r.entities) ? r.entities : {};

  const type = cleanString(doc.type)?.toLowerCase() ?? 'inne';
  const language = cleanString(doc.language)?.toLowerCase().slice(0, 2) ?? '';

  const amounts = Array.isArray(r.amounts) ? r.amounts : [];
  const dates = Array.isArray(r.dates) ? r.dates : [];

  const seenAmounts = new Set<string>();
  const seenDates = new Set<string>();

  return {
    document: {
      // File name and page count come from the client, never from the model.
      fileName: ctx.fileName,
      pages: ctx.pages,
      language,
      type: ['faktura', 'umowa', 'oferta', 'raport', 'inne'].includes(type) ? type : 'inne',
      title: cleanString(doc.title),
      date: normalizeDate(doc.date),
    },
    summary: cleanString(r.summary) ?? '',
    keyPoints: uniqueStrings(r.keyPoints, 7),
    entities: {
      organizations: uniqueStrings(entities.organizations),
      people: uniqueStrings(entities.people),
    },
    amounts: amounts.flatMap((a) => {
      if (!isRecord(a)) return [];
      const value = parseAmount(a.value);
      const currency = normalizeCurrency(a.currency);
      const context = cleanString(a.context);
      if (value === null || currency === null || context === null) return [];
      const key = `${value}|${currency}|${context.toLocaleLowerCase()}`;
      if (seenAmounts.has(key)) return [];
      seenAmounts.add(key);
      return [{ value, currency, context }];
    }),
    dates: dates.flatMap((d) => {
      if (!isRecord(d)) return [];
      const date = normalizeDate(d.date);
      const context = cleanString(d.context);
      if (date === null || context === null) return [];
      const key = `${date}|${context.toLocaleLowerCase()}`;
      if (seenDates.has(key)) return [];
      seenDates.add(key);
      return [{ date, context }];
    }),
    keywords: uniqueStrings(r.keywords, 15),
  };
}
