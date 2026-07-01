import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { parseTriggerShortcutUrl } from '../../engines/triggerShortcutUrl';
import { useRuntimeStore } from '../../stores/runtimeStore';
import { useSpaceStore } from '../../stores/spaceStore';

type UseAppTriggerShortcutRuntimeArgs = {
  startupReady: boolean;
  setCommandStatus: (text: string, isError?: boolean) => void;
};

export function useAppTriggerShortcutRuntime({
  startupReady,
  setCommandStatus
}: UseAppTriggerShortcutRuntimeArgs) {
  const lastHandledUrlRef = useRef<{ url: string; at: number } | null>(null);

  useEffect(() => {
    if (!startupReady || typeof window === 'undefined') return;

    const triggerRuleFromUrl = (rawUrl: string | null | undefined) => {
      if (!rawUrl) return;
      const now = Date.now();
      const lastHandledUrl = lastHandledUrlRef.current;
      if (lastHandledUrl?.url === rawUrl && now - lastHandledUrl.at < 1000) return;

      const parsed = parseTriggerShortcutUrl(rawUrl);
      if (!parsed) return;
      lastHandledUrlRef.current = { url: rawUrl, at: now };

      const runtimeState = useRuntimeStore.getState();
      const rule = runtimeState.triggerRules.find((entry) => entry.id === parsed.ruleId) ?? null;
      if (!rule) {
        setCommandStatus('没有找到这个快捷指令触发器。', true);
        return;
      }

      runtimeState.enqueueTriggerEvent({
        ruleId: rule.id,
        prompt: parsed.prompt,
        source: 'shortcut'
      });
      useSpaceStore.getState().setWorld('chat');
      runtimeState.updateTriggerRule(rule.id, {
        enabled: true,
        nextRunAt: now
      });
      setCommandStatus(`已收到快捷指令：${rule.name}`);
    };

    triggerRuleFromUrl(window.location.href);

    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('App')) return;

    let cancelled = false;
    let removeListener: (() => void) | null = null;

    void CapacitorApp.getLaunchUrl()
      .then((launchUrl) => {
        if (cancelled) return;
        triggerRuleFromUrl(launchUrl?.url);
      })
      .catch(() => {
      });

    void CapacitorApp.addListener('appUrlOpen', (event) => {
      triggerRuleFromUrl(event.url);
    }).then((listener) => {
      if (cancelled) {
        void listener.remove();
        return;
      }
      removeListener = () => {
        void listener.remove();
      };
    });

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [setCommandStatus, startupReady]);
}
