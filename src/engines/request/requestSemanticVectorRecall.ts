import {
  requestMemoryVectorEmbeddings,
  type MemoryVectorEmbeddingRequest
} from '../memoryVectorEmbeddingClient';
import { searchMemoryVectorIndexEntries, type MemoryVectorIndexSearchResult } from '../memoryVectorIndexSearch';
import {
  MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
  readMemoryVectorIndexEntries,
  readMemoryVectorIndexMetadata,
  sameMemoryVectorIndexModelIdentity
} from '../memoryVectorIndexStorage';
import { resolveMemoryVectorIndexRuntimeModel, selectMemoryVectorIndexProvider } from '../memoryVectorIndexModel';
import type { MemoryVectorRetrievalSettings, Persona, ProviderProfile } from '../../types/domain';
import { fingerprintRequestContextValue } from './requestContextReceipt';
import { estimateTextTokens } from './requestTokenEstimation';
import type { AssistantSemanticRecallCandidateDecision } from './requestSemanticRecallPlan';

export type RequestSemanticVectorEmbeddingClient = (
  request: MemoryVectorEmbeddingRequest
) => Promise<number[][]>;

function vectorCandidateText(result: MemoryVectorIndexSearchResult) {
  return [
    result.entry.title,
    result.entry.summary,
    result.entry.semanticText
  ].map((part) => part.trim()).filter(Boolean).join('\n');
}

export function buildSemanticRecallVectorCandidateDecisions(
  results: MemoryVectorIndexSearchResult[]
): AssistantSemanticRecallCandidateDecision[] {
  return results
    .filter((result) => result.entry.sourceMessageIds.length > 0)
    .map((result) => {
      const text = vectorCandidateText(result);
      const title = result.entry.conversationTitle.trim() || '未命名对话';
      return {
        id: `recall:vector_match:${result.entry.conversationId}:${result.entry.sourceChunkId}`,
        kind: 'vector_match',
        label: title,
        sourceConversationId: result.entry.conversationId,
        sourceMessageIds: result.entry.sourceMessageIds,
        memoryChunkKind: result.entry.kind,
        estimatedTokens: estimateTextTokens(text),
        charCount: result.entry.sourceCharCount || text.length,
        score: result.score,
        contentFingerprint: fingerprintRequestContextValue({
          kind: 'context-topography-evidence',
          text: text.replace(/\s+/g, ' ')
        }),
        status: 'kept'
      };
    });
}

export async function resolveRequestSemanticVectorCandidates(args: {
  persona: Persona | null | undefined;
  providers?: ProviderProfile[];
  globalApi?: ProviderProfile;
  memoryVectorRetrieval?: MemoryVectorRetrievalSettings;
  queryText: string;
  activeConversationId?: string | null;
  catalogConversationIds: string[];
  maxResults: number;
  signal?: AbortSignal;
  requestEmbeddings?: RequestSemanticVectorEmbeddingClient;
}): Promise<AssistantSemanticRecallCandidateDecision[]> {
  const persona = args.persona;
  const vectorIndex = persona?.memory.vectorIndex ?? { enabled: false };
  const vectorRetrieval = args.memoryVectorRetrieval;
  const vectorSettings = {
    enabled: vectorRetrieval ? vectorRetrieval.enabled : vectorIndex.enabled,
    baseUrl: vectorRetrieval?.baseUrl ?? '',
    path: vectorRetrieval?.path ?? '/embeddings',
    apiKey: vectorRetrieval?.apiKey ?? '',
    model: vectorRetrieval?.model ?? '',
    dimensions: vectorRetrieval?.dimensions ?? vectorIndex.dimensions
  };
  if (!persona || persona.memory.crossConversationRecallEnabled === false || vectorSettings.enabled !== true) return [];
  if (!args.globalApi) return [];

  const queryText = args.queryText.trim();
  if (!queryText) return [];
  const catalogConversationIds = new Set(args.catalogConversationIds.filter((conversationId) => conversationId.trim().length > 0));
  if (catalogConversationIds.size === 0) return [];

  const vectorModel = resolveMemoryVectorIndexRuntimeModel({
    settings: vectorSettings,
    providers: args.providers ?? [],
    globalApi: args.globalApi
  });
  if (!vectorModel) return [];

  const metadata = await readMemoryVectorIndexMetadata(persona.id);
  if (
    !metadata
    || metadata.schemaVersion !== MEMORY_VECTOR_INDEX_SCHEMA_VERSION
    || metadata.entryCount <= 0
    || metadata.embeddedCount <= 0
    || !sameMemoryVectorIndexModelIdentity(vectorModel, metadata.model)
  ) {
    return [];
  }

  const vectorApi = selectMemoryVectorIndexProvider({
    settings: vectorSettings,
    providers: args.providers ?? [],
    globalApi: args.globalApi
  });
  if (!vectorApi) return [];
  const requestEmbeddings = args.requestEmbeddings ?? requestMemoryVectorEmbeddings;
  const embeddings = await requestEmbeddings({
    api: vectorApi,
    model: vectorModel.model,
    dimensions: vectorModel.dimensions,
    inputs: [queryText],
    signal: args.signal
  });
  const queryEmbedding = embeddings[0];
  if (!queryEmbedding?.length) return [];

  const entries = (await readMemoryVectorIndexEntries(persona.id))
    .filter((entry) => catalogConversationIds.has(entry.conversationId));
  const results = searchMemoryVectorIndexEntries({
    entries,
    queryEmbedding,
    model: vectorModel,
    queryText,
    activeConversationId: args.activeConversationId ?? null,
    limit: args.maxResults
  });

  return buildSemanticRecallVectorCandidateDecisions(results);
}
