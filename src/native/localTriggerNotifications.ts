import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type {
  ActionPerformed,
  DeliveredNotificationSchema,
  LocalNotificationSchema
} from '@capacitor/local-notifications';
import type { Persona, PolarisTriggerRule } from '../types/domain';

const POLARIS_TRIGGER_NOTIFICATION_KIND = 'polaris-trigger-v1';
const POLARIS_TRIGGER_NOTIFICATION_CHANNEL_ID = 'polaris-triggers';
const POLARIS_PROACTIVE_REPLY_NOTIFICATION_KIND = 'polaris-proactive-reply-v1';
const POLARIS_PROACTIVE_REPLY_NOTIFICATION_CHANNEL_ID = 'polaris-proactive-replies-v1';
const TRIGGER_NOTIFICATION_ID_BASE = 100_000;
const TRIGGER_NOTIFICATION_ID_SPAN = 1_900_000_000;
const REPLY_NOTIFICATION_ID_BASE = 2_000_000_000;
const REPLY_NOTIFICATION_ID_SPAN = 100_000_000;

export type NativeTriggerNotificationSyncResult = 'unavailable' | 'denied' | 'exact-denied' | 'synced' | 'failed';

export type NativeTriggerNotificationTap = {
  ruleId: string;
  scheduledFor: number | null;
};

type PolarisTriggerAlarmNotification = {
  id: number;
  title: string;
  body: string;
  ruleId: string;
  scheduledFor: number;
};

type PolarisTriggerAlarmPlugin = {
  sync(options: { notifications: PolarisTriggerAlarmNotification[] }): Promise<{ exactAlarm: 'granted' | 'denied' }>;
  checkExactAlarmSetting(): Promise<{ exactAlarm: 'granted' | 'denied' }>;
  openExactAlarmSettings(): Promise<{ exactAlarm: 'granted' | 'denied' }>;
};

type NativeTriggerNotificationExtra = {
  polarisKind: typeof POLARIS_TRIGGER_NOTIFICATION_KIND;
  ruleId: string;
  scheduledFor: number;
};

type NativeProactiveReplyNotificationExtra = {
  polarisKind: typeof POLARIS_PROACTIVE_REPLY_NOTIFICATION_KIND;
  conversationId: string;
  collaboratorId: string;
  createdAt: number;
};

const PolarisTriggerAlarm = registerPlugin<PolarisTriggerAlarmPlugin>('PolarisTriggerAlarm');

function canUseLocalNotifications() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
}

function shouldUseAndroidNotificationChannel() {
  return canUseLocalNotifications() && Capacitor.getPlatform() === 'android';
}

function canUseAndroidTriggerAlarm() {
  return Capacitor.isNativePlatform()
    && Capacitor.getPlatform() === 'android'
    && Capacitor.isPluginAvailable('PolarisTriggerAlarm');
}

export function resolveTriggerNotificationId(ruleId: string) {
  return resolveStableNotificationId(ruleId, TRIGGER_NOTIFICATION_ID_BASE, TRIGGER_NOTIFICATION_ID_SPAN);
}

export function resolveProactiveReplyNotificationId(conversationId: string) {
  return resolveStableNotificationId(conversationId, REPLY_NOTIFICATION_ID_BASE, REPLY_NOTIFICATION_ID_SPAN);
}

function resolveStableNotificationId(value: string, base: number, span: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return base + (Math.abs(hash) % span);
}

function isTriggerNotificationExtra(value: unknown): value is NativeTriggerNotificationExtra {
  if (!value || typeof value !== 'object') return false;
  const extra = value as Partial<NativeTriggerNotificationExtra>;
  return extra.polarisKind === POLARIS_TRIGGER_NOTIFICATION_KIND
    && typeof extra.ruleId === 'string'
    && typeof extra.scheduledFor === 'number';
}

