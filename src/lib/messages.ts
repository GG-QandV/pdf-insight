/** All user-facing texts (brief: "Komunikaty po polsku"). */
export const MAX_FILE_MB = 10;

export const t = {
  appTitle: 'PDF Insight',
  appLead: 'Wgraj plik PDF — otrzymasz krótkie podsumowanie i uporządkowane dane w formacie JSON.',
  privacy:
    'Tekst pliku (oraz obrazy stron bez warstwy tekstowej) jest wysyłany do zewnętrznego API AI w celu analizy. Nie wgrywaj dokumentów zawierających dane, których nie możesz udostępnić.',
  dropTitle: 'Przeciągnij i upuść plik PDF',
  dropOr: 'lub',
  dropButton: 'Wybierz plik',
  dropHint: `Tylko PDF, maks. ${MAX_FILE_MB} MB`,
  emptyTitle: 'Brak analizy',
  emptyText: 'Wybierz plik PDF, aby zobaczyć podsumowanie i dane.',
  readingStep: 'Odczyt tekstu z PDF…',
  ocrStep: (n: number) => `Przygotowanie ${n} zeskanowanych stron do OCR…`,
  preparingStep: 'Odczyt skanów (OCR) i kontrola bezpieczeństwa treści…',
  analyzingStep: 'Analiza AI — to zwykle trwa kilka–kilkanaście sekund…',
  retry: 'Spróbuj ponownie',
  newFile: 'Analizuj inny plik',
  errorTitle: 'Nie udało się przeanalizować pliku',
  summary: 'Podsumowanie',
  keyPoints: 'Najważniejsze punkty',
  documentInfo: 'Dokument',
  entities: 'Podmioty',
  organizations: 'Organizacje',
  people: 'Osoby',
  amounts: 'Kwoty',
  dates: 'Daty',
  keywords: 'Słowa kluczowe',
  none: 'Brak',
  json: 'Dane JSON',
  showJson: 'Pokaż JSON',
  hideJson: 'Ukryj JSON',
  download: 'Pobierz .json',
  copy: 'Kopiuj JSON',
  copied: 'Skopiowano',
  history: 'Historia analiz',
  historyEmpty: 'Brak zapisanych analiz.',
  historyClear: 'Wyczyść historię',
  historyNote: 'Wyniki są zapisywane tylko w tej przeglądarce.',
  warnings: 'Uwagi',
  durationLabel: (s: string) => `Czas analizy: ${s} s`,
  injection: {
    reviewTitle: 'Wykryto fragment wyglądający na polecenie dla AI',
    reviewLead:
      'Dokument zawiera tekst, który próbuje wpłynąć na wynik analizy (tzw. prompt injection). Zdecyduj, jak go potraktować:',
    reviewNote:
      'Wykrywanie jest heurystyczne i może się pomylić. W obu przypadkach model ma zakaz wykonywania poleceń z dokumentu, a wynik jest sprawdzany pod kątem przejęcia treści fragmentu.',
    exclude: 'Wyklucz fragment i analizuj (zalecane)',
    include: 'Analizuj z fragmentem (oznaczonym jako dane)',
    cancel: 'Anuluj',
    where: (page: number, source: 'text' | 'ocr') =>
      `Strona ${page} · ${source === 'ocr' ? 'tekst ze skanu (OCR)' : 'warstwa tekstowa'}`,
    resultTitle: (pages: string) =>
      `Wykryto próbę manipulacji AI (prompt injection) — strona ${pages}`,
    decisionLabel: 'Decyzja',
    excluded: 'Fragment wykluczony z analizy',
    included: 'Fragment pozostawiony jako dane (oznaczony)',
    outputCheckLabel: 'Kontrola wyniku',
    outputPassed: 'Wynik nie powtarza treści fragmentu ✓',
    outputFailed: 'Wynik może powtarzać treść fragmentu',
    showFragments: 'Pokaż wykryte fragmenty',
  },
  fields: {
    fileName: 'Plik',
    pages: 'Strony',
    language: 'Język',
    type: 'Typ',
    title: 'Tytuł',
    date: 'Data',
    value: 'Kwota',
    context: 'Kontekst',
    ocr: 'Strony odczytane przez OCR',
  },
} as const;

export const fileErrors = {
  notPdf: 'To nie jest plik PDF. Wybierz plik z rozszerzeniem .pdf.',
  tooLarge: `Plik jest za duży. Maksymalny rozmiar to ${MAX_FILE_MB} MB.`,
  empty: 'Plik jest pusty.',
  tooMany: 'Można wgrać tylko jeden plik naraz.',
} as const;

export const pdfErrors = {
  password: 'Plik PDF jest zabezpieczony hasłem — nie można odczytać jego treści.',
  invalid: 'Nie udało się odczytać pliku. Plik może być uszkodzony lub nie jest poprawnym PDF.',
  noText: 'Nie znaleziono tekstu w dokumencie (także na obrazach stron).',
} as const;

/** Error codes returned by the API (worker/src/index.ts). */
export const apiErrors: Record<string, string> = {
  BAD_REQUEST: 'Serwer odrzucił żądanie. Spróbuj ponownie z innym plikiem.',
  FORBIDDEN_ORIGIN: 'Ta strona nie ma dostępu do API analizy.',
  TOO_LARGE: 'Dokument jest za duży do analizy (za dużo tekstu lub obrazów).',
  RATE_LIMITED: 'Zbyt wiele analiz w krótkim czasie. Odczekaj minutę i spróbuj ponownie.',
  AI_BUSY: 'Usługa AI jest chwilowo przeciążona. Spróbuj ponownie za chwilę.',
  AI_TIMEOUT: 'Usługa AI nie odpowiedziała na czas. Spróbuj ponownie.',
  AI_INVALID:
    'AI zwróciło niepoprawne dane (także po ponownej próbie). Spróbuj ponownie — wynik bywa różny.',
  AI_UPSTREAM: 'Błąd usługi AI. Spróbuj ponownie za chwilę.',
  AI_INJECTED:
    'Wynik powtarzał treść fragmentu wyglądającego na polecenie dla AI, więc nie został pokazany. Spróbuj ponownie i wybierz „Wyklucz fragment”.',
  AI_CONFIG: 'Usługa analizy nie jest skonfigurowana. Skontaktuj się z autorem demo.',
  NETWORK: 'Brak połączenia z serwerem analizy. Sprawdź internet i spróbuj ponownie.',
  CLIENT_TIMEOUT: 'Analiza trwała zbyt długo. Spróbuj ponownie.',
  INVALID_RESPONSE: 'Otrzymane dane nie są zgodne ze schematem — wynik nie został wyświetlony.',
  UNKNOWN: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
};

export const typeLabels: Record<string, string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Inne',
};
