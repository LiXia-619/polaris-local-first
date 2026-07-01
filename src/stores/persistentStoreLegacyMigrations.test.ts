import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_CUSTOMIZATION } from './runtimeStoreCustomization';
import {
  applyLegacyRuntimeSpaceFields,
  readLegacyRuntimeSpacePayload
} from './persistentStoreLegacyMigrations';

function createSpaceState(overrides: Partial<{
  screenshotDebugOverlayEnabled: boolean;
  customization: typeof DEFAULT_APP_CUSTOMIZATION;
}> = {}) {
  return {
    screenshotDebugOverlayEnabled: overrides.screenshotDebugOverlayEnabled ?? false,
    customization: overrides.customization ?? DEFAULT_APP_CUSTOMIZATION,
    setScreenshotDebugOverlayEnabled: vi.fn(),
    setCustomization: vi.fn()
  };
}

describe('persistent store legacy migrations', () => {
  it('moves old runtime-owned space fields into spaceStore setters', async () => {
    const spaceState = createSpaceState();
    const changed = await applyLegacyRuntimeSpaceFields({
      getSpaceState: () => spaceState,
      readRuntimePayload: async () => ({
        screenshotDebugOverlayEnabled: true,
        customization: {
          backgroundOpacity: 0.62
        }
      })
    });

    expect(changed).toBe(true);
    expect(spaceState.setScreenshotDebugOverlayEnabled).toHaveBeenCalledWith(true);
    expect(spaceState.setCustomization).toHaveBeenCalledWith(expect.objectContaining({
      backgroundOpacity: 0.62
    }));
  });

  it('reads old runtime-owned space fields before runtime repair can normalize them away', async () => {
    const payload = await readLegacyRuntimeSpacePayload({
      readRuntimePayload: async () => ({
        screenshotDebugOverlayEnabled: true,
        customization: {
          backgroundOpacity: 0.62
        }
      })
    });

    expect(payload).toEqual(expect.objectContaining({
      screenshotDebugOverlayEnabled: true,
      customization: expect.objectContaining({
        backgroundOpacity: 0.62
      })
    }));
  });

  it('applies a captured runtime space payload without rereading the normalized runtime store', async () => {
    const spaceState = createSpaceState();
    const readRuntimePayload = vi.fn(async () => ({ customization: { backgroundOpacity: 0.2 } }));

    const changed = await applyLegacyRuntimeSpaceFields({
      getSpaceState: () => spaceState,
      legacyRuntimePayload: {
        customization: {
          backgroundOpacity: 0.72
        }
      },
      readRuntimePayload
    });

    expect(changed).toBe(true);
    expect(readRuntimePayload).not.toHaveBeenCalled();
    expect(spaceState.setCustomization).toHaveBeenCalledWith(expect.objectContaining({
      backgroundOpacity: 0.72
    }));
  });

  it('does not overwrite a user-customized space customization during legacy migration', async () => {
    const spaceState = createSpaceState({
      customization: {
        ...DEFAULT_APP_CUSTOMIZATION,
        backgroundOpacity: 0.62
      }
    });

    const changed = await applyLegacyRuntimeSpaceFields({
      getSpaceState: () => spaceState,
      readRuntimePayload: async () => ({
        customization: {
          backgroundOpacity: 0.31
        }
      })
    });

    expect(changed).toBe(false);
    expect(spaceState.setCustomization).not.toHaveBeenCalled();
  });

  it('stops before applying fields when startup is cancelled', async () => {
    const spaceState = createSpaceState();
    const changed = await applyLegacyRuntimeSpaceFields({
      getSpaceState: () => spaceState,
      isCancelled: () => true,
      readRuntimePayload: async () => ({
        screenshotDebugOverlayEnabled: true
      })
    });

    expect(changed).toBe(false);
    expect(spaceState.setScreenshotDebugOverlayEnabled).not.toHaveBeenCalled();
  });
});
