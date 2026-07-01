import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  consumeDeliveredNativeTriggerNotificationTaps,
  registerNativeTriggerNotificationTapListener,
  requestNativeExactAlarmAccess,
  syncNativeTriggerNotifications,
  type NativeTriggerNotificationTap
} from '../../native/localTriggerNotifications';
import { useRuntimeStore } from '../../stores/runtimeStore';
import { useSpaceStore } from '../../stores/spaceStore';
import type { Persona, PolarisTriggerRule } from '../../types/domain';

type UseNativeTriggerNotificationsArgs = {
  startupReady: boolean;
  personas: Persona[];
  triggerRules: PolarisTriggerRule[];
  setCommandStatus: (text: string, isError?: boolean) => void;
};

function shouldIgnoreAlreadyGeneratedTap(rule: PolarisTriggerRule, tap: NativeTriggerNotificationTap) {
  return tap.scheduledFor !== null && rule.lastRunAt !== null && rule.lastRunAt >= tap.scheduledFor - 1_000;
}

function resolveTapKey(tap: NativeTriggerNotificationTap) {
  return `${tap.ruleId}:${tap.scheduledFor ?? 'unknown'}`;
}

function resolveTapKeyExpiry(tap: NativeTriggerNotificationTap, now = Date.now()) {
  return (tap.scheduledFor ?? now) + 24 * 60 * 60_000;
}

function pruneHandledTapKeys(keys: Map<string, number>, now = Date.now()) {
  keys.forEach((expiresAt, key) => {
    if (expiresAt <= now) {
      keys.delete(key);
    }
  });
}

export function useNativeTriggerNotifications({
  startupReady,
  personas,
  triggerRules,
  setCommandStatus
}: UseNativeTriggerNotificationsArgs) {
  const lastSyncStatusRef = useRef<string | null>(null);
  const handledTapKeysRef = useRef<Map<string, number>>(new Map());
  const exactAlarmPromptedRef = useRef(false);

  const handleTriggerTap = (tap: NativeTriggerNotificationTap) => {
    const now = Date.now();
    pruneHandledTapKeys(handledTapKeysRef.current, now);
    const tapKey = resolveTapKey(tap);
    const existingExpiry = handledTapKeysRef.current.get(tapKey) ?? 0;
    if (existingExpiry > now) return;
    handledTapKeysRef.current.set(tapKey, resolveTapKeyExpiry(tap, now));

    const runtimeState = useRuntimeStore.getState();
    const rule = runtimeState.triggerRules.find((entry) => entry.id === tap.ruleId) ?? null;
    if (!rule) {
      setCommandStatus('这条主动消息已经被删除。', true);
      return;
    }

    useSpaceStore.getState().setWorld('chat');

    if (shouldIgnoreAlreadyGeneratedTap(rule, tap)) {
      setCommandStatus(`这条主动消息已经生成过了：${rule.name}`);
      return;
    }

    runtimeState.enqueueTriggerEvent({ ruleId: rule.id, source: 'notification' });
    runtimeState.updateTriggerRule(rule.id, {
      enabled: true,
      nextRunAt: Date.now(),
      lastError: null
    });
    setCommandStatus(`已收到通知：${rule.name}`);
  };

  useEffect(() => {
    if (!startupReady) return;
    let cancelled = false;

    void syncNativeTriggerNotifications(triggerRules, personas).then((status) => {
      if (cancelled || status === 'synced' || status === 'unavailable') return;
      const statusKey = `${status}:${triggerRules.filter((rule) => rule.enabled).length}`;
      if (lastSyncStatusRef.current === statusKey) return;
      lastSyncStatusRef.current = statusKey;
      if (
        status === 'exact-denied'
        && !exactAlarmPromptedRef.current
        && Capacitor.getPlatform() === 'android'
        && typeof window !== 'undefined'
      ) {
        exactAlarmPromptedRef.current = true;
        window.setTimeout(() => {
          if (cancelled) return;
          const shouldOpenSettings = window.confirm(
            'Android 精确闹钟没有开启，主动消息可能等到你打开 App 才会运行。现在打开系统设置授权？'
          );
          if (!shouldOpenSettings) return;
          void requestNativeExactAlarmAccess().then((nextStatus) => {
            if (cancelled) return;
            if (nextStatus === 'synced') {
              void syncNativeTriggerNotifications(triggerRules, personas);
              setCommandStatus('精确闹钟已授权，主动消息会重新同步。');
            } else if (nextStatus === 'exact-denied') {
              setCommandStatus('精确闹钟仍未授权，主动消息会在 App 打开时兜底运行。');
            } else if (nextStatus === 'failed') {
              setCommandStatus('打开精确闹钟设置失败，主动消息会在 App 打开时兜底运行。', true);
            }
          });
        }, 0);
      }
      setCommandStatus(
        status === 'denied'
          ? '系统通知未授权，主动消息会在 App 打开时运行。'
          : status === 'exact-denied'
            ? '系统精确闹钟未授权，主动消息可能等到 App 打开时才运行。'
          : '系统通知同步失败，主动消息会在 App 打开时运行。',
        status === 'failed'
      );
    });

    return () => {
      cancelled = true;
    };
  }, [personas, setCommandStatus, startupReady, triggerRules]);

  useEffect(() => {
    if (!startupReady) return;
    let cancelled = false;
    let removeListener: (() => void) | null = null;

    void registerNativeTriggerNotificationTapListener((tap) => {
      if (cancelled) return;
      handleTriggerTap(tap);
    }).then((listener) => {
      if (cancelled) {
        void listener?.remove();
        return;
      }
      removeListener = listener ? () => void listener.remove() : null;
    });

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [setCommandStatus, startupReady]);

  useEffect(() => {
    if (!startupReady || typeof window === 'undefined') return;
    let cancelled = false;
    let removeResumeListener: (() => void) | null = null;

    const scanDeliveredNotifications = () => {
      void consumeDeliveredNativeTriggerNotificationTaps().then((taps) => {
        if (cancelled) return;
        taps.forEach(handleTriggerTap);
      });
    };
    const scanWhenVisible = () => {
      if (document.visibilityState !== 'hidden') {
        scanDeliveredNotifications();
      }
    };

    scanDeliveredNotifications();
    window.addEventListener('focus', scanDeliveredNotifications);
    window.addEventListener('pageshow', scanDeliveredNotifications);
    document.addEventListener('visibilitychange', scanWhenVisible);

    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')) {
      void CapacitorApp.addListener('resume', scanDeliveredNotifications).then((listener) => {
        if (cancelled) {
          void listener.remove();
          return;
        }
        removeResumeListener = () => {
          void listener.remove();
        };
      });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('focus', scanDeliveredNotifications);
      window.removeEventListener('pageshow', scanDeliveredNotifications);
      document.removeEventListener('visibilitychange', scanWhenVisible);
      removeResumeListener?.();
    };
  }, [startupReady, setCommandStatus]);
}
