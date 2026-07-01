import { describe, expect, it } from 'vitest';
import {
  getToolCommandSuggestions,
  parseToolCommand,
  TOOL_COMMAND_SUGGESTIONS
} from './toolExecutorCommands';

describe('parseToolCommand', () => {
  it('ignores normal chat text', () => {
    expect(parseToolCommand('你好 /retry')).toBeNull();
  });

  it('exports visible suggestions for each documented command family', () => {
    expect(getToolCommandSuggestions().map((item) => item.command)).toEqual([
      '/retry',
      '/undo',
      '/fork',
      '/pin',
      '/rename',
      '/export',
      '/persona',
      '/model',
      '/provider',
      '/workspace',
      '/workspace exit',
      '/save card',
      '/save note',
      '/remember',
      '/task',
      '/ctx',
      '/preset',
      '/css'
    ]);
    const visibleCommands = getToolCommandSuggestions().map((item) => item.command);
    expect(getToolCommandSuggestions({ includeDeveloperCommands: true }).map((item) => item.command)).toEqual([
      ...visibleCommands.slice(0, 16),
      '/debug last',
      '/qa long',
      '/qa env',
      '/qa env report',
      ...visibleCommands.slice(16)
    ]);
    expect(TOOL_COMMAND_SUGGESTIONS.every((item) => item.description.length > 0)).toBe(true);
  });

  it('parses local workflow commands', () => {
    expect(parseToolCommand('/retry 短一点')).toEqual({
      ok: true,
      command: { kind: 'retryLatestAssistant', instruction: '短一点' }
    });
    expect(parseToolCommand('/fork')).toEqual({
      ok: true,
      command: { kind: 'forkConversation' }
    });
    expect(parseToolCommand('/undo')).toEqual({
      ok: true,
      command: { kind: 'undoLatestTurn' }
    });
    expect(parseToolCommand('/pin')).toEqual({
      ok: true,
      command: { kind: 'toggleConversationPin' }
    });
    expect(parseToolCommand('/rename 新名字')).toEqual({
      ok: true,
      command: { kind: 'renameConversation', title: '新名字' }
    });
    expect(parseToolCommand('/export json')).toEqual({
      ok: true,
      command: { kind: 'exportConversation', format: 'json' }
    });
    expect(parseToolCommand('/save card')).toEqual({
      ok: true,
      command: { kind: 'saveLatestCodeCard' }
    });
  });

  it('parses context, task, debug, and note commands', () => {
    expect(parseToolCommand('/task 整理这个工作区')).toEqual({
      ok: true,
      command: { kind: 'startTask', goal: '整理这个工作区' }
    });
    expect(parseToolCommand('/ctx')).toEqual({ ok: true, command: { kind: 'showContext' } });
    expect(parseToolCommand('/debug last')).toEqual({ ok: true, command: { kind: 'showLastDebug' } });
    expect(parseToolCommand('/qa long')).toEqual({ ok: true, command: { kind: 'runLongWorkflowQa' } });
    expect(parseToolCommand('/qa env')).toEqual({ ok: true, command: { kind: 'runEnvironmentContractQa' } });
    expect(parseToolCommand('/qa env report')).toEqual({ ok: true, command: { kind: 'showEnvironmentContractQaReport' } });
    expect(parseToolCommand('/remember 她喜欢透明一点的界面')).toEqual({
      ok: true,
      command: { kind: 'rememberNote', note: '她喜欢透明一点的界面' }
    });
    expect(parseToolCommand('/workspace exit')).toEqual({
      ok: true,
      command: { kind: 'exitWorkspace' }
    });
    expect(parseToolCommand('/workspace 画册')).toEqual({
      ok: true,
      command: { kind: 'bindWorkspace', projectName: '画册' }
    });
    expect(parseToolCommand('/persona Nova')).toEqual({
      ok: true,
      command: { kind: 'switchPersona', name: 'Nova' }
    });
    expect(parseToolCommand('/model')).toEqual({
      ok: true,
      command: { kind: 'openProviderSettings' }
    });
    expect(parseToolCommand('/model claude-sonnet-4-5')).toEqual({
      ok: true,
      command: { kind: 'setActiveModel', model: 'claude-sonnet-4-5' }
    });
    expect(parseToolCommand('/provider')).toEqual({
      ok: true,
      command: { kind: 'openProviderSettings' }
    });
    expect(parseToolCommand('/provider OpenRouter')).toEqual({
      ok: true,
      command: { kind: 'switchProvider', query: 'OpenRouter' }
    });
  });

  it('keeps automation setup out of chat commands', () => {
    expect(TOOL_COMMAND_SUGGESTIONS.map((item) => item.command)).not.toContain('/trigger');
    expect(parseToolCommand('/trigger list')).toEqual({
      ok: false,
      error: '没有 /trigger 指令。输入 / 会显示可用指令；如果只是想发送斜杠开头的文字，用 // 开头。'
    });
  });

  it('keeps tool-action commands available', () => {
    expect(parseToolCommand('/preset dawn')).toEqual({
      ok: true,
      action: { kind: 'applyPreset', presetId: 'dawn' }
    });
    expect(parseToolCommand('/css {"css":"body{}","label":"测试"}')).toEqual({
      ok: true,
      action: { kind: 'appendThemeCss', css: 'body{}', label: '测试' }
    });
  });

  it('returns an actionable error for unknown slash commands', () => {
    const result = parseToolCommand('/不存在');

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('输入 /')
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('//')
    });
  });
});
