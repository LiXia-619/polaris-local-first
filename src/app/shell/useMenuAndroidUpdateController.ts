import { canCheckAndroidApkUpdate, checkAndroidApkUpdate } from '../android/androidApkUpdateRuntime';

type MenuAndroidUpdateUi = {
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
};

type MenuAndroidUpdateWindow = Pick<Window, 'open' | 'location'>;

type UseMenuAndroidUpdateControllerArgs = {
  ui: MenuAndroidUpdateUi;
  browserWindow?: MenuAndroidUpdateWindow;
};

export function openMenuAndroidUpdateUrl(url: string, browserWindow: MenuAndroidUpdateWindow = window) {
  const opened = browserWindow.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) browserWindow.location.href = url;
}

export function useMenuAndroidUpdateController({
  ui,
  browserWindow
}: UseMenuAndroidUpdateControllerArgs) {
  const androidApkUpdateAvailable = canCheckAndroidApkUpdate();

  const checkAndroidApkUpdateManually = async () => {
    await checkAndroidApkUpdate({
      mode: 'manual',
      ui: {
        alert: ui.alert,
        confirm: ui.confirm,
        openUrl: (url) => openMenuAndroidUpdateUrl(url, browserWindow)
      }
    });
  };

  return {
    androidApkUpdateAvailable,
    onCheckAndroidApkUpdate: checkAndroidApkUpdateManually
  };
}
