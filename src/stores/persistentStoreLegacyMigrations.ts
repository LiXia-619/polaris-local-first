import { kvGet } from '../infrastructure/persistence';
import { reportPersistenceError } from '../infrastructure/persistenceDiagnostics';
import { DEFAULT_APP_CUSTOMIZATION, normalizeAppCustomization } from './runtimeStoreCustomization';

type LegacyRuntimeSpacePayload = {
  screenshotDebugOverlayEnabled?: boolean;
  customization?: Partial<typeof DEFAULT_APP_CUSTOMIZATION>;
};

type LegacyRuntimeSpaceState = {
  screenshotDebugOverlayEnabled: boolean;
  customization: typeof DEFAULT_APP_CUSTOMIZATION;
  setScreenshotDebugOverlayEnabled: (enabled: boolean) => void;
  setCustomization: (customization: typeof DEFAULT_APP_CUSTOMIZATION) => void;
};

function isDefaultCustomization(customization: typeof DEFAULT_APP_CUSTOMIZATION) {
  return JSON.stringify(customization) === JSON.stringify(DEFAULT_APP_CUSTOMIZATION);
}

export async function readLegacyRuntimeSpacePayload(args: {
  readRuntimePayload?: () => Promise<LegacyRuntimeSpacePayload | null | undefined>;
  reportError?: (error: unknown) => void;
} = {}) {
  const readRuntimePayload = args.readRuntimePayload ?? (() => kvGet<LegacyRuntimeSpacePayload>('runtime-providers-v2'));

  try {
    return await readRuntimePayload() ?? null;
  } catch (error) {
    if (args.reportError) {
      args.reportError(error);
    } else {
      reportPersistenceError({ label: '[store:persist]', store: 'runtime', operation: 'read-legacy-space-fields' }, error);
    }
    return null;
  }
}

export async function applyLegacyRuntimeSpaceFields(args: {
  getSpaceState: () => LegacyRuntimeSpaceState;
  isCancelled?: () => boolean;
  legacyRuntimePayload?: LegacyRuntimeSpacePayload | null;
  readRuntimePayload?: () => Promise<LegacyRuntimeSpacePayload | null | undefined>;
  reportError?: (error: unknown) => void;
}) {
  try {
    const legacyRuntimePayload = Object.prototype.hasOwnProperty.call(args, 'legacyRuntimePayload')
      ? args.legacyRuntimePayload
      : await readLegacyRuntimeSpacePayload({
          readRuntimePayload: args.readRuntimePayload,
          reportError: args.reportError
        });
    if (args.isCancelled?.()) return false;
    if (!legacyRuntimePayload) return false;

    let changed = false;
    const initialSpaceState = args.getSpaceState();
    if (
      legacyRuntimePayload.screenshotDebugOverlayEnabled === true
      && !initialSpaceState.screenshotDebugOverlayEnabled
    ) {
      initialSpaceState.setScreenshotDebugOverlayEnabled(true);
      changed = true;
    }

    if (args.isCancelled?.()) return changed;
    if (legacyRuntimePayload.customization) {
      const currentSpaceState = args.getSpaceState();
      if (isDefaultCustomization(currentSpaceState.customization)) {
        currentSpaceState.setCustomization(normalizeAppCustomization(legacyRuntimePayload.customization));
        changed = true;
      }
    }

    return changed;
  } catch (error) {
    if (args.reportError) {
      args.reportError(error);
    } else {
      console.warn('[store:migrate]', error);
    }
    return false;
  }
}
