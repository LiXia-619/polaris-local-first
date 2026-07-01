export const ANDROID_APK_UPDATE_AUTO_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type AndroidApkUpdateReminderState = {
  versionCode: number;
  remindedAt: number;
};

export function shouldShowAndroidApkAutoReminder(args: {
  latestVersionCode: number;
  dismissedVersionCode: number | null;
  lastReminder: AndroidApkUpdateReminderState | null;
  now: number;
}) {
  if (args.dismissedVersionCode === args.latestVersionCode) return false;
  if (!args.lastReminder || args.lastReminder.versionCode !== args.latestVersionCode) return true;
  return args.now - args.lastReminder.remindedAt >= ANDROID_APK_UPDATE_AUTO_REMINDER_INTERVAL_MS;
}

export function parseAndroidApkUpdateReminderState(raw: string | null): AndroidApkUpdateReminderState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Partial<AndroidApkUpdateReminderState>;
    const versionCode = record.versionCode;
    const remindedAt = record.remindedAt;
    if (typeof versionCode !== 'number' || typeof remindedAt !== 'number') return null;
    if (!Number.isInteger(versionCode) || !Number.isFinite(remindedAt)) return null;
    if (versionCode <= 0 || remindedAt <= 0) return null;
    return {
      versionCode,
      remindedAt
    };
  } catch {
    return null;
  }
}
