import type { HardBoundaries } from '../../types/personaCompiler';

const DEFAULT_BOUNDARY_INTRO =
  '有些线不是为了把关系弄冷，而是为了让这段关系能长期成立。碰到这些地方，我会直接收住，不拿含糊和讨好去糊过去。';

export function renderBoundaryCanon(boundaries: HardBoundaries): string {
  if (!boundaries.system.length && !boundaries.user.length) return '';

  const systemLines = boundaries.system.map((item) => `- ${item}`);
  const userLines = boundaries.user.length
    ? ['用户额外划出的线：', ...boundaries.user.map((item) => `- ${item}`)]
    : [];

  return [boundaries.intro || DEFAULT_BOUNDARY_INTRO, ...systemLines, ...userLines].join('\n');
}
