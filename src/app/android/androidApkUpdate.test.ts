import { describe, expect, it } from 'vitest';
import {
  buildAndroidApkUpdatePrompt,
  parseAndroidApkUpdateManifest,
  resolveAndroidApkUpdate
} from './androidApkUpdate';

describe('parseAndroidApkUpdateManifest', () => {
  it('normalizes a valid Android APK update manifest', () => {
    expect(parseAndroidApkUpdateManifest({
      platform: 'android',
      packageId: 'com.alyssa.polaris',
      versionCode: 15,
      versionName: '1.0.14',
      downloadUrl: '/downloads/polaris.apk',
      notes: ['修复连接', '', 12],
      sha256: 'abc'
    }, 'https://polaris.example.com/android/latest.json')).toEqual({
      platform: 'android',
      packageId: 'com.alyssa.polaris',
      versionCode: 15,
      versionName: '1.0.14',
      downloadUrl: 'https://polaris.example.com/downloads/polaris.apk',
      notes: ['修复连接'],
      sha256: 'abc'
    });
  });

  it('rejects incomplete manifests instead of guessing update data', () => {
    expect(parseAndroidApkUpdateManifest({
      platform: 'android',
      packageId: 'com.alyssa.polaris',
      versionName: '1.0.14',
      downloadUrl: 'https://example.com/downloads/polaris.apk'
    })).toBeNull();
  });
});

describe('resolveAndroidApkUpdate', () => {
  const current = {
    packageId: 'com.alyssa.polaris',
    versionCode: 14,
    versionName: '1.0.13'
  };

  it('reports an update only when the same package has a higher versionCode', () => {
    const latest = {
      platform: 'android' as const,
      packageId: 'com.alyssa.polaris',
      versionCode: 15,
      versionName: '1.0.14',
      downloadUrl: 'https://example.com/downloads/polaris.apk'
    };

    expect(resolveAndroidApkUpdate(current, latest)).toMatchObject({
      status: 'update-available',
      update: { current, latest }
    });
  });

  it('ignores manifests for other packages', () => {
    expect(resolveAndroidApkUpdate(current, {
      platform: 'android',
      packageId: 'com.example.other',
      versionCode: 99,
      versionName: '9.9.9',
      downloadUrl: 'https://example.com/downloads/other.apk'
    })).toMatchObject({ status: 'current' });
  });
});

describe('buildAndroidApkUpdatePrompt', () => {
  it('uses user-facing Chinese update wording', () => {
    const prompt = buildAndroidApkUpdatePrompt({
      current: {
        packageId: 'com.alyssa.polaris',
        versionCode: 14,
        versionName: '1.0.13'
      },
      latest: {
        platform: 'android',
        packageId: 'com.alyssa.polaris',
        versionCode: 15,
        versionName: '1.0.14',
        downloadUrl: 'https://example.com/downloads/polaris.apk',
        notes: ['连接修复']
      }
    });
    expect(prompt).toContain('Polaris 有新版本啦：1.0.14');
    expect(prompt).toContain('你现在安装的是：1.0.13');
    expect(prompt).toContain('现在去更新吗？');
    expect(prompt).not.toContain('Android APK');
    expect(prompt).not.toContain('（15）');
  });
});
