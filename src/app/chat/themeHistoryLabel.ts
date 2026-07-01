import { themeToolScopeLabel } from '../theme/themeToolScopeLabel';
import type { ThemeToolScope } from '../../types/domain';

function summarizeLabels(labels: string[] | undefined) {
  const cleaned = Array.from(new Set((labels ?? []).map((label) => label.trim()).filter(Boolean)));
  if (!cleaned.length) return '';
  const shown = cleaned.slice(0, 3).join('、');
  return cleaned.length > 3 ? `${shown}等` : shown;
}

export function buildThemeHistoryLabel(args: {
  scope?: ThemeToolScope;
  title: string;
  themeIntentLabel?: string | null;
  targetLabel?: string | null;
  batchLabels?: string[];
}) {
  const scopeLabel = themeToolScopeLabel(args.scope ?? 'app');
  const batchSummary = summarizeLabels(args.batchLabels);

  if (batchSummary) {
    return `${scopeLabel}联动 · ${batchSummary}`;
  }
  if (args.themeIntentLabel?.trim()) {
    return `${scopeLabel} · ${args.themeIntentLabel.trim()}`;
  }
  if (args.targetLabel?.trim() && args.targetLabel.trim() !== 'AI CSS') {
    return `${scopeLabel} · ${args.targetLabel.trim()}`;
  }
  return args.title.trim();
}

