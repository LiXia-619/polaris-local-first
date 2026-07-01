export const POLARIS_RUN_CODE_SANDBOX_MODE_EVENT = 'polaris:run-code-sandbox-mode-updated';
const POLARIS_RUN_CODE_SANDBOX_MODE_STORAGE_KEY = 'polaris-run-code-sandbox-mode';
export const RUN_CODE_SANDBOX_UNLOCK_PASSPHRASE = '拆房子';
const DEFAULT_RUN_CODE_SANDBOX_PROFILE: RunCodeSandboxProfile = 'experimental';

export type RunCodeSandboxProfile = 'safe' | 'experimental';

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dispatchSandboxModeEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POLARIS_RUN_CODE_SANDBOX_MODE_EVENT));
}

export function getRunCodeSandboxProfile(): RunCodeSandboxProfile {
  const storage = getLocalStorage();
  if (!storage) return DEFAULT_RUN_CODE_SANDBOX_PROFILE;

  try {
    const stored = storage.getItem(POLARIS_RUN_CODE_SANDBOX_MODE_STORAGE_KEY);
    return stored === 'experimental' || stored === 'safe'
      ? stored
      : DEFAULT_RUN_CODE_SANDBOX_PROFILE;
  } catch {
    return DEFAULT_RUN_CODE_SANDBOX_PROFILE;
  }
}

export function unlockRunCodeSandbox(passphrase: string): 'experimental' | false {
  const storage = getLocalStorage();
  if (!storage) return false;
  const trimmed = passphrase.trim();
  const nextProfile = trimmed === RUN_CODE_SANDBOX_UNLOCK_PASSPHRASE ? 'experimental' : null;
  if (!nextProfile) return false;

  try {
    storage.setItem(POLARIS_RUN_CODE_SANDBOX_MODE_STORAGE_KEY, nextProfile);
    dispatchSandboxModeEvent();
    return nextProfile;
  } catch {
    return false;
  }
}

export function lockRunCodeSandbox() {
  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    storage.setItem(POLARIS_RUN_CODE_SANDBOX_MODE_STORAGE_KEY, 'safe');
    dispatchSandboxModeEvent();
    return true;
  } catch {
    return false;
  }
}
