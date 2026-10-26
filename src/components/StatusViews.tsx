import { t } from '../lib/messages';

/** F-06: loading, error with retry, empty state. */

export function LoadingView({ step }: { step: string }) {
  return (
    <section className="card status" aria-busy="true">
      <span className="spinner" aria-hidden="true" />
      <p role="status" aria-live="polite">
        {step}
      </p>
    </section>
  );
}

interface ErrorProps {
  message: string;
  canRetry: boolean;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorView({ message, canRetry, onRetry, onReset }: ErrorProps) {
  return (
    <section className="card status status--error" role="alert">
      <h2>{t.errorTitle}</h2>
      <p>{message}</p>
      <div className="row">
        {canRetry && (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            {t.retry}
          </button>
        )}
        <button type="button" className="btn" onClick={onReset}>
          {t.newFile}
        </button>
      </div>
    </section>
  );
}

export function EmptyView() {
  return (
    <section className="card status status--empty">
      <h2>{t.emptyTitle}</h2>
      <p>{t.emptyText}</p>
    </section>
  );
}
