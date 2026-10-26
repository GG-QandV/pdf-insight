import { useState } from 'react';
import type { Insight } from '../../shared/schema';
import { downloadJson, toJson } from '../lib/download';
import { t } from '../lib/messages';

export function JsonPreview({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = toJson(insight);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setOpen(true); // clipboard blocked: show the JSON so it can be selected manually
    }
  };

  return (
    <section className="card" aria-labelledby="json-title">
      <div className="card__head">
        <h2 id="json-title">{t.json}</h2>
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={() => downloadJson(insight)}>
            {t.download}
          </button>
          <button type="button" className="btn" onClick={() => void copy()}>
            {copied ? t.copied : t.copy}
          </button>
          <button
            type="button"
            className="btn"
            aria-expanded={open}
            aria-controls="json-pre"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t.hideJson : t.showJson}
          </button>
        </div>
      </div>
      {open && (
        <pre id="json-pre" className="json" tabIndex={0}>
          {json}
        </pre>
      )}
    </section>
  );
}
