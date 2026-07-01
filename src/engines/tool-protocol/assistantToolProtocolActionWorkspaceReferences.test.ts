import { describe, expect, it } from 'vitest';
import { parseWorkspaceReferenceToolAction } from './assistantToolProtocolActionWorkspaceReferences';

describe('parseWorkspaceReferenceToolAction', () => {
  it('parses workspace reference directory and search actions', () => {
    expect(parseWorkspaceReferenceToolAction({
      kind: 'listWorkspaceReferences',
      projectId: 'project-1',
      targetLabel: '资料目录'
    })).toEqual({
      action: {
        kind: 'listWorkspaceReferences',
        projectId: 'project-1',
        targetLabel: '资料目录'
      }
    });

    expect(parseWorkspaceReferenceToolAction({
      kind: 'searchWorkspaceReferences',
      projectId: 'project-1',
      query: ' 白树 ',
      maxResults: 5
    })).toEqual({
      action: {
        kind: 'searchWorkspaceReferences',
        projectId: 'project-1',
        query: '白树',
        maxResults: 5,
        targetLabel: undefined
      }
    });
  });

  it('parses workspace reference reads by docId or title', () => {
    expect(parseWorkspaceReferenceToolAction({
      kind: 'readWorkspaceReference',
      projectId: 'project-1',
      target: 'workspace-ref-1'
    })).toEqual({
      action: {
        kind: 'readWorkspaceReference',
        projectId: 'project-1',
        docId: 'workspace-ref-1',
        title: undefined,
        targetLabel: undefined
      }
    });

    expect(parseWorkspaceReferenceToolAction({
      kind: 'readWorkspaceReference',
      title: '白树设定'
    })).toEqual({
      action: {
        kind: 'readWorkspaceReference',
        projectId: undefined,
        docId: undefined,
        title: '白树设定',
        targetLabel: undefined
      }
    });
  });

  it('parses readable context search actions', () => {
    expect(parseWorkspaceReferenceToolAction({
      kind: 'searchReadableContext',
      projectId: 'project-1',
      query: ' Nova ',
      maxResults: 8
    })).toEqual({
      action: {
        kind: 'searchReadableContext',
        query: 'Nova',
        projectId: 'project-1',
        maxResults: 8,
        targetLabel: undefined
      }
    });
  });

  it('returns null for unrelated actions and issues for missing required input', () => {
    expect(parseWorkspaceReferenceToolAction({ kind: 'readCodeCard', target: 'active' })).toBeNull();
    expect(parseWorkspaceReferenceToolAction({
      kind: 'searchWorkspaceReferences',
      query: '   '
    })).toEqual({
      action: null,
      issue: '搜索工作区参考资料时缺少 query。'
    });
    expect(parseWorkspaceReferenceToolAction({
      kind: 'readWorkspaceReference'
    })).toEqual({
      action: null,
      issue: '读取工作区参考资料时缺少 docId 或 title。'
    });
    expect(parseWorkspaceReferenceToolAction({
      kind: 'searchReadableContext',
      query: ''
    })).toEqual({
      action: null,
      issue: '搜索可读上下文时缺少 query。'
    });
  });
});
