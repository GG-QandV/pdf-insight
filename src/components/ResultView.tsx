import type { Insight } from '../../shared/schema';
import { t, typeLabels } from '../lib/messages';
import { formatAmount, formatDate } from '../lib/format';
import { JsonPreview } from './JsonPreview';
import { SecurityPanel } from './SecurityPanel';

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="muted">{t.none}</p>;
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

interface Props {
  insight: Insight;
  durationMs: number | null;
}

/** F-05: readable result + JSON preview/export. All values are rendered as text (no HTML). */
export function ResultView({ insight, durationMs }: Props) {
  const { document: doc, meta } = insight;
  const lang = doc.language;

  return (
    <div className="results">
      <section className="card" aria-labelledby="doc-title">
        <div className="card__head">
          <h2 id="doc-title">{doc.title ?? doc.fileName}</h2>
          <span className="badge">{typeLabels[doc.type] ?? doc.type}</span>
        </div>
        <dl className="meta">
          <div>
            <dt>{t.fields.fileName}</dt>
            <dd>{doc.fileName}</dd>
          </div>
          <div>
            <dt>{t.fields.pages}</dt>
            <dd>{doc.pages}</dd>
          </div>
          <div>
            <dt>{t.fields.language}</dt>
            <dd>{doc.language.toUpperCase()}</dd>
          </div>
          <div>
            <dt>{t.fields.date}</dt>
            <dd>{doc.date ? formatDate(doc.date) : t.none}</dd>
          </div>
          {meta && meta.ocrPages.length > 0 && (
            <div>
              <dt>{t.fields.ocr}</dt>
              <dd>{meta.ocrPages.join(', ')}</dd>
            </div>
          )}
        </dl>
        {durationMs !== null && (
          <p className="muted small">
            {t.durationLabel((durationMs / 1000).toFixed(1).replace('.', ','))}
          </p>
        )}
      </section>

      {insight.security && <SecurityPanel security={insight.security} />}

      {meta && meta.warnings.length > 0 && (
        <section className="card card--warn" aria-labelledby="warn-title">
          <h2 id="warn-title">{t.warnings}</h2>
          <List items={meta.warnings} />
        </section>
      )}

      <section className="card" aria-labelledby="summary-title">
        <h2 id="summary-title">{t.summary}</h2>
        <p className="summary" lang={lang}>
          {insight.summary}
        </p>
      </section>

      <section className="card" aria-labelledby="kp-title">
        <h2 id="kp-title">{t.keyPoints}</h2>
        <div lang={lang}>
          <List items={insight.keyPoints} />
        </div>
      </section>

      <section className="card" aria-labelledby="ent-title">
        <h2 id="ent-title">{t.entities}</h2>
        <div className="grid2" lang={lang}>
          <div>
            <h3>{t.organizations}</h3>
            <List items={insight.entities.organizations} />
          </div>
          <div>
            <h3>{t.people}</h3>
            <List items={insight.entities.people} />
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="amt-title">
        <h2 id="amt-title">{t.amounts}</h2>
        {insight.amounts.length === 0 ? (
          <p className="muted">{t.none}</p>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="amt-title">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.fields.value}</th>
                  <th scope="col">{t.fields.context}</th>
                </tr>
              </thead>
              <tbody lang={lang}>
                {insight.amounts.map((a, i) => (
                  <tr key={`${a.value}-${a.currency}-${i}`}>
                    <td className="num">{formatAmount(a.value, a.currency)}</td>
                    <td>{a.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="dates-title">
        <h2 id="dates-title">{t.dates}</h2>
        {insight.dates.length === 0 ? (
          <p className="muted">{t.none}</p>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="dates-title">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.fields.date}</th>
                  <th scope="col">{t.fields.context}</th>
                </tr>
              </thead>
              <tbody lang={lang}>
                {insight.dates.map((d, i) => (
                  <tr key={`${d.date}-${i}`}>
                    <td className="num">{formatDate(d.date)}</td>
                    <td>{d.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="kw-title">
        <h2 id="kw-title">{t.keywords}</h2>
        {insight.keywords.length === 0 ? (
          <p className="muted">{t.none}</p>
        ) : (
          <ul className="chips" lang={lang}>
            {insight.keywords.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        )}
      </section>

      <JsonPreview insight={insight} />
    </div>
  );
}
