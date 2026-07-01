import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildLocalDataCensusReportFromExportZipBuffer } from './localDataExportRehearsal';
import { buildLocalDataExportStagingReadbackReportFromZipReader } from './localDataExportStagingReadback';

async function buildExportZipBuffer() {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({
    format: 'polaris-export',
    version: 1,
    createdAt: 1,
    appVersion: 'test',
    stores: {
      space: 'stores/space.json',
      chat: 'stores/chat.json',
      collection: 'stores/collection.json',
      persona: 'stores/persona.json',
      personaMemoryDocContent: 'stores/persona-memory-doc-content.json',
      runtime: 'stores/runtime.json'
    },
    assets: {
      count: 1,
      imageCount: 1,
      attachmentCount: 0,
      index: 'assets/index.json'
    }
  }));
  zip.file('stores/space.json', JSON.stringify({ collectionProjectId: 'project-1' }));
  zip.file('stores/chat.json', JSON.stringify({
    activeConversationId: 'conv-1',
    conversations: [{
      id: 'conv-1',
      title: 'Source',
      collaboratorId: 'pharos',
      activeProjectId: 'project-1',
      messages: [{
        id: 'm-1',
        role: 'user',
        content: '',
        timestamp: 1,
        attachments: [{ id: 'a-1', assetId: 'asset-1', kind: 'image', name: 'a.png', mimeType: 'image/png', size: 3 }]
      }],
      pinnedAt: null,
      updatedAt: 1
    }]
  }));
  zip.file('stores/collection.json', JSON.stringify({
    cards: [{
      id: 'card-1',
      title: 'Card',
      language: 'txt',
      code: '',
      tags: [],
      source: 'chat-generated',
      originConversationId: 'conv-1',
      createdAt: 1,
      updatedAt: 1
    }],
    projectFiles: [{
      id: 'file-1',
      projectId: 'project-1',
      filePath: 'index.html',
      language: 'html',
      content: '',
      source: 'chat-generated',
      createdAt: 1,
      updatedAt: 1
    }, {
      id: 'file-2',
      projectId: 'recovered-project',
      filePath: 'README.md',
      language: 'markdown',
      content: '',
      ownerCollaboratorId: 'pharos',
      source: 'imported',
      createdAt: 1,
      updatedAt: 1
    }],
    workspaceReferenceDocs: [{
      id: 'doc-1',
      projectId: 'project-1',
      title: 'Doc',
      summary: '',
      content: 'body',
      source: 'chat-generated',
      createdAt: 1,
      updatedAt: 1
    }],
    roomProjects: [{
      id: 'project-1',
      title: 'Project',
      slug: 'project',
      fileIds: ['file-1'],
      tags: [],
      source: 'chat-generated',
      createdAt: 1,
      updatedAt: 1
    }],
    imageCards: [{
      id: 'image-1',
      assetId: 'asset-1',
      title: 'Image',
      tags: [],
      source: 'chat-generated',
      originConversationId: 'conv-1',
      createdAt: 1,
      updatedAt: 1
    }]
  }));
  zip.file('stores/persona.json', JSON.stringify({
    activeCollaboratorId: 'pharos',
    personas: [{
      id: 'pharos',
      name: 'Pharos',
      memory: { referenceDocs: [] }
    }]
  }));
  zip.file('stores/persona-memory-doc-content.json', JSON.stringify({ version: 1, docs: {} }));
  zip.file('stores/runtime.json', JSON.stringify({
    providers: [{
      id: 'p',
      name: 'Provider',
      baseUrl: '',
      apiKey: '',
      model: '',
      capabilities: {}
    }],
    activeProviderId: 'p'
  }));
  zip.file('assets/index.json', JSON.stringify([{
    id: 'asset-1',
    kind: 'image',
    name: 'a.png',
    mimeType: 'image/png',
    size: 3,
    createdAt: 1,
    filePath: 'assets/images/asset-1.png',
    previewPath: 'previews/images/asset-1.jpg'
  }]));
  zip.file('assets/images/asset-1.png', 'not-read');
  zip.file('previews/images/asset-1.jpg', 'not-read');
  return await zip.generateAsync({ type: 'uint8array' });
}

async function buildExportZipWithMissingChatAssetBuffer() {
  const zip = await JSZip.loadAsync(await buildExportZipBuffer());
  const chat = JSON.parse(await zip.file('stores/chat.json')!.async('string'));
  chat.conversations[0].messages[0].attachments.push({
    id: 'a-missing',
    assetId: 'asset-missing',
    kind: 'image',
    name: 'missing.png',
    mimeType: 'image/png',
    size: 3
  });
  zip.file('stores/chat.json', JSON.stringify(chat));
  return await zip.generateAsync({ type: 'uint8array' });
}

