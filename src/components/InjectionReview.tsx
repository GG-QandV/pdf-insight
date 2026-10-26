import { useEffect, useRef } from 'react';
import type { InjectionFinding } from '../../shared/schema';
import type { InjectionDecision } from '../api/analyze';
import { t } from '../lib/messages';

interface Props {
  findings: InjectionFinding[];
  onDecide: (decision: InjectionDecision) => void;
  onCancel: () => void;
}

/** Human-in-the-loop step shown only when the document contains a probable prompt injection. */
export function InjectionReview({ findings, onDecide, onCancel }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section className="card security security--review" aria-labelledby="inj-title">
      <h2 id="inj-title" ref={headingRef} tabIndex={-1}>
        <span aria-hidden="true">⚠ </span>
        {t.injection.reviewTitle}
      </h2>
      <p>{t.injection.reviewLead}</p>
      <ul className="findings">
        {findings.map((f, i) => (
          <li key={`${f.page}-${i}`}>
            <p className="small finding__where">{t.injection.where(f.page, f.source)}</p>
            <blockquote lang="pl">{f.excerpt}</blockquote>
          </li>
        ))}
      </ul>
      <p className="small muted">{t.injection.reviewNote}</p>
      <div className="row">
        <button type="button" className="btn btn--primary" onClick={() => onDecide('exclude')}>
          {t.injection.exclude}
        </button>
        <button type="button" className="btn" onClick={() => onDecide('include')}>
          {t.injection.include}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t.injection.cancel}
        </button>
      </div>
    </section>
  );
}
