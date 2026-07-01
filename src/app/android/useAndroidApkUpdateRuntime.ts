import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { checkAndroidApkUpdate, canCheckAndroidApkUpdate } from './androidApkUpdateRuntime';

type UseAndroidApkUpdateRuntimeOptions = {
  enabled?: boolean;
};

export function useAndroidApkUpdateRuntime({ enabled = true }: UseAndroidApkUpdateRuntimeOptions = {}) {
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!canCheckAndroidApkUpdate()) return;

    const check = () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      void checkAndroidApkUpdate({ mode: 'auto' }).finally(() => {
        checkingRef.current = false;
      });
    };

    check();
    let disposed = false;
    let resumeListener: PluginListenerHandle | null = null;
    void CapacitorApp.addListener('resume', check).then((listener) => {
      if (disposed) {
        void listener.remove();
        return;
      }
      resumeListener = listener;
    });

    return () => {
      disposed = true;
      void resumeListener?.remove();
    };
  }, [enabled]);
}
