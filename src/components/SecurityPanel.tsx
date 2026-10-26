import type { Security } from '../../shared/schema';
import { t } from '../lib/messages';

/** Result of the prompt-injection checks, shown above the summary when something was found. */
export function SecurityPanel({ security }: { security: Security }) {
  const pi = security.promptInjection;
  if (!pi.detected) return null;
  const pages = [...new Set(pi.findings.map((f) => f.page))].join(', ');

  return (
    <section className="card security" aria-labelledby="sec-title">
      <h2 id="sec-title">
        <span aria-hidden="true">⚠ </span>
        {t.injection.resultTitle(pages)}
      </h2>
      <dl className="security__facts">
        <div>
          <dt>{t.injection.decisionLabel}</dt>
          <dd>{pi.decision === 'excluded' ? t.injection.excluded : t.injection.included}</dd>
        </div>
        <div>
          <dt>{t.injection.outputCheckLabel}</dt>
          <dd>
            {pi.outputCheck === 'passed' ? t.injection.outputPassed : t.injection.outputFailed}
          </dd>
        </div>
      </dl>
      <details>
        <summary>{t.injection.showFragments}</summary>
        {pi.findings.map((f, i) => (
          <div key={`${f.page}-${i}`}>
            <p className="small finding__where">{t.injection.where(f.page, f.source)}</p>
            <blockquote lang="pl">{f.excerpt}</blockquote>
          </div>
        ))}
      </details>
    </section>
  );
}
