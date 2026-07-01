import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  ANDROID_APK_UPDATE_MANIFEST_URL,
  buildAndroidApkUpdatePrompt,
  parseAndroidApkUpdateManifest,
  resolveAndroidApkUpdate,
  type AndroidApkCurrentBuild,
  type AndroidApkUpdateCheckResult
} from './androidApkUpdate';
import {
  parseAndroidApkUpdateReminderState,
  shouldShowAndroidApkAutoReminder,
  type AndroidApkUpdateReminderState
} from './androidApkUpdateReminder';

const DISMISSED_VERSION_STORAGE_KEY = 'polaris-android-apk-update-dismissed-version-code';
const AUTO_REMINDER_STORAGE_KEY = 'polaris-android-apk-update-auto-reminder';

type AndroidApkUpdateUi = {
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
  openUrl: (url: string) => void;
};

function defaultUi(): AndroidApkUpdateUi {
  return {
    alert: (message) => window.alert(message),
    confirm: (message) => window.confirm(message),
    openUrl: (url) => {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.href = url;
      }
    }
  };
}

function readDismissedVersionCode() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DISMISSED_VERSION_STORAGE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function writeDismissedVersionCode(versionCode: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISMISSED_VERSION_STORAGE_KEY, String(versionCode));
}

function readAutoReminderState(): AndroidApkUpdateReminderState | null {
  if (typeof window === 'undefined') return null;
  return parseAndroidApkUpdateReminderState(window.localStorage.getItem(AUTO_REMINDER_STORAGE_KEY));
}

function writeAutoReminderState(versionCode: number, remindedAt: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTO_REMINDER_STORAGE_KEY, JSON.stringify({ versionCode, remindedAt }));
}

export function canCheckAndroidApkUpdate() {
  return Capacitor.isNativePlatform()
    && Capacitor.getPlatform() === 'android'
    && Capacitor.isPluginAvailable('App');
}

async function readCurrentAndroidBuild(): Promise<AndroidApkCurrentBuild> {
  const info = await CapacitorApp.getInfo();
  const versionCode = Number.parseInt(info.build, 10);
  if (!Number.isInteger(versionCode) || versionCode <= 0) {
    throw new Error('暂时读不到当前安装版本，请稍后再试。');
  }
  return {
    packageId: info.id,
    versionCode,
    versionName: info.version
  };
}

async function fetchLatestAndroidApkManifest(manifestUrl: string) {
  const response = await fetch(manifestUrl, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error('暂时打不开更新信息，请稍后再试。');
  }
  const manifest = parseAndroidApkUpdateManifest(await response.json(), manifestUrl);
  if (!manifest) {
    throw new Error('更新信息暂时不可用，请稍后再试。');
  }
  return manifest;
}

export async function checkAndroidApkUpdate(options?: {
  mode?: 'auto' | 'manual';
  manifestUrl?: string;
  ui?: AndroidApkUpdateUi;
}): Promise<AndroidApkUpdateCheckResult | null> {
  const mode = options?.mode ?? 'manual';
  const ui = options?.ui ?? defaultUi();
  const manifestUrl = options?.manifestUrl ?? ANDROID_APK_UPDATE_MANIFEST_URL;
  if (!canCheckAndroidApkUpdate()) {
    if (mode === 'manual') {
      ui.alert('更新检查只在 Polaris 安卓版里可用。');
    }
    return null;
  }
  if (!manifestUrl) {
    if (mode === 'manual') {
      ui.alert('这个 clean 项目还没有配置安卓版更新源。');
    }
    return null;
  }

  try {
    const current = await readCurrentAndroidBuild();
    const latest = await fetchLatestAndroidApkManifest(manifestUrl);
    const result = resolveAndroidApkUpdate(current, latest);
    if (result.status === 'current') {
      if (mode === 'manual') {
        ui.alert(`当前已经是最新版本：${current.versionName}。`);
      }
      return result;
    }

    if (mode === 'auto') {
      const latestVersionCode = result.update.latest.versionCode;
      const now = Date.now();
      if (!shouldShowAndroidApkAutoReminder({
        latestVersionCode,
        dismissedVersionCode: readDismissedVersionCode(),
        lastReminder: readAutoReminderState(),
        now
      })) {
        return result;
      }
      writeAutoReminderState(latestVersionCode, now);
    }

    if (ui.confirm(buildAndroidApkUpdatePrompt(result.update))) {
      ui.openUrl(result.update.latest.downloadUrl);
    } else {
      writeDismissedVersionCode(result.update.latest.versionCode);
    }
    return result;
  } catch (error) {
    if (mode === 'manual') {
      ui.alert(error instanceof Error ? error.message : '更新检查暂时失败，请稍后再试。');
    }
    return null;
  }
}
