import type { PersonaConversationSummary, PersonaConversationSummaryKind } from '../../types/domain';
import { fingerprintRequestContextValue } from './requestContextReceipt';
import { estimateTextTokens } from './requestTokenEstimation';

export type AssistantConversationSummaryDecision = {
  id: string;
  kind: PersonaConversationSummaryKind;
  title: string;
  content: string;
  sequence: number;
  sourceConversationIds: string[];
  sourceMessageIds: string[];
  sourceCharCount: number;
  subjectCollaboratorId?: string;
  subjectCollaboratorName?: string;
  userLabel?: string;
  estimatedTokens: number;
  charCount: number;
  contentFingerprint: string;
  generatedAt: number;
  updatedAt: number;
  expiresAt: number | null;
  status: 'kept' | 'dropped_budget' | 'expired';
};

export type AssistantConversationSummaryPlan = {
  status: 'disabled' | 'empty' | 'within_budget' | 'trimmed_budget';
  selectedSummaries: AssistantConversationSummaryDecision[];
  estimatedTokens: number;
  maxTokens: number | null;
  maxChars: number | null;
  entries: AssistantConversationSummaryDecision[];
};

export const DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_RELATIONAL_PROFILES = 3;
export const DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_RECENT_TOPICS = 8;
export const DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_TOTAL = 3;
export const DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_CHARS = 2_000;
export const DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_TOKENS =
  Math.ceil(DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_CHARS / 4);

function toDecision(summary: PersonaConversationSummary): AssistantConversationSummaryDecision {
  const content = summary.content.trim();
  const subjectCollaboratorId = summary.subjectCollaboratorId?.trim();
  const subjectCollaboratorName = summary.subjectCollaboratorName?.trim();
  const userLabel = summary.userLabel?.trim();
  return {
    id: summary.id,
    kind: summary.kind,
    title: summary.title.trim() || (summary.kind === 'relational_profile' ? '双方思维画像' : '最近事项'),
    content,
    sequence: summary.sequence,
    sourceConversationIds: summary.sourceConversationIds,
    sourceMessageIds: summary.sourceMessageIds,
    sourceCharCount: summary.sourceCharCount,
    ...(subjectCollaboratorId ? { subjectCollaboratorId } : {}),
    ...(subjectCollaboratorName ? { subjectCollaboratorName } : {}),
    ...(userLabel ? { userLabel } : {}),
    estimatedTokens: estimateTextTokens(content),
    charCount: content.length,
    contentFingerprint: fingerprintRequestContextValue({
      kind: 'conversation-summary',
      text: content.replace(/\s+/g, ' ')
    }),
    generatedAt: summary.generatedAt,
    updatedAt: summary.updatedAt,
    expiresAt: typeof summary.expiresAt === 'number' ? summary.expiresAt : null,
    status: 'kept'
  };
}

function sortSummaries(left: AssistantConversationSummaryDecision, right: AssistantConversationSummaryDecision) {
  if (left.kind !== right.kind) {
    return left.kind === 'relational_profile' ? -1 : 1;
  }
  if (left.kind === 'relational_profile') {
    return left.sequence - right.sequence;
  }
  return right.updatedAt - left.updatedAt;
}

function resolveCountLimit(value: number | null | undefined, fallback: number) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

function exceedsCountLimit(args: {
  entry: AssistantConversationSummaryDecision;
  selectedSummaries: AssistantConversationSummaryDecision[];
  maxTotalSummaries: number | null;
  maxRelationalProfiles: number | null;
  maxRecentTopics: number | null;
}) {
  if (
    args.maxTotalSummaries !== null
    && args.selectedSummaries.length >= args.maxTotalSummaries
  ) {
    return true;
  }
  const selectedOfKind = args.selectedSummaries.filter((summary) => summary.kind === args.entry.kind).length;
  if (args.entry.kind === 'relational_profile') {
    return args.maxRelationalProfiles !== null && selectedOfKind >= args.maxRelationalProfiles;
  }
  return args.maxRecentTopics !== null && selectedOfKind >= args.maxRecentTopics;
}

export function resolveRequestConversationSummaryPlan(args: {
  enabled: boolean;
  summaries?: PersonaConversationSummary[];
  now?: number;
  maxTokens: number | null;
  maxChars?: number | null;
  maxTotalSummaries?: number | null;
  maxRelationalProfiles?: number | null;
  maxRecentTopics?: number | null;
}): AssistantConversationSummaryPlan {
  const maxChars = args.maxChars === undefined ? DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_CHARS : args.maxChars;
  const maxTotalSummaries = resolveCountLimit(
    args.maxTotalSummaries,
    DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_TOTAL
  );
  const maxRelationalProfiles = resolveCountLimit(
    args.maxRelationalProfiles,
    DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_RELATIONAL_PROFILES
  );
  const maxRecentTopics = resolveCountLimit(
    args.maxRecentTopics,
    DEFAULT_CONVERSATION_SUMMARY_REQUEST_MAX_RECENT_TOPICS
  );

  if (!args.enabled) {
    return {
      status: 'disabled',
      selectedSummaries: [],
      estimatedTokens: 0,
      maxTokens: args.maxTokens,
      maxChars,
      entries: []
    };
  }

  const now = args.now ?? Date.now();
  const entries = (args.summaries ?? [])
    .map(toDecision)
    .filter((entry) => entry.content)
    .map((entry) => (
      entry.expiresAt !== null && entry.expiresAt <= now
        ? { ...entry, status: 'expired' as const }
        : entry
    ))
    .sort(sortSummaries);
  const candidates = entries.filter((entry) => entry.status !== 'expired');

  if (!entries.length || !candidates.length) {
    return {
      status: 'empty',
      selectedSummaries: [],
      estimatedTokens: 0,
      maxTokens: args.maxTokens,
      maxChars,
      entries
    };
  }

  const selectedSummaries: AssistantConversationSummaryDecision[] = [];
  let estimatedTokens = 0;
  let estimatedChars = 0;
  const budgetedEntries: AssistantConversationSummaryDecision[] = entries.map((entry) => {
    if (entry.status === 'expired') return entry;
    const nextTokens = estimatedTokens + entry.estimatedTokens;
    const nextChars = estimatedChars + entry.charCount;
    const overTokenBudget = args.maxTokens !== null && nextTokens > args.maxTokens;
    const overCharBudget = maxChars !== null && nextChars > maxChars;
    if (
      exceedsCountLimit({ entry, selectedSummaries, maxTotalSummaries, maxRelationalProfiles, maxRecentTopics })
      || overTokenBudget
      || overCharBudget
    ) {
      return { ...entry, status: 'dropped_budget' as const };
    }
    selectedSummaries.push(entry);
    estimatedTokens = nextTokens;
    estimatedChars = nextChars;
    return entry;
  });

  return {
    status: budgetedEntries.some((entry) => entry.status === 'dropped_budget') ? 'trimmed_budget' : 'within_budget',
    selectedSummaries,
    estimatedTokens,
    maxTokens: args.maxTokens,
    maxChars,
    entries: budgetedEntries
  };
}
