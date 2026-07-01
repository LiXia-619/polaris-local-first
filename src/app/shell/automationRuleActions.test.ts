import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../i18n';
import type { Persona, PolarisCompanionHostState, PolarisTriggerRule } from '../../types/domain';
import {
  copyAutomationTriggerUrl,
  createAutomationRuleForCollaborator,
  deleteAutomationRuleWithConfirmation,
  updateAutomationRuleForCollaborator
} from './automationRuleActions';

const persona = {
  id: 'nova',
  name: 'Nova'
} as Persona;

const companionHost = {
  enabled: false,
  relayUrl: '',
  hostId: null
} as PolarisCompanionHostState;

const zhCopy = createTranslator('zh-CN');
const enCopy = createTranslator('en-US');

function buildRule(patch: Partial<PolarisTriggerRule> = {}): PolarisTriggerRule {
  return {
    id: 'trigger-1',
    name: '晚安',
    enabled: true,
    source: 'schedule',
    webhookSecret: 'secret-1',
    schedule: { kind: 'daily', time: '22:30' },
    target: { collaboratorId: 'nova', conversationMode: 'fixed', conversationId: 'conv-1' },
    action: { prompt: '来找我说晚安' },
    createdAt: 1,
    updatedAt: 1,
    lastRunAt: null,
    nextRunAt: 2,
    lastError: null,
    ...patch
  };
}

describe('automationRuleActions', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a named schedule rule for the selected collaborator', () => {
    const alert = vi.fn();
    const createTriggerRule = vi.fn(() => 'trigger-1');

    const id = createAutomationRuleForCollaborator({
      seed: {
        collaboratorId: 'nova',
        schedule: { kind: 'daily', time: '22:30' },
        prompt: ' 来找我说晚安 '
      },
      personas: [persona],
      createTriggerRule,
      ui: { alert },
      copy: zhCopy
    });

    expect(id).toBe('trigger-1');
    expect(alert).not.toHaveBeenCalled();
    expect(createTriggerRule).toHaveBeenCalledWith({
      name: 'Nova · 每天 22:30',
      schedule: { kind: 'daily', time: '22:30' },
      target: { collaboratorId: 'nova', conversationMode: 'follow-latest', conversationId: null },
      action: { prompt: '来找我说晚安' }
    });
  });

  it('preserves existing rule target fields while changing collaborator', () => {
    const updateTriggerRule = vi.fn();

    updateAutomationRuleForCollaborator({
      ruleId: 'trigger-1',
      patch: { target: { collaboratorId: 'pharos', conversationMode: 'follow-latest', conversationId: null } },
      triggerRules: [buildRule()],
      personas: [persona, { id: 'pharos', name: 'Pharos' } as Persona],
      updateTriggerRule,
      ui: { alert: vi.fn() },
      copy: zhCopy
    });

    expect(updateTriggerRule).toHaveBeenCalledWith('trigger-1', {
      target: { collaboratorId: 'pharos', conversationMode: 'follow-latest', conversationId: null }
    });
  });

  it('confirms before deleting an existing rule', () => {
    const deleteTriggerRule = vi.fn();

    deleteAutomationRuleWithConfirmation({
      ruleId: 'trigger-1',
      triggerRules: [buildRule()],
      deleteTriggerRule,
      ui: { confirm: vi.fn(() => false) },
      copy: zhCopy
    });

    expect(deleteTriggerRule).not.toHaveBeenCalled();
  });

  it('copies shortcut URLs when no relay host is configured', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const alert = vi.fn();

    await copyAutomationTriggerUrl({
      ruleId: 'trigger-1',
      triggerRules: [buildRule()],
      companionHost,
      ui: { alert },
      copy: zhCopy
    });

    expect(writeText).toHaveBeenCalledWith('polaris://trigger?id=trigger-1');
    expect(alert).toHaveBeenCalledWith('已复制快捷指令链接。');
  });

  it('localizes automation action feedback from the active language', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const alert = vi.fn();

    await copyAutomationTriggerUrl({
      ruleId: 'trigger-1',
      triggerRules: [buildRule()],
      companionHost,
      ui: { alert },
      copy: enCopy
    });

    expect(alert).toHaveBeenCalledWith('Shortcut link copied.');
  });
});
