import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Persona, PolarisTriggerRule } from '../types/domain';

const mocks = vi.hoisted(() => ({
  localNotifications: {
    getPending: vi.fn(),
    cancel: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    checkExactNotificationSetting: vi.fn(),
    schedule: vi.fn(),
    createChannel: vi.fn(),
    addListener: vi.fn(),
    getDeliveredNotifications: vi.fn(),
    removeDeliveredNotifications: vi.fn(),
    changeExactNotificationSetting: vi.fn()
  },
  triggerAlarm: {
    sync: vi.fn(),
    checkExactAlarmSetting: vi.fn(),
    openExactAlarmSettings: vi.fn()
  }
}));

const capacitorState = {
  isNativePlatform: false,
  platform: 'ios',
  plugins: new Set<string>()
};

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => capacitorState.isNativePlatform,
    getPlatform: () => capacitorState.platform,
    isPluginAvailable: (name: string) => capacitorState.plugins.has(name)
  },
  registerPlugin: vi.fn((name: string) => {
    if (name === 'PolarisTriggerAlarm') return mocks.triggerAlarm;
    return {};
  })
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: mocks.localNotifications
}));

import {
  buildNativeTriggerNotifications,
  consumeDeliveredNativeTriggerNotificationTaps,
  extractNativeTriggerNotificationTap,
  postNativeProactiveReplyNotification,
  requestNativeExactAlarmAccess,
  resolveProactiveReplyNotificationId,
  resolveTriggerNotificationId,
  syncNativeTriggerNotifications
} from './localTriggerNotifications';

const persona: Persona = {
  id: 'nova',
  name: 'Nova'
} as Persona;

function buildRule(patch: Partial<PolarisTriggerRule> = {}): PolarisTriggerRule {
  return {
    id: 'trigger-nova',
    name: '晚安提醒',
    enabled: true,
    source: 'schedule',
    webhookSecret: 'secret',
    schedule: { kind: 'daily', time: '22:30' },
    target: { collaboratorId: 'nova', conversationMode: 'follow-latest', conversationId: null },
    action: { prompt: '来找我说晚安' },
    createdAt: 1,
    updatedAt: 1,
    lastRunAt: null,
    nextRunAt: 2_000,
    lastError: null,
    ...patch
  };
}

describe('buildNativeTriggerNotifications', () => {
  it('builds a dated local notification that points back to the trigger rule', () => {
    const [notification] = buildNativeTriggerNotifications([buildRule()], [persona], 1_000);

    expect(notification).toEqual(expect.objectContaining({
      id: resolveTriggerNotificationId('trigger-nova'),
      title: 'Nova 想找你',
      body: '晚安提醒',
      autoCancel: true,
      extra: {
        polarisKind: 'polaris-trigger-v1',
        ruleId: 'trigger-nova',
        scheduledFor: 2_000
      }
    }));
    expect(notification?.schedule?.at).toEqual(new Date(2_000));
    expect(notification?.schedule?.allowWhileIdle).toBe(true);
  });

  it('uses while-idle delivery for short interval test rules so Android can wake the device', () => {
    const [notification] = buildNativeTriggerNotifications([
      buildRule({ schedule: { kind: 'interval', everyMinutes: 2 } })
    ], [persona], 1_000);

    expect(notification?.schedule?.at).toEqual(new Date(2_000));
    expect(notification?.schedule?.allowWhileIdle).toBe(true);
  });

  it('keeps while-idle delivery for daily and long interval rules', () => {
    const daily = buildRule({ schedule: { kind: 'daily', time: '22:30' } });
    const longInterval = buildRule({ schedule: { kind: 'interval', everyMinutes: 15 } });

    expect(buildNativeTriggerNotifications([daily], [persona], 1_000)[0]?.schedule?.allowWhileIdle).toBe(true);
    expect(buildNativeTriggerNotifications([longInterval], [persona], 1_000)[0]?.schedule?.allowWhileIdle).toBe(true);
  });

  it('does not schedule disabled, overdue, or missing-persona rules', () => {
    const rules = [
      buildRule({ enabled: false }),
      buildRule({ id: 'overdue', nextRunAt: 500 }),
      buildRule({ id: 'missing-persona', target: { collaboratorId: 'ghost', conversationMode: 'follow-latest', conversationId: null } })
    ];

    expect(buildNativeTriggerNotifications(rules, [persona], 1_000)).toEqual([]);
  });
});

