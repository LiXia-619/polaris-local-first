import {
  runConversationSummaryMemory,
  type ConversationSummaryRunProgress,
  type ConversationSummaryRequestReply,
  type ConversationSummaryRunResult
} from '../../engines/conversationSummaryRunner';
import { usePersonaStore } from '../../stores/personaStore';
import {
  selectRuntimeApi,
  selectVisibleProviders,
  useRuntimeStore
} from '../../stores/runtimeStore';
import {
  cancelDerivedDataWork,
  type DerivedDataWorkPriority,
  readStableCompleteChatConversationsForDerivedDataWork,
  runDerivedDataWork
} from '../data-work/derivedDataWork';
import type { PersonaConversationSummary, PersonaConversationSummarySuppression } from '../../types/domain';

export type UpdateConversationSummaryMemoryOptions = {
  requestReply?: ConversationSummaryRequestReply;
  now?: number;
  signal?: AbortSignal;
  yieldToForeground?: () => Promise<void>;
  onProgress?: (progress: ConversationSummaryMemoryProgress) => void;
  priority?: DerivedDataWorkPriority;
  replaceExisting?: boolean;
};

export type ConversationSummaryMemoryProgress =
  | ConversationSummaryRunProgress
  | {
      stage: 'queued' | 'reading_source' | 'saving' | 'completed';
      collaboratorId: string;
      providerId?: string;
      model?: string;
      totalBatches: number;
      completedBatches: number;
      generatedCount: number;
      sourceConversationCount: number;
      sourceMessageCount: number;
      sourceCharCount: number;
    };

function sourceMessageKey(sourceMessageIds: string[]) {
  return sourceMessageIds.join('\u001f');
}

function removeSuppressionsForSummaries(
  current: PersonaConversationSummarySuppression[] | undefined,
  summaries: PersonaConversationSummary[]
) {
  const generatedKeys = new Set(summaries.map((summary) => sourceMessageKey(summary.sourceMessageIds)));
  if (generatedKeys.size === 0) return current ?? [];
  return (current ?? []).filter((suppression) => !generatedKeys.has(sourceMessageKey(suppression.sourceMessageIds)));
}

function sortConversationSummaries(
  left: PersonaConversationSummary,
  right: PersonaConversationSummary
) {
  return left.sequence - right.sequence;
}

function replaceSmallModelSummaries(
  current: PersonaConversationSummary[],
  generated: PersonaConversationSummary[]
) {
  return [
    ...current.filter((summary) => summary.generator !== 'small_model'),
    ...generated
  ].sort(sortConversationSummaries);
}

function upsertSmallModelSummaryBatch(
  current: PersonaConversationSummary[],
  batchSummaries: PersonaConversationSummary[]
) {
  const batchKeys = new Set(batchSummaries.map((summary) => sourceMessageKey(summary.sourceMessageIds)));
  if (batchKeys.size === 0) return current;

  return [
    ...current.filter((summary) => (
      summary.generator !== 'small_model'
      || !batchKeys.has(sourceMessageKey(summary.sourceMessageIds))
    )),
    ...batchSummaries
  ].sort(sortConversationSummaries);
}

export async function updateConversationSummaryMemoryForCollaborator(
  collaboratorId: string,
  options: UpdateConversationSummaryMemoryOptions = {}
): Promise<ConversationSummaryRunResult> {
  const workId = `conversation_summary:${collaboratorId}`;
  if (options.replaceExisting) {
    cancelDerivedDataWork(workId, new Error('新的跨对话总结整理已接管。'));
  }
  options.onProgress?.({
    stage: 'queued',
    collaboratorId,
    totalBatches: 0,
    completedBatches: 0,
    generatedCount: 0,
    sourceConversationCount: 0,
    sourceMessageCount: 0,
    sourceCharCount: 0
  });
  return await runDerivedDataWork({
    id: workId,
    kind: 'conversation_summary',
    priority: options.priority ?? 'background',
    signal: options.signal,
    yieldToForeground: options.yieldToForeground,
    run: async ({ signal, yieldToForeground }) => {
      return await updateConversationSummaryMemoryForCollaboratorNow(collaboratorId, {
        ...options,
        signal,
        yieldToForeground
      });
    }
  });
}

