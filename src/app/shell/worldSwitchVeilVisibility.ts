import type { World } from '../../types/domain';

export function shouldShowWorldSwitchVeil(activeWorld: World) {
  return activeWorld !== 'group';
}
