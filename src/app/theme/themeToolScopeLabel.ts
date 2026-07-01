import type { ThemeToolScope } from '../../types/domain';

export function themeToolScopeLabel(scope: ThemeToolScope): string {
  switch (scope) {
    case 'collection':
      return '房间';
    case 'chat':
      return '对话区';
    default:
      return '整页';
  }
}
