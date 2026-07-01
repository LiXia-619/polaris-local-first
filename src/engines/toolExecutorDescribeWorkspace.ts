import type { CodeCardToolPatch, ToolAction } from './toolExecutorTypes';
import type { ToolActionDescription } from './toolExecutorDescribe';

export type WorkspaceToolAction = Extract<
  ToolAction,
  {
    kind:
      | 'switchWorld'
      | 'createRoomProject'
      | 'createCodeCard'
      | 'createProjectFile'
      | 'patchRoomProject'
      | 'writeProjectFiles'
      | 'listProjectFiles'
      | 'searchProjectFiles'
      | 'readWorkspacePreviewState'
      | 'listWorkspaceReferences'
      | 'searchWorkspaceReferences'
      | 'readWorkspaceReference'
      | 'promoteWorkspaceReferenceToProjectFile'
      | 'pinProjectFileAsReference'
      | 'searchReadableContext'
      | 'checkProjectPreview'
      | 'inspectProjectRuntime'
      | 'promoteCardToProject'
      | 'patchCodeCard'
      | 'appendCodeCard'
      | 'appendProjectFile'
      | 'insertProjectFile'
      | 'replaceProjectFileLines'
      | 'editCodeCardText'
      | 'editProjectFileText'
      | 'deleteProjectFile'
      | 'listCodeCards'
      | 'readCodeCard'
      | 'readProjectFile'
      | 'readProjectFileContext';
  }
>;

/**
 * Natural-language descriptions for the workspace / room-project / code-card / project-file tool
 * actions. Description only — pure field formatting with no side effects. The file executors,
 * room tools, project storage, workspace sync, and any permission semantics live elsewhere and are
 * untouched. The central `describeToolAction` dispatcher delegates these kinds here.
 */
function summarizeCodeCardPatch(patch: CodeCardToolPatch, targetLabel?: string) {
  const fields = [
    patch.title !== undefined ? '标题' : null,
    patch.cardNote !== undefined ? '小字' : null,
    patch.language !== undefined ? '语言' : null,
    patch.code !== undefined ? '代码' : null,
    patch.cardFaceCss !== undefined ? '卡面' : null,
    patch.tags !== undefined ? '标签' : null
  ].filter(Boolean);
  return `${targetLabel || '指定房间'} · ${fields.length ? `已更新 ${fields.join('、')}` : '已更新内容'}`;
}