export function buildNativeTriggerNotifications(
  rules: PolarisTriggerRule[],
  personas: Persona[],
  now = Date.now()
): LocalNotificationSchema[] {
  return rules.flatMap((rule) => {
    if (!rule.enabled || !rule.nextRunAt || rule.nextRunAt <= now) return [];
    const persona = personas.find((entry) => entry.id === rule.target.collaboratorId);
    if (!persona) return [];

    return [{
      id: resolveTriggerNotificationId(rule.id),
      title: `${persona.name} 想找你`,
      body: rule.name,
      schedule: {
        at: new Date(rule.nextRunAt),
        allowWhileIdle: true
      },
      channelId: POLARIS_TRIGGER_NOTIFICATION_CHANNEL_ID,
      extra: {
        polarisKind: POLARIS_TRIGGER_NOTIFICATION_KIND,
        ruleId: rule.id,
        scheduledFor: rule.nextRunAt
      } satisfies NativeTriggerNotificationExtra,
      autoCancel: true,
      threadIdentifier: 'polaris-triggers',
      group: 'polaris-triggers'
    }];
  });
}

function buildAndroidTriggerAlarmNotifications(
  notifications: LocalNotificationSchema[]
): PolarisTriggerAlarmNotification[] {
  return notifications.flatMap((notification) => {
    if (!notification.extra || !isTriggerNotificationExtra(notification.extra)) return [];
    return [{
      id: notification.id,
      title: notification.title ?? 'Polaris',
      body: notification.body ?? '',
      ruleId: notification.extra.ruleId,
      scheduledFor: notification.extra.scheduledFor
    }];
  });
}

export function extractNativeTriggerNotificationTap(action: ActionPerformed): NativeTriggerNotificationTap | null {
  const extra = action.notification.extra;
  if (!isTriggerNotificationExtra(extra)) return null;
  return {
    ruleId: extra.ruleId,
    scheduledFor: extra.scheduledFor
  };
}

function extractNativeTriggerNotificationDelivery(notification: DeliveredNotificationSchema): NativeTriggerNotificationTap | null {
  const extra = notification.extra;
  if (!isTriggerNotificationExtra(extra)) return null;
  return {
    ruleId: extra.ruleId,
    scheduledFor: extra.scheduledFor
  };
}

async function cancelPendingTriggerNotifications() {
  const pending = await LocalNotifications.getPending();
  const notifications = pending.notifications
    .filter((notification) => isTriggerNotificationExtra(notification.extra))
    .map((notification) => ({ id: notification.id }));

  if (notifications.length > 0) {
    await LocalNotifications.cancel({ notifications });
  }
}

export async function consumeDeliveredNativeTriggerNotificationTaps(): Promise<NativeTriggerNotificationTap[]> {
  if (!canUseLocalNotifications()) return [];

  try {
    const delivered = await LocalNotifications.getDeliveredNotifications();
    const notifications = delivered.notifications.filter((notification) =>
      isTriggerNotificationExtra(notification.extra)
    );
    if (notifications.length === 0) return [];

    await LocalNotifications.removeDeliveredNotifications({ notifications });
    return notifications
      .map((notification) => extractNativeTriggerNotificationDelivery(notification))
      .filter((tap): tap is NativeTriggerNotificationTap => Boolean(tap));
  } catch {
    return [];
  }
}

async function ensureTriggerNotificationChannel() {
  if (!shouldUseAndroidNotificationChannel()) return;
  await LocalNotifications.createChannel({
    id: POLARIS_TRIGGER_NOTIFICATION_CHANNEL_ID,
    name: '主动消息',
    description: '协作者按时间主动找你时显示。',
    importance: 4,
    visibility: 1,
    vibration: true
  });
}

async function ensureProactiveReplyNotificationChannel() {
  if (!shouldUseAndroidNotificationChannel()) return;
  await LocalNotifications.createChannel({
    id: POLARIS_PROACTIVE_REPLY_NOTIFICATION_CHANNEL_ID,
    name: '主动回复',
    description: '协作者主动生成回复后显示。',
    importance: 4,
    visibility: 1,
    vibration: true
  });
}

function hasEnabledNativeTriggerRule(rules: PolarisTriggerRule[], personas: Persona[]) {
  return rules.some((rule) =>
    rule.enabled
    && rule.nextRunAt !== null
    && personas.some((entry) => entry.id === rule.target.collaboratorId)
  );
}

