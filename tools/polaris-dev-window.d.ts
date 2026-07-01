import type { PolarisDeveloperBridge } from '../src/engines/developer-mode/developerModeRuntime';

declare global {
  interface Window {
    __polarisDev?: PolarisDeveloperBridge & {
      getRunCodeSandboxProfile?: () => 'safe' | 'experimental' | 'host';
      unlockRunCodeSandbox?: (passphrase: string) => 'experimental' | 'host' | false;
      lockRunCodeSandbox?: () => boolean;
    };
  }
}

export {};