export function describeWorkspaceToolAction(action: WorkspaceToolAction): ToolActionDescription {
  switch (action.kind) {
    case 'switchWorld':
      return {
        kind: action.kind,
        title: '世界切换',
        summary: `切换到 ${action.world === 'collection' ? '房间' : '对话'}`
      };
    case 'createRoomProject':
      return {
        kind: action.kind,
        title: '已创建工作区',
        summary: `已创建工作区 · ${action.targetLabel || action.project.title || '未命名工作区'}`,
        targetLabel: action.targetLabel || action.project.title
      };
    case 'createCodeCard':
      return {
        kind: action.kind,
        title: '已创建卡片',
        summary: `已创建卡片 · ${action.targetLabel || action.card.title || '未命名卡片'}`,
        targetLabel: action.targetLabel || action.card.title
      };
    case 'createProjectFile':
      return {
        kind: action.kind,
        title: '已创建工作区文件',
        summary: `已创建工作区文件 · ${action.targetLabel || action.file.filePath}`,
        targetLabel: action.targetLabel || action.file.filePath
      };
    case 'patchRoomProject':
      return {
        kind: action.kind,
        title: '已更新工作区封面',
        summary: `已更新工作区封面${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'writeProjectFiles':
      return {
        kind: action.kind,
        title: '已写入工作区文件',
        summary: `${action.targetLabel || action.projectId} · ${action.files.length} 个文件`,
        targetLabel: action.targetLabel || action.projectId
      };
    case 'listProjectFiles':
      return {
        kind: action.kind,
        title: '读取工作区目录',
        summary: `读取工作区文件目录${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'searchProjectFiles':
      return {
        kind: action.kind,
        title: '搜索工作区文件',
        summary: `搜索 “${action.query}”${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel || action.query
      };
    case 'readWorkspacePreviewState':
      return {
        kind: action.kind,
        title: '读取预览状态',
        summary: `读取工作区预览状态${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'listWorkspaceReferences':
      return {
        kind: action.kind,
        title: '读取参考资料目录',
        summary: `读取工作区参考资料目录${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'searchWorkspaceReferences':
      return {
        kind: action.kind,
        title: '搜索参考资料',
        summary: `搜索工作区参考资料 “${action.query}”${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel || action.query
      };
    case 'readWorkspaceReference':
      return {
        kind: action.kind,
        title: '读取参考资料',
        summary: `读取工作区参考资料全文 · ${action.targetLabel || action.title || action.docId || '指定资料'}`,
        targetLabel: action.targetLabel || action.title || action.docId
      };
    case 'promoteWorkspaceReferenceToProjectFile':
      return {
        kind: action.kind,
        title: '参考资料转工作区文件',
        summary: `参考资料转工作区文件 · ${action.targetLabel || action.filePath}`,
        targetLabel: action.targetLabel || action.filePath
      };
    case 'pinProjectFileAsReference':
      return {
        kind: action.kind,
        title: '工作区文件钉为参考资料',
        summary: `工作区文件钉为参考资料 · ${action.targetLabel || action.title || action.fileId}`,
        targetLabel: action.targetLabel || action.title || action.fileId
      };
    case 'searchReadableContext':
      return {
        kind: action.kind,
        title: '搜索可读上下文',
        summary: `搜索可读入口 “${action.query}”${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel || action.query
      };
    case 'checkProjectPreview':
      return {
        kind: action.kind,
        title: '检查工作区预览',
        summary: `检查工作区入口、资源引用和脚本风险${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'inspectProjectRuntime':
      return {
        kind: action.kind,
        title: '运行工作区预览',
        summary: `运行工作区预览并收集 console${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'promoteCardToProject':
      return {
        kind: action.kind,
        title: '已升为工作区',
        summary: `已升为工作区 · ${action.targetLabel || action.projectTitle || '当前卡片'}`,
        targetLabel: action.targetLabel || action.projectTitle
      };
    case 'patchCodeCard':
      return {
        kind: action.kind,
        title: '已更新房间',
        summary: summarizeCodeCardPatch(action.patch, action.targetLabel),
        targetLabel: action.targetLabel
      };
    case 'appendCodeCard':
      return {
        kind: action.kind,
        title: '已续写房间',
        summary: `${action.targetLabel || '指定房间'} · 追加代码`,
        targetLabel: action.targetLabel
      };
    case 'appendProjectFile':
      return {
        kind: action.kind,
        title: '已续写工作区文件',
        summary: `${action.targetLabel || '指定工作区文件'} · 追加代码`,
        targetLabel: action.targetLabel
      };
    case 'insertProjectFile':
      return {
        kind: action.kind,
        title: '已插入工作区文件',
        summary: `${action.targetLabel || '指定工作区文件'} · 定点插入`,
        targetLabel: action.targetLabel
      };
    case 'replaceProjectFileLines':
      return {
        kind: action.kind,
        title: '已按行替换工作区文件',
        summary: `${action.targetLabel || '指定工作区文件'} · ${action.startLine}${action.endLine ? `-${action.endLine}` : ''} 行`,
        targetLabel: action.targetLabel
      };
    case 'editCodeCardText':
      return {
        kind: action.kind,
        title: '已局部替换房间',
        summary: `${action.targetLabel || '指定房间'} · 局部替换`,
        targetLabel: action.targetLabel
      };
    case 'editProjectFileText':
      return {
        kind: action.kind,
        title: '已局部替换工作区文件',
        summary: `${action.targetLabel || '指定工作区文件'} · 局部替换`,
        targetLabel: action.targetLabel
      };
    case 'deleteProjectFile':
      return {
        kind: action.kind,
        title: '已删除工作区文件',
        summary: `${action.targetLabel || '指定工作区文件'} · 删除文件`,
        targetLabel: action.targetLabel
      };
    case 'listCodeCards':
      return {
        kind: action.kind,
        title: '读取房间卡目录',
        summary: `读取当前协作者房间卡目录${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'readCodeCard':
      return {
        kind: action.kind,
        title: '读取房间',
        summary: `读取房间全文${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'readProjectFile':
      return {
        kind: action.kind,
        title: '读取工作区文件',
        summary: `读取工作区文件全文${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'readProjectFileContext':
      return {
        kind: action.kind,
        title: '读取工作区上下文',
        summary: `读取工作区文件局部上下文${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
  }
}
