import { describe, expect, it } from 'vitest';
import { buildTriggerShortcutUrl, parseTriggerShortcutUrl } from './triggerShortcutUrl';

describe('trigger shortcut urls', () => {
  it('builds a Polaris trigger url for shortcuts', () => {
    expect(buildTriggerShortcutUrl('trigger-1')).toBe('polaris://trigger?id=trigger-1');
  });

  it('parses custom scheme trigger urls', () => {
    expect(parseTriggerShortcutUrl('polaris://trigger?id=trigger-1')).toEqual({ ruleId: 'trigger-1', prompt: null });
    expect(parseTriggerShortcutUrl('polaris://trigger/trigger-2')).toEqual({ ruleId: 'trigger-2', prompt: null });
  });

  it('parses dynamic shortcut text', () => {
    expect(parseTriggerShortcutUrl('polaris://trigger?id=trigger-1&text=%E4%BB%8A%E5%A4%A9%E4%B8%8B%E9%9B%A8')).toEqual({
      ruleId: 'trigger-1',
      prompt: '今天下雨'
    });
  });

  it('parses web query fallback urls', () => {
    expect(parseTriggerShortcutUrl('https://polaris.example.com/?polarisTrigger=trigger-3')).toEqual({ ruleId: 'trigger-3', prompt: null });
  });

  it('ignores unrelated urls', () => {
    expect(parseTriggerShortcutUrl('polaris://settings?id=trigger-1')).toBeNull();
    expect(parseTriggerShortcutUrl('https://polaris.example.com/')).toBeNull();
  });
});
