import { describe, expect, it } from 'vitest';
import { parseRoomProjectToolAction } from './assistantToolProtocolActionRoomProjects';

describe('parseRoomProjectToolAction', () => {
  it('parses room project creation payloads', () => {
    expect(parseRoomProjectToolAction({
      kind: 'createRoomProject',
      projectId: 'landing-refresh',
      title: 'Landing Refresh',
      slug: 'landing-refresh',
      tags: ['首页', '重构'],
      coverNote: '把首页重做成更稳的入口。',
      coverStyle: '& { background: #f7fbff; }',
      openInCollection: true
    })).toEqual({
      action: {
        kind: 'createRoomProject',
        project: {
          projectId: 'landing-refresh',
          title: 'Landing Refresh',
          slug: 'landing-refresh',
          tags: ['首页', '重构'],
          coverNote: '把首页重做成更稳的入口。',
          coverStyle: '& { background: #f7fbff; }'
        },
        targetLabel: undefined,
        openInCollection: true
      }
    });
  });

  it('parses room project shell metadata patches only', () => {
    expect(parseRoomProjectToolAction({
      kind: 'patchRoomProject',
      projectId: 'mini-phone',
      patch: {
        title: 'Mini Phone',
        coverNote: '小屏幕里的柔光入口。',
        coverStyle: '& { background: #10131c; }',
        tags: ['封面', '手机'],
        code: '<main />'
      }
    })).toEqual({
      action: {
        kind: 'patchRoomProject',
        projectId: 'mini-phone',
        targetLabel: undefined,
        patch: {
          title: 'Mini Phone',
          slug: undefined,
          tags: ['封面', '手机'],
          coverNote: '小屏幕里的柔光入口。',
          coverStyle: '& { background: #10131c; }'
        },
        openInCollection: true
      }
    });
  });

  it('parses card-to-project promotion without card-only fields', () => {
    expect(parseRoomProjectToolAction({
      kind: 'promoteCardToProject',
      target: 'active',
      projectTitle: 'Mini Phone',
      filePath: 'index.html',
      fileRole: 'entry',
      cardFaceCss: '& { color: red; }'
    })).toEqual({
      action: {
        kind: 'promoteCardToProject',
        target: 'active',
        projectTitle: 'Mini Phone',
        filePath: 'index.html',
        fileRole: 'entry',
        targetLabel: undefined,
        openInCollection: false
      }
    });
  });

  it('returns null for non room-project actions and issues for invalid patches', () => {
    expect(parseRoomProjectToolAction({ kind: 'readCodeCard', target: 'active' })).toBeNull();
    expect(parseRoomProjectToolAction({
      kind: 'patchRoomProject',
      projectId: 'mini-phone',
      patch: { code: '<main />' }
    })).toEqual({
      action: null,
      issue: '修改工作区外壳时缺少 title / coverNote / coverStyle / tags。'
    });
  });
});
