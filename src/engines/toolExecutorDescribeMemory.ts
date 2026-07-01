import type { ToolAction } from './toolExecutorTypes';
import type { ToolActionDescription } from './toolExecutorDescribe';

export type MemoryToolAction = Extract<
  ToolAction,
  { kind: 'writeMemory' | 'writeMemoryDoc' | 'readMemoryDoc' | 'searchMemory' | 'openMemorySource' }
>;

/**
 * Natural-language descriptions for the memory tool actions (writing/reading memory and long-term
 * docs, searching memory, opening a memory source). Pure field formatting — no side effects and no
 * theme/CSS coupling. The central `describeToolAction` dispatcher delegates these kinds here.
 */
export function describeMemoryToolAction(action: MemoryToolAction): ToolActionDescription {
  switch (action.kind) {
    case 'writeMemory':
      return {
        kind: action.kind,
        title: '写入记忆',
        summary: `${action.targetLabel || '当前协作者'} · 追加 ${action.memory.length} 条记忆`,
        targetLabel: action.targetLabel,
        memoryItems: action.memory
      };
    case 'writeMemoryDoc':
      return {
        kind: action.kind,
        title: action.docId ? '更新长期资料' : '写入长期资料',
        summary: `${action.targetLabel || '当前协作者'} · ${action.docId ? '更新' : '新增'} ${action.title}`,
        targetLabel: action.targetLabel || action.title
      };
    case 'readMemoryDoc':
      return {
        kind: action.kind,
        title: '读取长期资料',
        summary: `读取长期资料全文 · ${action.targetLabel || action.docId}`,
        targetLabel: action.targetLabel || action.docId
      };
    case 'searchMemory':
      return {
        kind: action.kind,
        title: '搜索过往记忆',
        summary: `搜索摘要和原文锚点 · ${action.targetLabel || action.query}`,
        targetLabel: action.targetLabel || action.query
      };
    case 'openMemorySource':
      return {
        kind: action.kind,
        title: '打开记忆原文',
        summary: `读取过往对话原文 · ${action.targetLabel || action.sourceConversationId}`,
        targetLabel: action.targetLabel || action.sourceConversationId
      };
  }
}