describe('extractNativeTriggerNotificationTap', () => {
  it('accepts only Polaris trigger notification payloads', () => {
    expect(extractNativeTriggerNotificationTap({
      actionId: 'tap',
      notification: {
        id: 1,
        title: 'Nova',
        body: '晚安提醒',
        extra: {
          polarisKind: 'polaris-trigger-v1',
          ruleId: 'trigger-nova',
          scheduledFor: 2_000
        }
      }
    })).toEqual({
      ruleId: 'trigger-nova',
      scheduledFor: 2_000
    });

    expect(extractNativeTriggerNotificationTap({
      actionId: 'tap',
      notification: {
        id: 2,
        title: 'Other',
        body: 'Other'
      }
    })).toBeNull();
  });
});

describe('syncNativeTriggerNotifications', () => {
  beforeEach(() => {
    capacitorState.isNativePlatform = true;
    capacitorState.platform = 'ios';
    capacitorState.plugins = new Set(['LocalNotifications']);
    mocks.localNotifications.getPending.mockResolvedValue({ notifications: [] });
    mocks.localNotifications.cancel.mockResolvedValue(undefined);
    mocks.localNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
    mocks.localNotifications.requestPermissions.mockResolvedValue({ display: 'granted' });
    mocks.localNotifications.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
    mocks.localNotifications.changeExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
    mocks.localNotifications.schedule.mockResolvedValue({ notifications: [] });
    mocks.localNotifications.createChannel.mockResolvedValue(undefined);
    mocks.localNotifications.addListener.mockResolvedValue({ remove: vi.fn() });
    mocks.localNotifications.getDeliveredNotifications.mockResolvedValue({ notifications: [] });
    mocks.localNotifications.removeDeliveredNotifications.mockResolvedValue(undefined);
    mocks.triggerAlarm.sync.mockResolvedValue({ exactAlarm: 'granted' });
    mocks.triggerAlarm.checkExactAlarmSetting.mockResolvedValue({ exactAlarm: 'granted' });
    mocks.triggerAlarm.openExactAlarmSettings.mockResolvedValue({ exactAlarm: 'granted' });
    vi.clearAllMocks();
  });

  it('is a no-op outside native local notification builds', async () => {
    capacitorState.isNativePlatform = false;

    await expect(syncNativeTriggerNotifications([buildRule()], [persona], 1_000)).resolves.toBe('unavailable');
    expect(mocks.localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('cancels previous Polaris trigger notifications before scheduling the current rules', async () => {
    mocks.localNotifications.getPending.mockResolvedValue({
      notifications: [
        {
          id: 11,
          title: 'Old',
          body: 'Old',
          extra: {
            polarisKind: 'polaris-trigger-v1',
            ruleId: 'old-rule',
            scheduledFor: 1_500
          }
        },
        {
          id: 12,
          title: 'Other',
          body: 'Other'
        }
      ]
    });

    await expect(syncNativeTriggerNotifications([buildRule()], [persona], 1_000)).resolves.toBe('synced');

    expect(mocks.localNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 11 }] });
    expect(mocks.localNotifications.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          body: '晚安提醒',
          channelId: 'polaris-triggers',
          extra: expect.objectContaining({
            ruleId: 'trigger-nova'
          })
        })
      ]
    });
  });

  it('requests notification permission for enabled rules even when the current run is already due', async () => {
    mocks.localNotifications.checkPermissions.mockResolvedValue({ display: 'prompt' });

    await expect(syncNativeTriggerNotifications([buildRule({ nextRunAt: 500 })], [persona], 1_000)).resolves.toBe('synced');

    expect(mocks.localNotifications.checkPermissions).toHaveBeenCalled();
    expect(mocks.localNotifications.requestPermissions).toHaveBeenCalled();
    expect(mocks.localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('delegates Android trigger notification timing to the native alarm bridge', async () => {
    capacitorState.platform = 'android';
    capacitorState.plugins = new Set(['LocalNotifications', 'PolarisTriggerAlarm']);

    await expect(syncNativeTriggerNotifications([buildRule()], [persona], 1_000)).resolves.toBe('synced');

    expect(mocks.triggerAlarm.sync).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: resolveTriggerNotificationId('trigger-nova'),
          title: 'Nova 想找你',
          body: '晚安提醒',
          ruleId: 'trigger-nova',
          scheduledFor: 2_000
        })
      ]
    });
    expect(mocks.localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('clears Android native trigger alarms when rules are disabled', async () => {
    capacitorState.platform = 'android';
    capacitorState.plugins = new Set(['LocalNotifications', 'PolarisTriggerAlarm']);

    await expect(syncNativeTriggerNotifications([buildRule({ enabled: false })], [persona], 1_000)).resolves.toBe('synced');

    expect(mocks.triggerAlarm.sync).toHaveBeenCalledWith({
      notifications: []
    });
    expect(mocks.localNotifications.requestPermissions).not.toHaveBeenCalled();
  });

  it('reports Android trigger alarms as exact-denied when the native alarm bridge lacks exact access', async () => {
    capacitorState.platform = 'android';
    capacitorState.plugins = new Set(['LocalNotifications', 'PolarisTriggerAlarm']);
    mocks.triggerAlarm.sync.mockResolvedValue({ exactAlarm: 'denied' });

    await expect(syncNativeTriggerNotifications([buildRule()], [persona], 1_000)).resolves.toBe('exact-denied');

    expect(mocks.triggerAlarm.sync).toHaveBeenCalled();
    expect(mocks.localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('can open the Android exact alarm settings flow', async () => {
    capacitorState.platform = 'android';
    capacitorState.plugins = new Set(['LocalNotifications', 'PolarisTriggerAlarm']);

    await expect(requestNativeExactAlarmAccess()).resolves.toBe('synced');

    expect(mocks.triggerAlarm.openExactAlarmSettings).toHaveBeenCalled();
    expect(mocks.localNotifications.changeExactNotificationSetting).not.toHaveBeenCalled();
  });

  it('reports when Android exact alarm settings remain disabled', async () => {
    capacitorState.platform = 'android';
    capacitorState.plugins = new Set(['LocalNotifications', 'PolarisTriggerAlarm']);
    mocks.triggerAlarm.openExactAlarmSettings.mockResolvedValue({ exactAlarm: 'denied' });

    await expect(requestNativeExactAlarmAccess()).resolves.toBe('exact-denied');
  });

  it('posts Android proactive reply notifications on a separate alert channel', async () => {
    capacitorState.platform = 'android';

    await expect(postNativeProactiveReplyNotification({
      collaboratorId: 'nova',
      collaboratorName: 'Nova',
      conversationId: 'conversation-1',
      preview: '我在这里。'
    })).resolves.toBe('synced');

    expect(mocks.localNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.localNotifications.createChannel).toHaveBeenCalledWith(expect.objectContaining({
      id: 'polaris-proactive-replies-v1',
      importance: 4,
      visibility: 1,
      vibration: true
    }));
    expect(mocks.localNotifications.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: resolveProactiveReplyNotificationId('conversation-1'),
          title: 'Nova',
          body: '我在这里。',
          channelId: 'polaris-proactive-replies-v1',
          extra: expect.objectContaining({
            polarisKind: 'polaris-proactive-reply-v1',
            conversationId: 'conversation-1',
            collaboratorId: 'nova'
          })
        })
      ]
    });
  });

  it('does not prompt again when Android proactive reply notification permission is missing', async () => {
    capacitorState.platform = 'android';
    mocks.localNotifications.checkPermissions.mockResolvedValue({ display: 'denied' });

    await expect(postNativeProactiveReplyNotification({
      collaboratorId: 'nova',
      collaboratorName: 'Nova',
      conversationId: 'conversation-1',
      preview: '我在这里。'
    })).resolves.toBe('denied');

    expect(mocks.localNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('consumes delivered Polaris notifications so app resume can trigger generation', async () => {
    mocks.localNotifications.getDeliveredNotifications.mockResolvedValue({
      notifications: [
        {
          id: 21,
          title: 'Nova 想找你',
          body: '晚安提醒',
          extra: {
            polarisKind: 'polaris-trigger-v1',
            ruleId: 'trigger-nova',
            scheduledFor: 2_000
          }
        },
        {
          id: 22,
          title: 'Other',
          body: 'Other'
        }
      ]
    });

    await expect(consumeDeliveredNativeTriggerNotificationTaps()).resolves.toEqual([{
      ruleId: 'trigger-nova',
      scheduledFor: 2_000
    }]);
    expect(mocks.localNotifications.removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 21
        })
      ]
    });
  });
});
