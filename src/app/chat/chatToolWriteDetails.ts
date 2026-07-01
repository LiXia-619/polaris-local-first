import type { ProjectFileEffect, ToolCodeWriteDetail } from '../../types/domain';
import type { ToolAction } from '../../engines/toolExecutorTypes';

function countLines(value: string | undefined) {
  const text = value?.trim();
  return text ? text.split(/\r\n|\r|\n/).length : 0;
}

function detail(label: string, code: string | undefined, options: {
  language?: string;
  addedLines?: number;
  removedLines?: number;
} = {}): ToolCodeWriteDetail | null {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  const addedLines = options.addedLines ?? countLines(trimmed);
  return {
    label: label.trim() || '写入片段',
    language: options.language,
    code: trimmed,
    addedLines,
    removedLines: options.removedLines ?? 0
  };
}

function wholeFileDelta(effect: ProjectFileEffect | undefined) {
  if (!effect) return null;
  if (effect.operation === 'created') {
    return { addedLines: effect.afterLines ?? 0, removedLines: 0 };
  }
  if (effect.operation === 'overwritten') {
    return {
      addedLines: effect.afterLines ?? 0,
      removedLines: effect.beforeLines ?? 0
    };
  }
  if (effect.operation === 'deleted') {
    return { addedLines: 0, removedLines: effect.beforeLines ?? 0 };
  }
  return null;
}

function withEffectDelta(write: ToolCodeWriteDetail | null, effect: ProjectFileEffect | undefined) {
  if (!write) return null;
  const delta = wholeFileDelta(effect);
  return delta ? { ...write, ...delta } : write;
}

function themeWriteDetail(action: ToolAction): ToolCodeWriteDetail | null {
  if (action.kind === 'patchRawCss' || action.kind === 'appendThemeCss' || action.kind === 'insertThemeCss' || action.kind === 'replaceThemeCss') {
    return detail(action.label ?? 'theme.css', action.css, { language: 'css' });
  }
  if (action.kind === 'editThemeCss') {
    return detail(action.label ?? 'theme.css', action.newString, {
      language: 'css',
      addedLines: countLines(action.newString),
      removedLines: countLines(action.oldString)
    });
  }
  if (action.kind === 'deleteThemeCss') {
    return detail(action.label ?? 'theme.css', action.oldString, {
      language: 'css',
      addedLines: 0,
      removedLines: countLines(action.oldString)
    });
  }
  return null;
}

export function buildToolCodeWriteDetails(
  action: ToolAction,
  effects: readonly ProjectFileEffect[] = []
): ToolCodeWriteDetail[] | undefined {
  const themeDetail = themeWriteDetail(action);
  if (themeDetail) return [themeDetail];

  if (action.kind === 'createCodeCard') {
    const write = detail(action.targetLabel ?? action.card.title ?? '新卡片', action.card.code, {
      language: action.card.language
    });
    return write ? [write] : undefined;
  }
  if (action.kind === 'createProjectFile') {
    const write = withEffectDelta(detail(action.targetLabel ?? action.file.filePath, action.file.code, {
      language: action.file.language
    }), effects[0]);
    return write ? [write] : undefined;
  }
  if (action.kind === 'writeProjectFiles') {
    const writes = action.files
      .map((file, index) => withEffectDelta(
        detail(file.filePath, file.code, { language: file.language }),
        effects.find((effect) => effect.filePath === file.filePath) ?? effects[index]
      ))
      .filter((write): write is ToolCodeWriteDetail => Boolean(write));
    return writes.length ? writes : undefined;
  }
  if (action.kind === 'patchCodeCard' && typeof action.patch.code === 'string') {
    const write = detail(action.targetLabel ?? '卡片代码', action.patch.code, {
      language: action.patch.language
    });
    return write ? [write] : undefined;
  }
  if (action.kind === 'appendCodeCard') {
    const write = detail(action.targetLabel ?? '卡片追加', action.code);
    return write ? [write] : undefined;
  }
  if (action.kind === 'editCodeCardText') {
    const write = detail(action.targetLabel ?? '卡片局部替换', action.newString, {
      addedLines: countLines(action.newString),
      removedLines: countLines(action.oldString)
    });
    return write ? [write] : undefined;
  }
  if (action.kind === 'appendProjectFile' || action.kind === 'insertProjectFile') {
    const write = detail(action.targetLabel ?? '工作区文件', action.code);
    return write ? [write] : undefined;
  }
  if (action.kind === 'replaceProjectFileLines') {
    const write = detail(action.targetLabel ?? '工作区按行替换', action.code);
    return write ? [write] : undefined;
  }
  if (action.kind === 'editProjectFileText') {
    const write = detail(action.targetLabel ?? '工作区局部替换', action.newString, {
      addedLines: countLines(action.newString),
      removedLines: countLines(action.oldString)
    });
    return write ? [write] : undefined;
  }
  return undefined;
}
