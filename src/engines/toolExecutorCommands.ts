import type { ToolCommandResult } from './toolExecutorTypes';

export type ToolCommandGroupId = 'conversation' | 'switching' | 'capture' | 'advanced';

export type ToolCommandSuggestion = {
  command: string;
  insertText: string;
  description: string;
  group: ToolCommandGroupId;
  developerOnly?: boolean;
};

export const TOOL_COMMAND_SUGGESTIONS: ToolCommandSuggestion[] = [
  {
    command: '/retry',
    insertText: '/retry ',
    description: '重跑上一条回复，可补一句要求',
    group: 'conversation'
  },
  {
    command: '/undo',
    insertText: '/undo',
    description: '撤回最后一轮用户和助手消息',
    group: 'conversation'
  },
  {
    command: '/fork',
    insertText: '/fork',
    description: '从当前对话分叉一条新线',
    group: 'conversation'
  },
  {
    command: '/pin',
    insertText: '/pin',
    description: '置顶或取消置顶当前对话',
    group: 'conversation'
  },
  {
    command: '/rename',
    insertText: '/rename ',
    description: '重命名当前对话',
    group: 'conversation'
  },
  {
    command: '/export',
    insertText: '/export ',
    description: '把当前对话导出成 markdown/json 卡片',
    group: 'conversation'
  },
  {
    command: '/persona',
    insertText: '/persona ',
    description: '按名字切换人格',
    group: 'switching'
  },
  {
    command: '/model',
    insertText: '/model ',
    description: '切换当前线路的模型；不填则打开设置',
    group: 'switching'
  },
  {
    command: '/provider',
    insertText: '/provider ',
    description: '按线路名切换供应商；不填则打开设置',
    group: 'switching'
  },
  {
    command: '/workspace',
    insertText: '/workspace ',
    description: '按项目名绑定工作区',
    group: 'switching'
  },
  {
    command: '/workspace exit',
    insertText: '/workspace exit',
    description: '退出当前对话绑定的工作区',
    group: 'switching'
  },
  {
    command: '/save card',
    insertText: '/save card',
    description: '把上一条回复里的代码块存成卡片',
    group: 'capture'
  },
  {
    command: '/save note',
    insertText: '/save note',
    description: '把上一条回复存成笔记卡',
    group: 'capture'
  },
  {
    command: '/remember',
    insertText: '/remember ',
    description: '把一句话存成当前角色笔记卡',
    group: 'capture'
  },
  {
    command: '/task',
    insertText: '/task ',
    description: '用后面的文字直接开启一个任务',
    group: 'advanced'
  },
  {
    command: '/ctx',
    insertText: '/ctx',
    description: '查看当前人格、工作区、工具和任务状态',
    group: 'advanced'
  },
  {
    command: '/debug last',
    insertText: '/debug last',
    description: '打开上一轮请求调试记录',
    group: 'advanced',
    developerOnly: true
  },
  {
    command: '/qa long',
    insertText: '/qa long',
    description: '在 Polaris 里跑一条多阶段长任务 QA',
    group: 'advanced',
    developerOnly: true
  },
  {
    command: '/qa env',
    insertText: '/qa env',
    description: '跑工作区环境契约 QA，按工具链路定位问题',
    group: 'advanced',
    developerOnly: true
  },
  {
    command: '/qa env report',
    insertText: '/qa env report',
    description: '把最近一次环境契约 QA 报告存成可读卡片',
    group: 'advanced',
    developerOnly: true
  },
  {
    command: '/preset',
    insertText: '/preset ',
    description: '应用主题预设 id',
    group: 'advanced'
  },
  {
    command: '/css',
    insertText: '/css {"css":""}',
    description: '直接提交一段主题 CSS',
    group: 'advanced'
  }
];

export function getToolCommandSuggestions(options: {
  includeDeveloperCommands?: boolean;
} = {}) {
  return TOOL_COMMAND_SUGGESTIONS.filter((item) =>
    options.includeDeveloperCommands || item.developerOnly !== true
  );
}

export function isDeveloperOnlyToolCommandResult(result: ToolCommandResult) {
  if (!result?.ok || !('command' in result)) return false;
  return result.command.kind === 'showLastDebug'
    || result.command.kind === 'runLongWorkflowQa'
    || result.command.kind === 'runEnvironmentContractQa'
    || result.command.kind === 'showEnvironmentContractQaReport';
}

