import type { ChatMessage, CodeCard, Conversation, ImageAssetCard, Persona } from '../types/domain';
import { isGroupConversation, isRetiredGroupConversation } from './conversationOwnership';

export type TraceActorKind = 'user' | 'collaborator' | 'system' | 'unknown';
export type TraceScopeKind = 'group-room' | 'collaborator-room' | 'collection' | 'system';

export interface TraceAttribution {
  actorId: string | null;
  actorName: string;
  actorKind: TraceActorKind;
  scopeId: string | null;
  scopeName: string;
  scopeKind: TraceScopeKind;
}

type TraceScopeInput = {
  scopeId?: string | null;
  scopeName?: string | null;
  scopeKind?: TraceScopeKind;
};

type TraceCollectionItem = Pick<CodeCard | ImageAssetCard, 'ownerCollaboratorId' | 'originConversationId'>;

function cleanLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolvePersona(personas: Persona[], personaId: string | null | undefined) {
  if (!personaId) return null;
  return personas.find((persona) => persona.id === personaId) ?? null;
}

function resolveScope(input: TraceScopeInput | undefined, fallback: TraceScopeInput): Pick<TraceAttribution, 'scopeId' | 'scopeName' | 'scopeKind'> {
  const scopeKind = input?.scopeKind ?? fallback.scopeKind ?? 'collection';
  return {
    scopeId: input?.scopeId ?? fallback.scopeId ?? null,
    scopeName: cleanLabel(input?.scopeName) ?? cleanLabel(fallback.scopeName) ?? defaultScopeName(scopeKind),
    scopeKind
  };
}

function defaultScopeName(scopeKind: TraceScopeKind) {
  if (scopeKind === 'group-room') return '群聊';
  if (scopeKind === 'collaborator-room') return '房间';
  if (scopeKind === 'system') return '系统';
  return '收藏';
}

function formatScopeLabel(attribution: TraceAttribution) {
  if (attribution.scopeKind === 'group-room') return `群聊「${attribution.scopeName}」`;
  if (attribution.scopeKind === 'collaborator-room') return `房间「${attribution.scopeName}」`;
  if (attribution.scopeKind === 'system') return `系统「${attribution.scopeName}」`;
  return attribution.scopeName;
}

export function formatActorMark(attribution: TraceAttribution, options: { includeScope?: boolean } = {}) {
  const actorName = cleanLabel(attribution.actorName) ?? (attribution.actorKind === 'user' ? '你' : '协作者');
  if (options.includeScope === false) return `✦ ${actorName}`;
  return `✦ ${actorName} · ${formatScopeLabel(attribution)}`;
}

export function formatTraceContextLabel(kind: string, attribution: TraceAttribution) {
  const cleanKind = cleanLabel(kind) ?? 'trace';
  return `[${cleanKind}] ${formatActorMark(attribution)}`;
}

export function traceAttributionForMessage(
  message: ChatMessage,
  options: TraceScopeInput & {
    personas: Persona[];
    userName?: string;
  }
): TraceAttribution {
  const scope = resolveScope(options, {});
  if (message.role === 'user') {
    return {
      actorId: 'user',
      actorName: cleanLabel(options.userName) ?? '你',
      actorKind: 'user',
      ...scope
    };
  }
  if (message.role === 'system') {
    return {
      actorId: null,
      actorName: '系统',
      actorKind: 'system',
      ...scope
    };
  }

  const speaker = resolvePersona(options.personas, message.speakerCollaboratorId);
  return {
    actorId: message.speakerCollaboratorId ?? null,
    actorName: cleanLabel(speaker?.name) ?? cleanLabel(message.assistantName) ?? '协作者',
    actorKind: message.speakerCollaboratorId || speaker || message.assistantName ? 'collaborator' : 'unknown',
    ...scope
  };
}

export function traceAttributionForCollectionItem(
  item: TraceCollectionItem,
  options: TraceScopeInput & {
    personas: Persona[];
    conversations: Conversation[];
  }
): TraceAttribution {
  const originConversation = item.originConversationId
    ? options.conversations.find((conversation) => conversation.id === item.originConversationId) ?? null
    : null;
  const hasGroupScope = originConversation
    ? isGroupConversation(originConversation) || isRetiredGroupConversation(originConversation)
    : false;
  const originCollaborator = hasGroupScope ? null : originConversation?.collaboratorId ?? null;
  const actorId = item.ownerCollaboratorId ?? originCollaborator;
  const actor = resolvePersona(options.personas, actorId);
  const derivedScope: TraceScopeInput = hasGroupScope && originConversation
    ? {
        scopeId: isGroupConversation(originConversation)
          ? originConversation.id
          : originConversation.groupRoomId ?? originConversation.id,
        scopeName: originConversation.group?.title ?? originConversation.title,
        scopeKind: 'group-room'
      }
    : originConversation?.collaboratorId
      ? {
          scopeId: originConversation.collaboratorId,
          scopeName: resolvePersona(options.personas, originConversation.collaboratorId)?.name ?? originConversation.title,
          scopeKind: 'collaborator-room'
        }
      : {
          scopeId: null,
          scopeName: '收藏',
          scopeKind: 'collection'
        };
  const scope = resolveScope(options, derivedScope);

  return {
    actorId: actorId ?? null,
    actorName: cleanLabel(actor?.name) ?? '协作者',
    actorKind: actorId ? 'collaborator' : 'unknown',
    ...scope
  };
}