async function updateConversationSummaryMemoryForCollaboratorNow(
  collaboratorId: string,
  options: UpdateConversationSummaryMemoryOptions = {}
): Promise<ConversationSummaryRunResult> {
  const runtime = useRuntimeStore.getState();
  const personaState = usePersonaStore.getState();
  const persona = personaState.personas.find((item) => item.id === collaboratorId);

  if (!persona) {
    throw new Error('找不到要更新跨对话总结的协作者。');
  }

  options.onProgress?.({
    stage: 'reading_source',
    collaboratorId,
    totalBatches: 0,
    completedBatches: 0,
    generatedCount: 0,
    sourceConversationCount: 0,
    sourceMessageCount: 0,
    sourceCharCount: 0
  });
  const conversations = await readStableCompleteChatConversationsForDerivedDataWork('conversation_summary');
  const latestSourceCounts = {
    sourceConversationCount: 0,
    sourceMessageCount: 0,
    sourceCharCount: 0
  };
  const result = await runConversationSummaryMemory({
    persona,
    conversations,
    settings: runtime.conversationSummaryModel,
    providers: selectVisibleProviders(runtime),
    globalApi: selectRuntimeApi(runtime),
    existingSummaries: persona.memory.conversationSummaries,
    suppressedSources: persona.memory.conversationSummarySuppressions,
    requestReply: options.requestReply,
    now: options.now,
    signal: options.signal,
    yieldToForeground: options.yieldToForeground,
    onProgress: (progress) => {
      latestSourceCounts.sourceConversationCount = progress.sourceConversationCount;
      latestSourceCounts.sourceMessageCount = progress.sourceMessageCount;
      latestSourceCounts.sourceCharCount = progress.sourceCharCount;
      options.onProgress?.(progress);
    },
    onBatchSummaries: async (batchSummaries) => {
      const latestPersona = usePersonaStore.getState().personas.find((item) => item.id === collaboratorId) ?? persona;
      usePersonaStore.getState().updateCollaborator(collaboratorId, {
        memory: {
          conversationSummaries: upsertSmallModelSummaryBatch(
            latestPersona.memory.conversationSummaries,
            batchSummaries
          ),
          conversationSummarySuppressions: removeSuppressionsForSummaries(
            latestPersona.memory.conversationSummarySuppressions,
            batchSummaries
          )
        }
      });
      await usePersonaStore.getState().persistToDb();
    }
  });

  if (result.status === 'completed' && result.summaries.length > 0) {
    options.onProgress?.({
      stage: 'saving',
      collaboratorId,
      providerId: result.providerId,
      model: result.model,
      totalBatches: result.batchCount,
      completedBatches: result.batchCount,
      generatedCount: result.generatedCount,
      ...latestSourceCounts
    });
    const latestPersona = usePersonaStore.getState().personas.find((item) => item.id === collaboratorId) ?? persona;
    usePersonaStore.getState().updateCollaborator(collaboratorId, {
      memory: {
        conversationSummaries: replaceSmallModelSummaries(
          latestPersona.memory.conversationSummaries,
          result.summaries
        ),
        conversationSummarySuppressions: removeSuppressionsForSummaries(
          latestPersona.memory.conversationSummarySuppressions,
          result.summaries
        )
      }
    });
    useRuntimeStore.getState().setConversationSummaryModel({ lastUpdatedAt: result.generatedAt });
    await usePersonaStore.getState().persistToDb();
    await useRuntimeStore.getState().persistToDb();
  }

  options.onProgress?.({
    stage: 'completed',
    collaboratorId,
    providerId: result.providerId,
    model: result.model,
    totalBatches: result.batchCount,
    completedBatches: result.batchCount,
    generatedCount: result.generatedCount,
    ...latestSourceCounts
  });
  return result;
}
