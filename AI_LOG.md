# AI_LOG — praca z AI

## Narzędzia

| Narzędzie                                | Do czego                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Claude Code (sesja w chmurze)            | analiza briefu i testowego PDF, projekt architektury, generowanie kodu, testów i dokumentacji |
| Playwright (sterowany przez Claude Code) | test end-to-end: wgranie testowej umowy, zrzuty ekranu 360 px / desktop, pobranie JSON        |
| Gemini 2.5 Flash                         | model używany przez aplikację (nie do pisania kodu)                                           |

Decyzje architektoniczne i ich uzasadnienie są opisane w README.

## Kluczowe prompty (skrócone, tłumaczenie z rosyjskiego)

1. **Analiza zadania:** „Przeanalizuj zadanie testowe (brief + testowy PDF) i zrób krótkie podsumowanie
   z wnioskami.” — AI znalazło w testowej umowie pułapki: instrukcję prompt injection na stronie 4,
   skan bez warstwy tekstowej na stronie 11 (Aneks nr 1 zmieniający abonament i liczbę użytkowników),
   cztery waluty, polski format liczb, układ dwukolumnowy.
2. **Ocena zakresu:** „Określ na oko objętość pracy w liniach kodu.” — wynik ~1,4–1,9 tys. linii;
   faktycznie: ~2,2 tys. linii TS/TSX + ~440 CSS (z testami).
3. **Wymagania deployu:** „Czy w zadaniu wskazano konkretne miejsce deployu?” — weryfikacja, że wymagane
   jest tylko GitHub Pages + Actions dla frontu, backend jest dowolny.
4. **Budowa:** „Zbuduj aplikację według rekomendacji: osobne czyste repozytorium, backend jako Worker.”
   — wygenerowanie struktury `components/ lib/ api/`, wspólnego schematu Zod, Workera z CORS/limitami,
   chunkingu, OCR przez model multimodalny, testów Vitest i workflow GitHub Actions.
5. **Bezpieczeństwo:** „Jak mocniej oznaczyć próbę jailbreaku? Dodaj osobny krok z kontrolą i
   ignorowaniem poleceń z wyników skanowania; przy wykryciu zapytaj użytkownika, czy wykluczyć
   fragment.” — AI zauważyło, że detektor sprawdzał tylko warstwę tekstową, a skany szły do modelu
   jako obraz (polecenie w skanie omijało kontrolę); przebudowa na 2 kroki: OCR + detekcja → decyzja
   użytkownika → analiza + kontrola wyniku.
6. **Weryfikacja:** test E2E z atrapą API LLM (zwracającą najpierw błędny, potem poprawny JSON), żeby
   sprawdzić ścieżkę „1 ponowna próba”, normalizację kwot i ostrzeżenie o prompt injection.

## Gdzie AI się pomyliło i jak to poprawiłem

| Błąd AI                                                                                                                                            | Jak wykryty                                     | Poprawka                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W analizie podało Cloudflare Workers jako wymaganie briefu                                                                                         | moje pytanie kontrolne vs. tekst briefu         | sprostowanie: brief wymaga tylko GitHub Pages; backend jest dowolny (Worker to nasz wybór)                                                                                                          |
| Licznik zdań traktował „r.”, „zł.” i liczby jako skróty — zdania kończące się „…2027 r.” nie byłyby liczone, a poprawne podsumowania odrzucane     | przegląd kodu                                   | lista skrótów zawężona do tych, po których zwykle stoi nazwa własna („ul.”, „np.”, inicjały)                                                                                                        |
| Konfiguracja ESLint używała reguły `react/no-danger` bez zainstalowanego pluginu                                                                   | ESLint                                          | zakaz `dangerouslySetInnerHTML` przez `no-restricted-syntax`                                                                                                                                        |
| Interfejs `Partial` w Workerze przesłaniał wbudowany typ TypeScript `Partial<T>`                                                                   | przegląd kodu                                   | zmiana nazwy na `PartialResult`                                                                                                                                                                     |
| Gemini przypisał prawdziwą datę z dokumentu do złego faktu (koniec starego abonamentu: 2026-03-31 zamiast 2027-03-31)                              | ręczna weryfikacja JSON z demo                  | test `GEMINI_THINKING_BUDGET=1024`: daty poprawne, ale 2/5 przebiegów nieudanych → zostawione `0`, prompt „dokładnie 4 zdania” + ponowna próba z podziałem na zdania, ograniczenie opisane w README |
| Detektor prompt injection sprawdzał tylko warstwę tekstową PDF; skany szły do modelu jako obraz, więc polecenie ukryte w skanie nie byłoby wykryte | analiza przy projektowaniu kroku bezpieczeństwa | osobny krok OCR przed detekcją (`prepare.ts`), detekcja także na tekście z OCR                                                                                                                      |
| Typ `Env` używał globalnego typu Workers `RateLimit` — `tsc` dla SPA (testy importują kod Workera) nie przechodził                                 | `npm run typecheck`                             | typ strukturalny `{ limit(...) }` bez zależności od typów Workers                                                                                                                                   |
| Zapis historii wykonywany wewnątrz funkcji aktualizującej stan React (efekt uboczny; w StrictMode wywoływana dwukrotnie → zdublowany zapis)        | przegląd kodu                                   | zapis poza updaterem; `localStorage` jako źródło prawdy                                                                                                                                             |
| W wyrażeniu regularnym znalazły się dosłowne znaki niełamliwej spacji                                                                              | ESLint `no-irregular-whitespace`                | zamiana na sekwencje ` `, ` `                                                                                                                                                                       |
| Pierwsza wersja promptu prosiła o „max 15” kwot i dat — Gemini na testowej umowie zwrócił 44 kwoty (cały cennik) i 27 dat, odpowiedź trwała 20 s   | test na żywym API                               | prompt: maks. 12 kwot / 10 dat posortowanych wg ważności, bez cennika i kapitału; twardy limit 15 w `normalize.ts`; produkty (SAP, M365) nie są organizacjami                                       |

## Co sprawdziłem ręcznie

- Żywe API (Gemini 2.5 Flash) na testowej umowie: HTTP 200, ~20 s przed poprawką limitów i ~8 s po niej (12 kwot, 10 dat, posortowane wg ważności); podsumowanie 4 zdania po polsku, uwzględnia Aneks nr 1 ze skanu (135 użytkowników, abonament 13 100 PLN od 01.04.2027); polecenie ze strony 4 zignorowane.

- Testowa umowa (12 stron): strona 11 wykryta jako skan i wysłana jako obraz; ostrzeżenie o poleceniu
  dla AI ze strony 4; kwoty „184 500,00 zł” → `184500`, `PLN`.
- Brak poziomego przewijania przy 360 px; obsługa klawiaturą (przyciski, widoczny focus).
- CORS: żądanie z niedozwolonego originu jest blokowane.
