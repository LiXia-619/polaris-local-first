import type { World } from '../../types/domain';

export function isWorldFrameInteractive(activeWorld: World, shellWorld: World, frameWorld: World) {
  return activeWorld === frameWorld && shellWorld === frameWorld;
}
