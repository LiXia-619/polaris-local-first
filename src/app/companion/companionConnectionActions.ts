import {
  connectCompanionClient,
  disconnectCompanionClient,
  unregisterCompanionHost
} from '../../engines/companionApi';
import { enterChatWorld } from '../shell/frontstageNavigation';
import { useChatStore } from '../../stores/chatStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import { useSpaceStore } from '../../stores/spaceStore';

export async function connectCompanionFromPairCode(params: {
  relayUrl: string;
  pairCode: string;
  label: string;
}) {
  const response = await connectCompanionClient(params);
  const companionId = useRuntimeStore.getState().addCompanionConnection({
    source: response.source,
    relayUrl: params.relayUrl,
    hostId: response.hostId,
    clientId: response.clientId,
    clientSecret: response.clientSecret,
    label: response.hostLabel,
    hostLabel: response.hostLabel
  });
  const connection = useRuntimeStore.getState().companionConnections.find((entry) => entry.id === companionId);
  if (!connection) {
    throw new Error('Companion 连接创建失败。');
  }

  const conversationId = useChatStore.getState().createConversation(connection.collaboratorId);
  useRuntimeStore.getState().updateCompanionConnection(companionId, {
    conversationId
  });
  useSpaceStore.getState().clearPendingAttachments();
  useSpaceStore.getState().clearPendingCardReference();
  useChatStore.getState().setActiveConversation(conversationId);
  useSpaceStore.getState().setFrontstageCollaboratorId(connection.collaboratorId);
  enterChatWorld(useSpaceStore.getState());

  return {
    connectionId: companionId,
    conversationId
  };
}

export async function stopPublishingCompanionHost() {
  const runtime = useRuntimeStore.getState();
  const host = runtime.companionHost;
  const relayUrl = host.relayUrl.trim();

  runtime.setCompanionHost({ enabled: false, error: null });
  runtime.resetCompanionHostRegistration();

  if (relayUrl && host.hostId && host.hostSecret) {
    await unregisterCompanionHost({
      relayUrl,
      hostId: host.hostId,
      hostSecret: host.hostSecret
    });
  }
}

export async function disconnectCompanionConnection(connectionId: string) {
  const runtime = useRuntimeStore.getState();
  const connection = runtime.companionConnections.find((entry) => entry.id === connectionId) ?? null;
  if (!connection) return;

  runtime.deleteCompanionConnection(connectionId);

  if (connection.relayUrl && connection.hostId && connection.clientId && connection.clientSecret) {
    await disconnectCompanionClient({
      relayUrl: connection.relayUrl,
      hostId: connection.hostId,
      clientId: connection.clientId,
      clientSecret: connection.clientSecret
    });
  }
}
