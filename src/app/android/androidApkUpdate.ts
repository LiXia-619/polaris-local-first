export const ANDROID_APK_UPDATE_MANIFEST_URL = '';

export type AndroidApkUpdateManifest = {
  platform: 'android';
  packageId: string;
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  releaseDate?: string;
  notes?: string[];
  sha256?: string;
};

export type AndroidApkCurrentBuild = {
  packageId: string;
  versionCode: number;
  versionName: string;
};

export type AndroidApkUpdateInfo = {
  current: AndroidApkCurrentBuild;
  latest: AndroidApkUpdateManifest;
};

export type AndroidApkUpdateCheckResult =
  | { status: 'update-available'; update: AndroidApkUpdateInfo }
  | { status: 'current'; current: AndroidApkCurrentBuild; latest: AndroidApkUpdateManifest };

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readVersionCode(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveManifestUrl(value: string, manifestUrl: string) {
  try {
    return new URL(value, manifestUrl).toString();
  } catch {
    return null;
  }
}

export function parseAndroidApkUpdateManifest(
  raw: unknown,
  manifestUrl = ANDROID_APK_UPDATE_MANIFEST_URL
): AndroidApkUpdateManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  if (source.platform !== 'android') return null;

  const packageId = readString(source.packageId);
  const versionCode = readVersionCode(source.versionCode);
  const versionName = readString(source.versionName);
  const downloadUrlText = readString(source.downloadUrl);
  if (!packageId || !versionCode || !versionName || !downloadUrlText) return null;

  const downloadUrl = resolveManifestUrl(downloadUrlText, manifestUrl);
  if (!downloadUrl) return null;

  const notes = Array.isArray(source.notes)
    ? source.notes.map(readString).filter((note): note is string => Boolean(note))
    : undefined;
  return {
    platform: 'android',
    packageId,
    versionCode,
    versionName,
    downloadUrl,
    releaseDate: readString(source.releaseDate) ?? undefined,
    notes: notes && notes.length > 0 ? notes : undefined,
    sha256: readString(source.sha256) ?? undefined
  };
}

export function resolveAndroidApkUpdate(
  current: AndroidApkCurrentBuild,
  latest: AndroidApkUpdateManifest
): AndroidApkUpdateCheckResult {
  if (latest.packageId !== current.packageId) {
    return { status: 'current', current, latest };
  }
  if (latest.versionCode > current.versionCode) {
    return {
      status: 'update-available',
      update: {
        current,
        latest
      }
    };
  }
  return { status: 'current', current, latest };
}

export function buildAndroidApkUpdatePrompt(update: AndroidApkUpdateInfo) {
  const notes = update.latest.notes?.slice(0, 3).join('\n- ') ?? '';
  return [
    `Polaris 有新版本啦：${update.latest.versionName}`,
    `你现在安装的是：${update.current.versionName}`,
    notes ? `\n更新内容：\n- ${notes}` : '',
    '\n现在去更新吗？'
  ].filter(Boolean).join('\n');
}
