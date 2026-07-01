import { buildToolCardFunctionName, isRunnableToolCodeCard } from '../toolCardRuntime';
import type { AssistantToolContext } from './assistantToolProtocolTypes';
import type { PolarisToolDefinition } from './toolRegistryShared';
import { objectParameters, stringProperty } from './toolRegistryShared';

export function resolveCardToolDefinitions(
  context?: Partial<Pick<AssistantToolContext, 'visibleCards'>>
): PolarisToolDefinition[] {
  const cards = context?.visibleCards ?? [];

  return cards
    .filter((card) => isRunnableToolCodeCard(card))
    .map((card) => {
      const toolName = buildToolCardFunctionName(card);
      return {
        name: toolName,
        group: 'card',
        brief: card.cardNote?.trim() || `调用工具卡《${card.title}》`,
        schema: {
          name: toolName,
          description: [
            `调用收藏区工具卡《${card.title}》。`,
            card.cardNote?.trim() || null,
            '把自然语言任务放进 input；如果要传结构化参数，放进 args 对象。'
          ].filter(Boolean).join(' '),
          parameters: objectParameters({
            input: stringProperty('给这张工具卡的自然语言任务、说明或原始文本。'),
            args: {
              type: 'object',
              description: '可选结构化参数，会原样传给工具卡代码。',
              additionalProperties: true
            },
            targetLabel: stringProperty('可选目标说明。')
          })
        },
        buildRules: () => [
          '房间工具补充规则：',
          '- 标记成 `kind=tool` 且语言为 `javascript` 的房间，会自动进工具目录。',
          '- 这类工具卡运行时可直接读 `window.PolarisTool.input`、`window.PolarisTool.args`、`window.PolarisTool.card`，也能继续用 `window.PolarisRoom` 读写这张卡自己的持久状态。',
          `- \`${toolName}\` 对应房间卡《${card.title}》。`
        ]
      } satisfies PolarisToolDefinition;
    });
}
