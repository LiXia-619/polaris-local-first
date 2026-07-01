import { describe, expect, it } from 'vitest';
import {
  ANDROID_APK_UPDATE_AUTO_REMINDER_INTERVAL_MS,
  parseAndroidApkUpdateReminderState,
  shouldShowAndroidApkAutoReminder
} from './androidApkUpdateReminder';

describe('shouldShowAndroidApkAutoReminder', () => {
  it('shows the prompt for a new latest version', () => {
    expect(shouldShowAndroidApkAutoReminder({
      latestVersionCode: 22,
      dismissedVersionCode: null,
      lastReminder: { versionCode: 21, remindedAt: 1000 },
      now: 2000
    })).toBe(true);
  });

  it('suppresses an auto prompt after the same version was dismissed', () => {
    expect(shouldShowAndroidApkAutoReminder({
      latestVersionCode: 22,
      dismissedVersionCode: 22,
      lastReminder: null,
      now: 2000
    })).toBe(false);
  });

  it('suppresses repeated same-version auto prompts within one day', () => {
    expect(shouldShowAndroidApkAutoReminder({
      latestVersionCode: 22,
      dismissedVersionCode: null,
      lastReminder: { versionCode: 22, remindedAt: 1000 },
      now: 1000 + ANDROID_APK_UPDATE_AUTO_REMINDER_INTERVAL_MS - 1
    })).toBe(false);
  });

  it('allows the same version to remind again after one day', () => {
    expect(shouldShowAndroidApkAutoReminder({
      latestVersionCode: 22,
      dismissedVersionCode: null,
      lastReminder: { versionCode: 22, remindedAt: 1000 },
      now: 1000 + ANDROID_APK_UPDATE_AUTO_REMINDER_INTERVAL_MS
    })).toBe(true);
  });
});

describe('parseAndroidApkUpdateReminderState', () => {
  it('parses a valid reminder record', () => {
    expect(parseAndroidApkUpdateReminderState(JSON.stringify({
      versionCode: 22,
      remindedAt: 1234
    }))).toEqual({
      versionCode: 22,
      remindedAt: 1234
    });
  });

  it('rejects malformed records', () => {
    expect(parseAndroidApkUpdateReminderState('{')).toBeNull();
    expect(parseAndroidApkUpdateReminderState(JSON.stringify({ versionCode: 0, remindedAt: 1234 }))).toBeNull();
    expect(parseAndroidApkUpdateReminderState(JSON.stringify({ versionCode: 22, remindedAt: 0 }))).toBeNull();
  });
});
