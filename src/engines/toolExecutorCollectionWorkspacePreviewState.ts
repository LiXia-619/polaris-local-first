import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';

const PREVIEW_FORM_KEY = '__polarisForm';
const PREVIEW_LOCAL_STORAGE_KEY = '__polarisStorage';
const PREVIEW_SESSION_STORAGE_KEY = '__polarisSessionStorage';

export type CollectionWorkspacePreviewStateAction = Extract<
  ToolAction,
  { kind: 'readWorkspacePreviewState' }
>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function sortedObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function countEntries(value: Record<string, unknown>) {
  return Object.keys(value).length;
}

function formatSection(title: string, value: Record<string, unknown>) {
  return [
    `${title}：${countEntries(value)} 项`,
    countEntries(value) > 0 ? JSON.stringify(sortedObject(value), null, 2) : '{}'
  ].join('\n');
}

function collectExplicitPolarisRoomState(state: Record<string, unknown>) {
  const reservedKeys = new Set([
    PREVIEW_FORM_KEY,
    PREVIEW_LOCAL_STORAGE_KEY,
    PREVIEW_SESSION_STORAGE_KEY
  ]);
  return Object.fromEntries(
    Object.entries(state)
      .filter(([key]) => !reservedKeys.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export async function executeCollectionWorkspacePreviewStateAction(
  action: CollectionWorkspacePreviewStateAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  const project = ctx.readRoomProject(action.projectId);
  if (!project) {
    return { ok: false, error: '没有找到当前工作区。' };
  }
  if (project.previewStateAccess?.assistantReadEnabled !== true) {
    return { ok: false, error: '这个工作区没有允许协作者读取预览状态。请先在工作区设置里打开权限。' };
  }

  const roomId = `project:${project.id}`;
  const state = await ctx.readCodeCardState(roomId);
  const explicitState = collectExplicitPolarisRoomState(state);
  const localStorageState = asRecord(state[PREVIEW_LOCAL_STORAGE_KEY]);
  const sessionStorageState = asRecord(state[PREVIEW_SESSION_STORAGE_KEY]);
  const formState = asRecord(state[PREVIEW_FORM_KEY]);
  const totalEntries =
    countEntries(explicitState)
    + countEntries(localStorageState)
    + countEntries(sessionStorageState)
    + countEntries(formState);

  return {
    ok: true,
    summary: `已读取工作区预览状态 · ${project.title} · ${totalEntries} 项`,
    detailText: [
      `工作区：${project.title}`,
      `工作区 id：${project.id}`,
      `预览 room：${roomId}`,
      '',
      formatSection('PolarisRoom 显式状态', explicitState),
      '',
      formatSection('预览 localStorage', localStorageState),
      '',
      formatSection('预览 sessionStorage', sessionStorageState),
      '',
      formatSection('自动保存表单字段', formState)
    ].join('\n'),
    roomProjectId: project.id
  };
}