describe('buildLocalDataCensusReportFromExportZipBuffer', () => {
  it('rehearses a Polaris export zip as the post-import local data shape', async () => {
    const report = await buildLocalDataCensusReportFromExportZipBuffer(await buildExportZipBuffer());
    const collection = report.domains.find((domain) => domain.domain === 'collection');
    const asset = report.domains.find((domain) => domain.domain === 'asset');

    expect(collection).toEqual(expect.objectContaining({
      baselineObjectIds: expect.arrayContaining(['project:recovered-project', 'project-file:file-2']),
      missingOwnerObjectIds: ['card:card-1', 'image-card:image-1', 'project-file:file-1', 'project:project-1', 'workspace-doc:doc-1'],
      recoverableOwnerObjectIds: ['card:card-1', 'image-card:image-1', 'project-file:file-1', 'project:project-1', 'workspace-doc:doc-1'],
      unresolvedOwnerObjectIds: [],
      metadataIssueIds: []
    }));
    expect(asset).toEqual(expect.objectContaining({
      missingBodyObjectIds: [],
      orphanBodyObjectIds: []
    }));
    expect(report.totals).toEqual(expect.objectContaining({
      recoverableOwnerObjectCount: 5,
      unresolvedOwnerObjectCount: 0,
      missingAssetBinaryRefCount: 0
    }));
  });

  it('commits export stores into repository rows and reads staging back without promoting active source', async () => {
    const zip = await JSZip.loadAsync(await buildExportZipBuffer());
    const report = await buildLocalDataExportStagingReadbackReportFromZipReader({
      zip,
      committedAt: 10,
      validatedAt: 11
    });

    expect(report.repository.activeDataSource).toBe('unknown');
    expect(report.repository.pointerCount).toBe(7);
    expect(report.chat.contentPromotionReady).toBe(true);
    expect(report.chat.stagingHydrated).toBe(true);
    expect(report.collection.actualRepositoryRowCount).toBe(report.collection.expectedRepositoryRowCount);
    expect(report.persona.actualRepositoryRowCount).toBe(report.persona.expectedRepositoryRowCount);
    expect(report.runtime.actualRepositoryRowCount).toBe(report.runtime.expectedRepositoryRowCount);
    expect(report.space.actualRepositoryRowCount).toBe(report.space.expectedRepositoryRowCount);
    expect(report.document.actualRepositoryRowCount).toBe(report.document.expectedRepositoryRowCount);
    expect(report.asset.actualRepositoryRowCount).toBe(report.asset.expectedRepositoryRowCount);
    expect(report.readiness.canHydrate).toBe(true);
    expect(report.readiness.canPromote).toBe(true);
    expect(report.validationFailures).toEqual({});
    expect(report.readiness.domains.map((domain) => [domain.domain, domain.status])).toEqual([
      ['chat', 'promotion_ready'],
      ['collection', 'promotion_ready'],
      ['persona', 'promotion_ready'],
      ['runtime', 'promotion_ready'],
      ['space', 'promotion_ready'],
      ['asset', 'promotion_ready'],
      ['document', 'promotion_ready']
    ]);
  });

  it('treats missing legacy chat attachment assets as source issues instead of migration failure', async () => {
    const zip = await JSZip.loadAsync(await buildExportZipWithMissingChatAssetBuffer());
    const report = await buildLocalDataExportStagingReadbackReportFromZipReader({
      zip,
      committedAt: 10,
      validatedAt: 11
    });

    expect(report.census.ok).toBe(false);
    expect(report.source.missingAssetMetaRefCount).toBe(1);
    expect(report.source.missingAssetBinaryRefCount).toBe(1);
    expect(report.ok).toBe(true);
    expect(report.chat.ok).toBe(true);
    expect(report.readiness.canHydrate).toBe(true);
    expect(report.readiness.canPromote).toBe(true);
    expect(report.readiness.blockers).toEqual([]);
    expect(report.readiness.domains.find((domain) => domain.domain === 'chat')).toEqual(expect.objectContaining({
      status: 'promotion_ready_with_source_issues',
      promotionReady: true,
      blockers: ['chat:missing-asset-meta', 'chat:missing-asset-binary'],
      reasons: []
    }));
  });
});
