import type { ToolAction } from './toolExecutorTypes';
import type { ToolActionDescription } from './toolExecutorDescribe';

export type KnowledgeEnvironmentToolAction = Extract<
  ToolAction,
  {
    kind:
      | 'readPolarisKnowledge'
      | 'listEnvironmentNodes'
      | 'inspectEnvironmentNode'
      | 'searchEnvironmentNodes';
  }
>;

/**
 * Natural-language descriptions for the knowledge and environment-directory tool actions (read
 * built-in Polaris knowledge, list/inspect/search environment nodes). Pure field formatting — no
 * side effects and no theme/CSS coupling, even though these kinds sit next to the theme cases in
 * the dispatcher. The central `describeToolAction` dispatcher delegates these kinds here.
 */
export function describeKnowledgeEnvironmentToolAction(action: KnowledgeEnvironmentToolAction): ToolActionDescription {
  switch (action.kind) {
    case 'readPolarisKnowledge':
      return {
        kind: action.kind,
        title: '读取 Polaris 产品知识',
        summary: action.topic?.trim()
          ? `读取内置知识 · ${action.topic.trim()}`
          : '读取内置知识全文',
        targetLabel: action.targetLabel ?? action.topic
      };
    case 'listEnvironmentNodes':
      return {
        kind: action.kind,
        title: '列出环境目录',
        summary: `读取环境目录${action.parentNodeId ? ` · ${action.parentNodeId}` : ''}`,
        targetLabel: action.targetLabel || action.parentNodeId
      };
    case 'inspectEnvironmentNode':
      return {
        kind: action.kind,
        title: '检查环境节点',
        summary: `检查环境节点 · ${action.targetLabel || action.nodeId}`,
        targetLabel: action.targetLabel || action.nodeId
      };
    case 'searchEnvironmentNodes':
      return {
        kind: action.kind,
        title: '搜索环境目录',
        summary: `搜索环境目录 · ${action.targetLabel || action.query}`,
        targetLabel: action.targetLabel || action.query
      };
  }
}
