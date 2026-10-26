import { useCallback, useState } from 'react';
import type { Insight } from '../shared/schema';
import { analyzePdf, ApiError } from './api/analyze';
import { FileDrop } from './components/FileDrop';
import { HistoryPanel } from './components/HistoryPanel';
import { ResultView } from './components/ResultView';
import { EmptyView, ErrorView, LoadingView } from './components/StatusViews';
import { validatePdfFile } from './lib/file';
import { addToHistory, clearHistory, loadHistory, type HistoryEntry } from './lib/history';
import { apiErrors, pdfErrors, t } from './lib/messages';
import { extractPdf, PdfReadError } from './lib/pdf';

type State =
  | { kind: 'idle' }
  | { kind: 'busy'; step: string }
  | { kind: 'error'; message: string; file: File | null }
  | { kind: 'done'; insight: Insight; durationMs: number | null; historyId: string | null };

function errorMessage(err: unknown): string {
  if (err instanceof PdfReadError)
    return err.kind === 'password' ? pdfErrors.password : pdfErrors.invalid;
  if (err instanceof ApiError) return apiErrors[err.code] ?? apiErrors.UNKNOWN ?? '';
  return apiErrors.UNKNOWN ?? '';
}

export function App() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const run = useCallback(async (file: File) => {
    const invalid = await validatePdfFile(file);
    if (invalid) {
      setState({ kind: 'error', message: invalid, file: null });
      return;
    }
    const started = performance.now();
    try {
      setState({ kind: 'busy', step: t.readingStep });
      const pdf = await extractPdf(file, (n) => setState({ kind: 'busy', step: t.ocrStep(n) }));
      const hasText = pdf.pageTexts.some((p) => p.text.trim() !== '') || pdf.images.length > 0;
      if (!hasText) {
        setState({ kind: 'error', message: pdfErrors.noText, file: null });
        return;
      }
      setState({ kind: 'busy', step: t.analyzingStep });
      const insight = await analyzePdf(file.name, pdf);
      const durationMs = Math.round(performance.now() - started);
      // localStorage is the source of truth, so the updater stays free of side effects.
      const next = addToHistory(loadHistory(), insight, durationMs);
      setHistory(next);
      setState({ kind: 'done', insight, durationMs, historyId: next[0]?.id ?? null });
    } catch (err) {
      setState({ kind: 'error', message: errorMessage(err), file });
    }
  }, []);

  const busy = state.kind === 'busy';

  return (
    <div className="page">
      <header className="header">
        <h1>{t.appTitle}</h1>
        <p className="lead">{t.appLead}</p>
      </header>

      <main className="layout">
        <div className="main-col">
          <FileDrop
            disabled={busy}
            onFile={(f) => void run(f)}
            onReject={(message) => setState({ kind: 'error', message, file: null })}
          />
          <p className="privacy" role="note">
            {t.privacy}
          </p>

          {state.kind === 'idle' && <EmptyView />}
          {state.kind === 'busy' && <LoadingView step={state.step} />}
          {state.kind === 'error' && (
            <ErrorView
              message={state.message}
              canRetry={state.file !== null}
              onRetry={() => state.file && void run(state.file)}
              onReset={() => setState({ kind: 'idle' })}
            />
          )}
          {state.kind === 'done' && (
            <ResultView insight={state.insight} durationMs={state.durationMs} />
          )}
        </div>

        <HistoryPanel
          entries={history}
          activeId={state.kind === 'done' ? state.historyId : null}
          onOpen={(e) =>
            setState({
              kind: 'done',
              insight: e.insight,
              durationMs: e.durationMs,
              historyId: e.id,
            })
          }
          onClear={() => setHistory(clearHistory())}
        />
      </main>

      <footer className="footer muted small">
        PDF Insight · React + TypeScript · Cloudflare Worker · Gemini
      </footer>
    </div>
  );
}
