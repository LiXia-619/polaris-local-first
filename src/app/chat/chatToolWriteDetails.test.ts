import { describe, expect, it } from 'vitest';
import { buildToolCodeWriteDetails } from './chatToolWriteDetails';

describe('buildToolCodeWriteDetails', () => {
  it('uses whole-file effects for overwritten project files', () => {
    expect(buildToolCodeWriteDetails({
      kind: 'createProjectFile',
      file: {
        projectId: 'project-1',
        filePath: 'index.html',
        language: 'html',
        code: '<main>\n  <h1>New</h1>\n</main>'
      }
    }, [{
      projectId: 'project-1',
      fileId: 'file-1',
      filePath: 'index.html',
      operation: 'overwritten',
      beforeLines: 5,
      afterLines: 3
    }])).toEqual([{
      label: 'index.html',
      language: 'html',
      code: '<main>\n  <h1>New</h1>\n</main>',
      addedLines: 3,
      removedLines: 5
    }]);
  });

  it('keeps local replacement line counts from the replaced strings', () => {
    expect(buildToolCodeWriteDetails({
      kind: 'editProjectFileText',
      fileId: 'file-1',
      oldString: '<p>Old</p>',
      newString: '<section>\n  <p>New</p>\n</section>',
      targetLabel: 'index.html'
    })?.[0]).toMatchObject({
      label: 'index.html',
      addedLines: 3,
      removedLines: 1
    });
  });
});
