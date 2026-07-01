import type { ChatMessage } from '../../types/domain';

export function formatConversationMarkdown(args: {
  title: string;
  messages: ChatMessage[];
}) {
  const body = args.messages
    .map((message) => {
      const roleLabel =
        message.role === 'user'
          ? 'User'
          : message.role === 'assistant'
            ? (message.assistantName ?? 'Assistant')
            : 'System';
      return `## ${roleLabel}\n\n${message.content.trim() || '(empty)'}`;
    })
    .join('\n\n');
  return `# ${args.title}\n\n${body}`;
}

export function formatConversationJson(args: {
  conversationId: string;
  title: string;
  messages: ChatMessage[];
}) {
  return JSON.stringify({
    conversationId: args.conversationId,
    title: args.title,
    exportedAt: new Date().toISOString(),
    messages: args.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      assistantName: message.assistantName,
      model: message.model
    }))
  }, null, 2);
}
