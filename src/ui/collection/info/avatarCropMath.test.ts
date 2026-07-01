import { describe, expect, it } from 'vitest';
import {
  AVATAR_CROP_FRAME_SIZE,
  clampAvatarOffset,
  clampAvatarZoom,
  resolveAvatarSourceRect
} from './avatarCropMath';

describe('avatarCropMath', () => {
  it('clamps zoom into the supported range', () => {
    expect(clampAvatarZoom(0.2)).toBe(1);
    expect(clampAvatarZoom(1.8)).toBe(1.8);
    expect(clampAvatarZoom(8)).toBe(3);
  });

  it('clamps horizontal offset for wide images', () => {
    expect(
      clampAvatarOffset({
        frameSize: AVATAR_CROP_FRAME_SIZE,
        imageWidth: 1200,
        imageHeight: 800,
        zoom: 1,
        x: 999,
        y: 0
      }).x
    ).toBeCloseTo(62, 4);
  });

  it('clamps vertical offset for tall images', () => {
    expect(
      clampAvatarOffset({
        frameSize: AVATAR_CROP_FRAME_SIZE,
        imageWidth: 800,
        imageHeight: 1200,
        zoom: 1,
        x: 0,
        y: -999
      }).y
    ).toBeCloseTo(-62, 4);
  });

  it('resolves a centered square crop by default', () => {
    expect(
      resolveAvatarSourceRect({
        frameSize: AVATAR_CROP_FRAME_SIZE,
        imageWidth: 1200,
        imageHeight: 800,
        zoom: 1,
        x: 0,
        y: 0
      })
    ).toMatchObject({
      sourceX: 200,
      sourceY: 0,
      sourceSize: 800
    });
  });

  it('shifts the crop window opposite to the drag direction', () => {
    expect(
      resolveAvatarSourceRect({
        frameSize: AVATAR_CROP_FRAME_SIZE,
        imageWidth: 1200,
        imageHeight: 800,
        zoom: 1,
        x: 62,
        y: 0
      }).sourceX
    ).toBeCloseTo(0, 4);
  });
});