function parseJsonSuffix(input: string) {
  const jsonStart = input.indexOf('{');
  if (jsonStart === -1) return null;
  try {
    return JSON.parse(input.slice(jsonStart)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseToolCommand(input: string): ToolCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const [command, ...rest] = trimmed.slice(1).split(/\s+/);
  const normalizedCommand = command.toLowerCase();
  const firstArg = rest[0]?.toLowerCase();

  switch (normalizedCommand) {
    case 'retry': {
      const instruction = rest.join(' ').trim();
      return { ok: true, command: { kind: 'retryLatestAssistant', instruction: instruction || undefined } };
    }
    case 'undo':
      return { ok: true, command: { kind: 'undoLatestTurn' } };
    case 'fork':
      return { ok: true, command: { kind: 'forkConversation' } };
    case 'pin':
      return { ok: true, command: { kind: 'toggleConversationPin' } };
    case 'rename': {
      const title = rest.join(' ').trim();
      if (!title) return { ok: false, error: '用法：/rename <新名字>' };
      return { ok: true, command: { kind: 'renameConversation', title } };
    }
    case 'export': {
      if (!firstArg) return { ok: true, command: { kind: 'exportConversation', format: 'markdown' } };
      if (firstArg === 'md' || firstArg === 'markdown') {
        return { ok: true, command: { kind: 'exportConversation', format: 'markdown' } };
      }
      if (firstArg === 'json') {
        return { ok: true, command: { kind: 'exportConversation', format: 'json' } };
      }
      return { ok: false, error: '用法：/export markdown 或 /export json' };
    }
    case 'persona': {
      const name = rest.join(' ').trim();
      if (!name) return { ok: false, error: '用法：/persona <名字>' };
      return { ok: true, command: { kind: 'switchPersona', name } };
    }
    case 'model': {
      const model = rest.join(' ').trim();
      if (!model) return { ok: true, command: { kind: 'openProviderSettings' } };
      return { ok: true, command: { kind: 'setActiveModel', model } };
    }
    case 'provider': {
      const query = rest.join(' ').trim();
      if (!query) return { ok: true, command: { kind: 'openProviderSettings' } };
      return { ok: true, command: { kind: 'switchProvider', query } };
    }
    case 'providers':
      return { ok: true, command: { kind: 'openProviderSettings' } };
    case 'save': {
      if (firstArg === 'card' || firstArg === 'code') {
        return { ok: true, command: { kind: 'saveLatestCodeCard' } };
      }
      if (firstArg === 'note' || firstArg === 'memo') {
        const note = rest.slice(1).join(' ').trim();
        return { ok: true, command: { kind: 'saveLatestNote', note: note || undefined } };
      }
      return { ok: false, error: '用法：/save card 或 /save note' };
    }
    case 'task': {
      const goal = rest.join(' ').trim();
      if (!goal) return { ok: false, error: '用法：/task <目标>' };
      return { ok: true, command: { kind: 'startTask', goal } };
    }
    case 'ctx':
    case 'context':
      return { ok: true, command: { kind: 'showContext' } };
    case 'debug': {
      if (firstArg !== 'last' && firstArg !== 'latest' && firstArg !== '上一轮') {
        return { ok: false, error: '用法：/debug last' };
      }
      return { ok: true, command: { kind: 'showLastDebug' } };
    }
    case 'qa': {
      if (firstArg === 'long' || firstArg === '长任务') {
        return { ok: true, command: { kind: 'runLongWorkflowQa' } };
      }
      if (firstArg === 'env' || firstArg === 'environment' || firstArg === '环境') {
        const secondArg = rest[1]?.toLowerCase();
        if (secondArg === 'report' || secondArg === 'last' || secondArg === 'latest' || secondArg === '报告') {
          return { ok: true, command: { kind: 'showEnvironmentContractQaReport' } };
        }
        return { ok: true, command: { kind: 'runEnvironmentContractQa' } };
      }
      return { ok: false, error: '用法：/qa long 或 /qa env' };
    }
    case 'remember':
    case 'memo': {
      const note = rest.join(' ').trim();
      if (!note) return { ok: false, error: '用法：/remember <内容>' };
      return { ok: true, command: { kind: 'rememberNote', note } };
    }
    case 'workspace':
    case 'ws': {
      if (firstArg !== 'exit' && firstArg !== 'leave' && firstArg !== 'close' && firstArg !== '退出') {
        const projectName = rest.join(' ').trim();
        if (!projectName) return { ok: false, error: '用法：/workspace <项目名> 或 /workspace exit' };
        return { ok: true, command: { kind: 'bindWorkspace', projectName } };
      }
      return { ok: true, command: { kind: 'exitWorkspace' } };
    }
    case 'preset': {
      const presetId = rest.join(' ').trim();
      return presetId ? { ok: true, action: { kind: 'applyPreset', presetId } } : { ok: false, error: '请提供 presetId。' };
    }
    case 'css': {
      const payload = parseJsonSuffix(trimmed);
      if (!payload || typeof payload.css !== 'string') {
        return { ok: false, error: '用 /css 时请提供 {"css":"完整 CSS 规则"}。' };
      }
      return {
        ok: true,
        action: {
          kind: 'appendThemeCss',
          css: payload.css,
          label: typeof payload.label === 'string' ? payload.label : undefined
        }
      };
    }
    default:
      return {
        ok: false,
        error: `没有 /${normalizedCommand || '?'} 指令。输入 / 会显示可用指令；如果只是想发送斜杠开头的文字，用 // 开头。`
      };
  }
}
