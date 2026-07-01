import { describe, expect, it } from 'vitest';
import { applyAppLayoutSurfaceBootstrap, resolveRequestedAppLayoutSurface } from './appLayoutSurfaceBootstrap';

describe('resolveRequestedAppLayoutSurface', () => {
  it('returns desktop when the launch URL requests the desktop layout surface', () => {
    expect(resolveRequestedAppLayoutSurface('?surface=desktop')).toBe('desktop');
  });

  it('maps the legacy mobile surface to the phone layout surface', () => {
    expect(resolveRequestedAppLayoutSurface('?surface=mobile')).toBe('phone');
  });

  it('returns tablet when the launch URL requests the tablet layout surface', () => {
    expect(resolveRequestedAppLayoutSurface('?surface=tablet')).toBe('tablet');
  });

  it('prefers the explicit layout parameter over the legacy surface parameter', () => {
    expect(resolveRequestedAppLayoutSurface('?surface=desktop&layout=phone')).toBe('phone');
  });

  it('ignores unknown layout surface values', () => {
    expect(resolveRequestedAppLayoutSurface('?surface=watch')).toBeNull();
  });
});

describe('applyAppLayoutSurfaceBootstrap', () => {
  it('sets the root layout surface marker for recognized launch surfaces', () => {
    const root = { dataset: {} } as HTMLElement;

    expect(applyAppLayoutSurfaceBootstrap(root, '?surface=desktop')).toBe('desktop');
    expect(root.dataset.polarisLayoutSurface).toBe('desktop');
  });

  it('clears the old root surface marker when a layout surface is requested', () => {
    const root = { dataset: { polarisSurface: 'mobile' } } as unknown as HTMLElement;

    expect(applyAppLayoutSurfaceBootstrap(root, '?layout=tablet')).toBe('tablet');
    expect(root.dataset.polarisLayoutSurface).toBe('tablet');
    expect(root.dataset.polarisSurface).toBeUndefined();
  });

  it('leaves the root unchanged when no layout surface is requested', () => {
    const root = { dataset: {} } as HTMLElement;

    expect(applyAppLayoutSurfaceBootstrap(root, '?chat=1')).toBeNull();
    expect(root.dataset.polarisLayoutSurface).toBeUndefined();
  });
});
