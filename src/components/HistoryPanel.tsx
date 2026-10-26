import type { HistoryEntry } from '../lib/history';
import { formatDateTime } from '../lib/format';
import { t, typeLabels } from '../lib/messages';

interface Props {
  entries: HistoryEntry[];
  activeId: string | null;
  onOpen: (entry: HistoryEntry) => void;
  onClear: () => void;
}

/** F-09: recent analyses stored in localStorage. */
export function HistoryPanel({ entries, activeId, onOpen, onClear }: Props) {
  return (
    <aside className="card history" aria-labelledby="history-title">
      <div className="card__head">
        <h2 id="history-title">{t.history}</h2>
        {entries.length > 0 && (
          <button type="button" className="btn btn--small" onClick={onClear}>
            {t.historyClear}
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="muted">{t.historyEmpty}</p>
      ) : (
        <ul className="history__list">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="history__item"
                aria-current={e.id === activeId ? 'true' : undefined}
                onClick={() => onOpen(e)}
              >
                <span className="history__name">{e.insight.document.fileName}</span>
                <span className="muted small">
                  {typeLabels[e.insight.document.type]} · {formatDateTime(e.savedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{t.historyNote}</p>
    </aside>
  );
}
