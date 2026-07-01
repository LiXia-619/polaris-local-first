import type { AssistantToolContext } from '../assistantToolProtocol';
import { buildAssistantToolPromptSections } from '../tool-protocol/assistantToolProtocolPrompt';
import type { AssistantPromptPart } from './requestAudit';
import type { ChatMessage } from '../../types/domain';
import type { AssistantToolPromptProtocolMode } from '../tool-protocol/assistantToolProtocolPrompt';
import type { AssistantToolPromptSectionName } from '../tool-protocol/assistantToolProtocolPrompt';

const TOOL_CONTEXT_SECTION_NAMES = new Set<AssistantToolPromptSectionName>([
  'tool_context_capability',
  'ui_context_capability',
  'attachment_context_capability',
  'desktop_local_context_capability',
  'room_context_capability',
  'theme_context_capability'
]);

function buildToolCapabilityEntries(
  toolContext?: AssistantToolContext,
  protocolMode: AssistantToolPromptProtocolMode = 'hybrid'
): Array<Omit<AssistantPromptPart, 'enabled' | 'charCount'>> {
  const sections = buildAssistantToolPromptSections(toolContext, { protocolMode });
  if (!sections.length) return [];

  return sections.map((section) => ({
    name: section.name,
    label: section.label,
    role: 'system',
    layer: TOOL_CONTEXT_SECTION_NAMES.has(section.name) ? 'context' : 'capability',
    truncationPriority:
      section.name === 'tool_capability'
        ? 0
        : section.name === 'tool_catalog_capability' || section.name === 'tool_protocol_capability'
          ? 1
          : section.name === 'workspace_write_capability' || section.name === 'tool_rules_capability'
            ? 2
            : 3,
    content: section.name === 'tool_capability'
      ? [
          '以下是当前可用的工具目录和执行规则；要动界面、房间、附件、记忆或联网时直接用。',
          section.content
        ].join('\n\n')
      : section.content
  }));
}

function buildReplyMarkupLayer() {
  return [
    '正文默认继续用 markdown。',
    '如果你想让气泡里的表达更细，可以额外使用一层轻量富文本，但只限安全白名单，不要输出 script、iframe、外链样式或外部资源。',
    '允许的内联写法：`<span style="...">...</span>`、`<small>`、`<sub>`、`<sup>`、`<mark>`、`<u>`、`<br>`。',
    '其中 `<span style>` 只支持轻量样式子集：color、background/background-color、border/border-color、border-radius、padding、font-size、font-weight、font-style、letter-spacing、text-transform、text-decoration、box-shadow、opacity、margin-left、margin-right、display:inline-block。',
    '允许的块级写法：`<details><summary>标题</summary>内容</details>` 用来做折叠段落。',
    '还允许轻量卡片：`<polaris-card title="标题" kicker="角标" tone="mist|warm|cool|rose|gold">内容</polaris-card>`。',
    '这些富文本只服务内容表达，不要拿它冒充工具结果，也不要塞需要宿主额外执行的东西。'
  ].join('\n');
}

export function buildCapabilityEntries(args: {
  messages: ChatMessage[];
  toolContext?: AssistantToolContext;
  toolProtocolMode?: AssistantToolPromptProtocolMode;
}): Array<Omit<AssistantPromptPart, 'enabled' | 'charCount'>> {
  void args.messages;

  return [
    ...buildToolCapabilityEntries(args.toolContext, args.toolProtocolMode),
    {
    name: 'reply_markup_capability',
    label: '回复富文本',
    role: 'system',
    layer: 'capability',
    truncationPriority: 1,
    content: buildReplyMarkupLayer()
    }
  ];
}