export async function syncNativeTriggerNotifications(
  rules: PolarisTriggerRule[],
  personas: Persona[],
  now = Date.now()
): Promise<NativeTriggerNotificationSyncResult> {
  if (!canUseLocalNotifications()) return 'unavailable';

  try {
    const notifications = buildNativeTriggerNotifications(rules, personas, now);
    await cancelPendingTriggerNotifications();
    const hasEnabledRule = hasEnabledNativeTriggerRule(rules, personas);
    if (!hasEnabledRule) {
      if (canUseAndroidTriggerAlarm()) {
        await PolarisTriggerAlarm.sync({ notifications: [] });
      }
      return 'synced';
    }

    const permission = await LocalNotifications.checkPermissions();
    const nextPermission = permission.display === 'granted'
      ? permission
      : await LocalNotifications.requestPermissions();
    if (nextPermission.display !== 'granted') return 'denied';

    if (canUseAndroidTriggerAlarm()) {
      const result = await PolarisTriggerAlarm.sync({
        notifications: buildAndroidTriggerAlarmNotifications(notifications)
      });
      if (notifications.length === 0) return 'synced';
      return result.exactAlarm === 'granted' ? 'synced' : 'exact-denied';
    }
    if (notifications.length === 0) return 'synced';
    let exactAlarmDenied = false;
    if (Capacitor.getPlatform() === 'android' && 'checkExactNotificationSetting' in LocalNotifications) {
      const exactSetting = await LocalNotifications.checkExactNotificationSetting();
      exactAlarmDenied = exactSetting.exact_alarm !== 'granted';
    }
    await ensureTriggerNotificationChannel();
    await LocalNotifications.schedule({ notifications });
    return exactAlarmDenied ? 'exact-denied' : 'synced';
  } catch {
    return 'failed';
  }
}

export async function requestNativeExactAlarmAccess(): Promise<NativeTriggerNotificationSyncResult> {
  if (!canUseLocalNotifications() || Capacitor.getPlatform() !== 'android') return 'unavailable';
  if (canUseAndroidTriggerAlarm()) {
    try {
      const status = await PolarisTriggerAlarm.openExactAlarmSettings();
      return status.exactAlarm === 'granted' ? 'synced' : 'exact-denied';
    } catch {
      return 'failed';
    }
  }
  if (!('changeExactNotificationSetting' in LocalNotifications)) return 'unavailable';

  try {
    const status = await LocalNotifications.changeExactNotificationSetting();
    return status.exact_alarm === 'granted' ? 'synced' : 'exact-denied';
  } catch {
    return 'failed';
  }
}

export async function postNativeProactiveReplyNotification(input: {
  collaboratorId: string;
  collaboratorName: string;
  conversationId: string;
  preview: string;
  createdAt?: number;
}): Promise<NativeTriggerNotificationSyncResult> {
  if (!canUseLocalNotifications() || Capacitor.getPlatform() !== 'android') return 'unavailable';

  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return 'denied';

    await ensureProactiveReplyNotificationChannel();
    const createdAt = input.createdAt ?? Date.now();
    await LocalNotifications.schedule({
      notifications: [{
        id: resolveProactiveReplyNotificationId(input.conversationId),
        title: input.collaboratorName,
        body: input.preview,
        channelId: POLARIS_PROACTIVE_REPLY_NOTIFICATION_CHANNEL_ID,
        extra: {
          polarisKind: POLARIS_PROACTIVE_REPLY_NOTIFICATION_KIND,
          conversationId: input.conversationId,
          collaboratorId: input.collaboratorId,
          createdAt
        } satisfies NativeProactiveReplyNotificationExtra,
        autoCancel: true,
        threadIdentifier: 'polaris-proactive-replies',
        group: 'polaris-proactive-replies'
      }]
    });
    return 'synced';
  } catch {
    return 'failed';
  }
}

export async function registerNativeTriggerNotificationTapListener(
  onTap: (tap: NativeTriggerNotificationTap) => void
): Promise<PluginListenerHandle | null> {
  if (!canUseLocalNotifications()) return null;

  return LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const tap = extractNativeTriggerNotificationTap(action);
    if (tap) onTap(tap);
  });
}
