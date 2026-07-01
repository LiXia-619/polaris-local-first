import { useEffect, useRef } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { PolarisCompanionConnection, PolarisCompanionPushPlatform } from '../../types/domain';
import { registerCompanionClientPushToken } from '../../engines/companionApi';
import { useI18n } from '../../i18n';
import { useRuntimeStore } from '../../stores/runtimeStore';

type UseCompanionNativePushRegistrationArgs = {
  runtimeHydrated: boolean;
  companionConnections: PolarisCompanionConnection[];
  updateCompanionConnection: (connectionId: string, patch: Partial<PolarisCompanionConnection>) => void;
};

function resolveNativePushPlatform(): Extract<PolarisCompanionPushPlatform, 'android' | 'ios'> | null {
  if (!Capacitor.isNativePlatform()) return null;
  const platform = Capacitor.getPlatform();
  if (platform === 'android' || platform === 'ios') return platform;
  return null;
}

function canRegisterCompanionPush(connection: PolarisCompanionConnection): boolean {
  return Boolean(connection.relayUrl && connection.hostId && connection.clientId && connection.clientSecret);
}

export function useCompanionNativePushRegistration({
  runtimeHydrated,
  companionConnections,
  updateCompanionConnection
}: UseCompanionNativePushRegistrationArgs) {
  const { t } = useI18n();
  const tRef = useRef(t);
  const tokenRef = useRef<string | null>(null);
  const platformRef = useRef<Extract<PolarisCompanionPushPlatform, 'android' | 'ios'> | null>(null);
  const registeringTokenRef = useRef(false);
  const hasPushRegistrationTarget = companionConnections.some(canRegisterCompanionPush);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!runtimeHydrated) return;
    if (!hasPushRegistrationTarget) return;
    const platform = resolveNativePushPlatform();
    if (!platform) return;
    if (!Capacitor.isPluginAvailable('PushNotifications')) return;
    platformRef.current = platform;

    let cancelled = false;
    const listenerHandles: PluginListenerHandle[] = [];

    const registerTokenForConnections = async (token: string) => {
      if (registeringTokenRef.current) return;
      registeringTokenRef.current = true;
      try {
        const latestConnections = useRuntimeStore.getState().companionConnections;
        for (const connection of latestConnections) {
          if (cancelled) return;
          if (!canRegisterCompanionPush(connection)) continue;
          if (connection.pushToken === token && connection.pushPlatform === platform) continue;
          try {
            await registerCompanionClientPushToken({
              relayUrl: connection.relayUrl,
              hostId: connection.hostId,
              clientId: connection.clientId,
              clientSecret: connection.clientSecret,
              platform,
              token
            });
            updateCompanionConnection(connection.id, {
              pushToken: token,
              pushPlatform: platform,
              lastError: null
            });
          } catch (error) {
            updateCompanionConnection(connection.id, {
              lastError: error instanceof Error
                ? error.message
                : tRef.current('companion.pushTokenRegistrationFailed', { platform: platform === 'ios' ? 'iOS' : 'Android' })
            });
          }
        }
      } finally {
        registeringTokenRef.current = false;
      }
    };

    void import('@capacitor/push-notifications')
      .then(async ({ PushNotifications }) => {
        const registrationListener = await PushNotifications.addListener('registration', (token) => {
          tokenRef.current = token.value;
          platformRef.current = platform;
          void registerTokenForConnections(token.value);
        });
        if (cancelled) {
          void registrationListener.remove();
          return;
        }
        listenerHandles.push(registrationListener);

        const errorListener = await PushNotifications.addListener('registrationError', (error) => {
          for (const connection of useRuntimeStore.getState().companionConnections) {
            updateCompanionConnection(connection.id, {
              lastError: typeof error.error === 'string'
                ? error.error
                : tRef.current('companion.pushRegistrationFailed', { platform: platform === 'ios' ? 'iOS' : 'Android' })
            });
          }
        });
        if (cancelled) {
          void errorListener.remove();
          return;
        }
        listenerHandles.push(errorListener);

        const permission = await PushNotifications.requestPermissions();
        if (cancelled) return;
        if (permission.receive !== 'granted') return;
        await PushNotifications.register();
      })
      .catch(() => {
      });

    return () => {
      cancelled = true;
      for (const handle of listenerHandles) {
        void handle.remove();
      }
    };
  }, [hasPushRegistrationTarget, runtimeHydrated, updateCompanionConnection]);

  useEffect(() => {
    const token = tokenRef.current;
    const platform = platformRef.current;
    if (!runtimeHydrated || !token || !platform || companionConnections.length === 0) return;
    for (const connection of companionConnections) {
      if (!canRegisterCompanionPush(connection)) continue;
      if (connection.pushToken === token && connection.pushPlatform === platform) continue;
      void registerCompanionClientPushToken({
        relayUrl: connection.relayUrl,
        hostId: connection.hostId,
        clientId: connection.clientId,
        clientSecret: connection.clientSecret,
        platform,
        token
      }).then(() => {
        updateCompanionConnection(connection.id, {
          pushToken: token,
          pushPlatform: platform,
          lastError: null
        });
      }).catch((error) => {
        updateCompanionConnection(connection.id, {
          lastError: error instanceof Error
            ? error.message
            : tRef.current('companion.pushTokenRegistrationFailed', { platform: platform === 'ios' ? 'iOS' : 'Android' })
        });
      });
    }
  }, [companionConnections, runtimeHydrated, updateCompanionConnection]);
}
