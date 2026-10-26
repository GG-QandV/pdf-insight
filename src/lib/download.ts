import type { Insight } from '../../shared/schema';

export function toJson(insight: Insight): string {
  return JSON.stringify(insight, null, 2);
}

export function jsonFileName(insight: Insight): string {
  const base = insight.document.fileName.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}._-]+/gu, '_');
  return `${base || 'dokument'}.insight.json`;
}

/** F-05: download the validated result as a .json file. */
export function downloadJson(insight: Insight): void {
  const blob = new Blob([toJson(insight)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = jsonFileName(insight);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
