import { describe, expect, it } from 'vitest';
import { LOCAL_DATA_LIVE_PROMOTION_RESULT_KEY } from '../engines/localData/livePromotionSummary';
import { getLocalDataActiveDataSourceKey } from '../engines/localData/types';
import { buildLocalDataHealthSnapshot, estimateLocalDataBytes } from './localDataHealth';

describe('estimateLocalDataBytes', () => {
  it('counts string and blob payloads', () => {
    expect(estimateLocalDataBytes('hello')).toBe(5);
    expect(estimateLocalDataBytes(new Blob(['hello']))).toBe(5);
  });
});

describe('buildLocalDataHealthSnapshot', () => {
  it('groups persisted product, asset, and diagnostic payloads without exposing raw content', () => {
    const snapshot = buildLocalDataHealthSnapshot({
      now: 123,
      kv: [
        { key: 'chat-index-v2', value: { conversations: ['c-1'] } },
        { key: 'chat-messages-v2:c-1', value: [{ role: 'user', content: 'secret' }] },
        { key: 'chat-commit-pointer-v1', value: { schemaVersion: 1, currentCommitId: 'commit-1' } },
        {
          key: 'chat-manifest-v1:commit-1',
          value: {
            schemaVersion: 1,
            commitId: 'commit-1',
            conversations: [{
              id: 'c-1',
              messageKey: 'chat-message-v1:commit-1:c-1'
            }],
            quarantinedConversationIds: ['c-orphan']
          }
        },
        { key: 'chat-message-v1:commit-1:c-1', value: [{ role: 'user', content: 'secret' }] },
        {
          key: 'chat-catalog-v1',
          value: {
            schemaVersion: 1,
            updatedAt: 1,
            activeConversationId: 'c-1',
            conversations: [{
              id: 'c-1',
              collaboratorId: 'pharos',
              recordKey: 'chat-conversation-record-v1:c-1',
              messageCount: 1,
              latestMessageTimestamp: 1
            }],
            deletedConversationIds: [],
            quarantinedConversationIds: ['c-orphan']
          }
        },
        {
          key: 'chat-conversation-record-v1:c-1',
          value: {
            schemaVersion: 1,
            createdAt: 1,
            updatedAt: 1,
            conversation: { id: 'c-1' },
            messages: [{ role: 'user', content: 'secret' }],
            messageCount: 1,
            latestMessageTimestamp: 1
          }
        },
        {
          key: 'collection-state-v2',
          value: {
            cards: [{ title: 'Card' }],
            projectFiles: [
              { id: 'file-1', content: 'project source body' },
              { id: 'file-2', content: 'second source body' }
            ],
            workspaceReferenceDocs: [{ id: 'workspace-doc-1' }]
          }
        },
        { key: 'workspace-reference-doc-content-v1:workspace-doc-1', value: 'workspace reference body' },
        { key: 'workspace-reference-doc-content-v1:workspace-doc-deleted', value: 'deleted workspace body' },
        { key: 'workspace-reference-doc-content-v2:workspace-doc-1:0', value: 'workspace chunk 1' },
        { key: 'workspace-reference-doc-content-v2:workspace-doc-1:1', value: 'workspace chunk 2' },
        { key: 'workspace-reference-doc-content-v2:workspace-doc-deleted:0', value: 'deleted workspace chunk' },
        { key: 'runtime-providers-v2', value: { providers: [] } },
        { key: 'space-theme-state-v1', value: { theme: {} } },
        {
          key: 'persona-state-v2',
          value: {
            personas: [{
              id: 'pharos',
              memory: {
                referenceDocs: [{ id: 'doc-1' }]
              }
            }]
          }
        },
        { key: 'persona-memory-doc-content-v1', value: { version: 1, docs: { 'pharos:doc-1': 'long memory' } } },
        { key: 'persona-memory-doc-content-v2:pharos:doc-1', value: 'long memory body' },
        { key: 'persona-memory-doc-content-v2:pharos:doc-deleted', value: 'deleted memory body' },
        { key: 'persona-memory-doc-content-v3:pharos:doc-1:0', value: 'chunk 1' },
        { key: 'persona-memory-doc-content-v3:pharos:doc-1:1', value: 'chunk 2' },
        { key: 'persona-memory-doc-content-v3:pharos:doc-deleted:0', value: 'deleted chunk' },
        { key: 'memory-vector-index-meta-v1:pharos', value: { entryCount: 1 } },
        { key: 'memory-vector-index-entry-v1:pharos:chunk-1', value: { semanticText: 'memory index material' } }
      ],
      storage: {
        mode: 'native',
        label: '原生存储',
        detail: '当前数据读写走 iOS 原生存储。'
      },
      assetMeta: [
        { key: 'asset-1', value: { id: 'asset-1', kind: 'image', name: 'a.png', mimeType: 'image/png', size: 4, createdAt: 1 } },
        { key: 'asset-missing-binary', value: { id: 'asset-missing-binary', kind: 'file', name: 'b.txt', mimeType: 'text/plain', size: 4, createdAt: 1 } }
      ],
      assetBinary: [
        { key: 'asset-1', value: new Blob(['binary-bytes']) },
        { key: 'asset-orphan-binary', value: new Blob(['orphan']) }
      ],
      assetPreview: [
        { key: 'asset-1', value: new Blob(['preview-preview']) },
        { key: 'asset-preview-only', value: new Blob(['preview']) }
      ],
      localStorage: [
        { key: 'polaris-request-debug-log', value: '[{"content":"secret"}]' },
        { key: 'polaris-space-store-v1', value: '{"state":{}}' },
        {
          key: LOCAL_DATA_LIVE_PROMOTION_RESULT_KEY,
          value: JSON.stringify({
            ok: true,
            startedAt: 100,
            completedAt: 110,
            activeDataSource: 'repository',
            activeDomains: ['chat', 'collection', 'persona', 'runtime', 'space'],
            activeCommits: [{ domain: 'chat', version: 1, committedAt: 100, commitId: 'chat-commit' }],
            skippedDomains: [{ domain: 'runtime', status: 'blocked', reasons: ['validation-missing'] }],
            staging: {
              readiness: {
                canHydrate: true,
                canPromote: true,
                blockerCount: 0,
                warningCount: 1,
                domains: [{ domain: 'chat', promotionReady: true, status: 'promotion_ready', reasonCount: 0, rowCount: 2, completeRowCount: 2, nonCompleteRowCount: 0, remediationCount: 0 }]
              }
            },
            readiness: {
              canHydrate: true,
              canPromote: true,
              blockerCount: 0,
              warningCount: 1,
              domains: [{ domain: 'chat', promotionReady: true, status: 'promotion_ready', reasonCount: 0, rowCount: 2, completeRowCount: 2, nonCompleteRowCount: 0, remediationCount: 0 }]
            }
          })
        }
      ]
    });

    expect(snapshot.generatedAt).toBe(123);
    expect(snapshot.buckets.find((bucket) => bucket.id === 'chat')?.entryCount).toBe(7);
    expect(snapshot.buckets.find((bucket) => bucket.id === 'collection')?.entryCount).toBe(6);
    expect(snapshot.buckets.find((bucket) => bucket.id === 'persona')?.entryCount).toBe(9);
    expect(snapshot.buckets.find((bucket) => bucket.id === 'assets')?.entryCount).toBe(2);
    expect(snapshot.buckets.find((bucket) => bucket.id === 'assets')?.bytes).toBeGreaterThan(estimateLocalDataBytes({
      id: 'asset-1',
      kind: 'image',
      name: 'a.png',
      mimeType: 'image/png',
      size: 4,
      createdAt: 1
    }));
    expect(snapshot.buckets.find((bucket) => bucket.id === 'diagnostics')?.entryCount).toBe(1);
    expect(snapshot.storage.mode).toBe('native');
    expect(snapshot.chatPersistence).toEqual(expect.objectContaining({
      hasCatalog: true,
      catalogConversationCount: 1,
      conversationRecordCount: 1,
      missingConversationRecordCount: 0,
      orphanedConversationRecordCount: 0,
      deletedCatalogConversationCount: 0,
      hasCommitPointer: true,
      hasCurrentManifest: true,
      manifestConversationCount: 1,
      quarantinedConversationCount: 1,
      legacyMessageChunkCount: 1
    }));
    expect(snapshot.personaMemoryDocs).toEqual({
      splitDocBodyCount: 2,
      orphanedSplitDocBodyCount: 1,
      chunkedDocBodyCount: 2,
      chunkedDocBodyChunkCount: 3,
      orphanedChunkedDocBodyCount: 1,
      legacyDocBodyCount: 1
    });
    expect(snapshot.collectionSources).toEqual({
      projectFileCount: 2,
      projectFileContentBytes: estimateLocalDataBytes('project source body') + estimateLocalDataBytes('second source body'),
      workspaceReferenceDocCount: 1
    });
    expect(snapshot.workspaceReferenceDocs).toEqual({
      splitDocBodyCount: 2,
      orphanedSplitDocBodyCount: 1,
      chunkedDocBodyCount: 2,
      chunkedDocBodyChunkCount: 3,
      orphanedChunkedDocBodyCount: 1
    });
    expect(snapshot.assetStorage).toEqual({
      metaCount: 2,
      binaryCount: 2,
      previewCount: 2,
      completeAssetCount: 1,
      missingBinaryAssetCount: 1,
      orphanBinaryAssetCount: 1,
      orphanPreviewCacheCount: 1,
      oversizedPreviewCount: 1
    });
    expect(snapshot.censusReport).toEqual(expect.objectContaining({
      ok: false,
      activeDataSource: 'unknown'
    }));
    expect(snapshot.censusReport.totals).toEqual(expect.objectContaining({
      missingAssetBinaryRefCount: 0,
      orphanBodyObjectCount: 7
    }));
    expect(snapshot.censusReport.domains.find((domain) => domain.domain === 'document')).toEqual(expect.objectContaining({
      baselineObjectIds: ['persona-memory-doc:pharos:doc-1', 'workspace-reference-doc:workspace-doc-1'],
      orphanBodyObjectIds: ['persona:pharos:doc-deleted', 'workspace:workspace-doc-deleted']
    }));
    expect(snapshot.livePromotion).toEqual(expect.objectContaining({
      ok: true,
      activeDataSource: 'repository',
      activeDomains: ['chat', 'collection', 'persona', 'runtime', 'space'],
      skippedDomains: [{ domain: 'runtime', status: 'blocked', reasons: ['validation-missing'] }],
      promotionReadiness: expect.objectContaining({
        canPromote: true,
        blockerCount: 0
      })
    }));
    expect(snapshot.promotionReadiness).toEqual(expect.objectContaining({
      canHydrate: false,
      canPromote: false
    }));
    expect(snapshot.domainSources.find((domain) => domain.domain === 'chat')).toEqual(expect.objectContaining({
      status: 'local-data-live',
      objectCount: 1,
      legacySourceCount: 5,
      issueCount: 0
    }));
    expect(snapshot.domainSources.find((domain) => domain.domain === 'document')).toEqual(expect.objectContaining({
      status: 'ledger-only',
      issueCount: expect.any(Number)
    }));
    expect(snapshot.totalBytes).toBeGreaterThan(0);
  });

  it('separates live chat LocalData from repository staging and empty domains', () => {
    const snapshot = buildLocalDataHealthSnapshot({
      now: 123,
      kv: [
        {
          key: 'chat-catalog-v1',
          value: {
            activeConversationId: 'c-live',
            conversations: [{
              id: 'c-live',
              title: 'Live',
              collaboratorId: 'pharos',
              recordKey: 'chat-conversation-record-v1:c-live'
            }]
          }
        },
        {
          key: 'chat-conversation-record-v1:c-live',
          value: {
            id: 'c-live',
            messages: [],
            assetRefs: []
          }
        },
        {
          key: 'persona-state-v2',
          value: {
            activeCollaboratorId: 'pharos',
            personas: [{ id: 'pharos', memory: { referenceDocs: [] } }]
          }
        },
        {
          key: getLocalDataActiveDataSourceKey(),
          value: {
            schemaVersion: 1,
            key: getLocalDataActiveDataSourceKey(),
            activeDataSource: 'unknown',
            activeCommitId: null,
            stagingCommitId: null,
            updatedAt: 100,
            domains: {}
          }
        }
      ],
      assetMeta: [],
      localStorage: []
    });

    expect(snapshot.domainSources.find((domain) => domain.domain === 'chat')).toEqual(expect.objectContaining({
      status: 'local-data-live',
      activeObjectCount: 1,
      repositoryRowCount: 0,
      legacySourceCount: 0,
      issueCount: 0
    }));
    expect(snapshot.domainSources.find((domain) => domain.domain === 'collection')).toEqual(expect.objectContaining({
      status: 'empty',
      objectCount: 0
    }));
  });

  it('marks repository source as active separately from readiness issues', () => {
    const snapshot = buildLocalDataHealthSnapshot({
      now: 123,
      kv: [
        {
          key: getLocalDataActiveDataSourceKey(),
          value: {
            schemaVersion: 1,
            key: getLocalDataActiveDataSourceKey(),
            activeDataSource: 'repository',
            activeCommitId: 'collection-commit',
            stagingCommitId: null,
            updatedAt: 100,
            domains: {}
          }
        },
        {
          key: 'local-data-v1:row:collection:card:card-1',
          value: {
            schemaVersion: 1,
            key: 'local-data-v1:row:collection:card:card-1',
            ref: { domain: 'collection', kind: 'card', id: 'card-1' },
            version: 1,
            updatedAt: 100,
            state: 'incomplete',
            reason: 'test'
          }
        }
      ],
      assetMeta: [],
      localStorage: []
    });

    expect(snapshot.domainSources.find((domain) => domain.domain === 'collection')).toEqual(expect.objectContaining({
      status: 'repository-active',
      repositoryRowCount: 1
    }));
    expect(snapshot.domainSources.find((domain) => domain.domain === 'collection')?.issues).toContain('非完整暂存行 1');
  });

  it('counts chat orphan and stale commit evidence without reading message text', () => {
    const snapshot = buildLocalDataHealthSnapshot({
      now: 123,
      kv: [
        { key: 'chat-commit-pointer-v1', value: { schemaVersion: 1, currentCommitId: 'commit-current' } },
        {
          key: 'chat-manifest-v1:commit-current',
          value: {
            schemaVersion: 1,
            commitId: 'commit-current',
            conversations: [{
              id: 'c-current',
              messageKey: 'chat-message-v1:commit-current:c-current'
            }],
            deletedConversationIds: ['c-deleted']
          }
        },
        { key: 'chat-manifest-v1:commit-old', value: { schemaVersion: 1, commitId: 'commit-old', conversations: [] } },
        { key: 'chat-message-v1:commit-current:c-current', value: [{ content: 'secret' }] },
        { key: 'chat-message-v1:commit-old:c-old', value: [{ content: 'secret' }] },
        { key: 'chat-messages-v2:c-current', value: [{ content: 'secret' }] },
        { key: 'chat-messages-v2:c-orphan', value: [{ content: 'secret' }] },
        { key: 'chat-messages-v2:c-deleted', value: [{ content: 'secret' }] },
        { key: 'chat-conversation-v1:c-deleted', value: { id: 'c-deleted' } },
        { key: 'chat-conversation-v1:c-orphan', value: { id: 'c-orphan' } },
        { key: 'chat-index-v2-pending', value: { conversations: [] } }
      ],
      assetMeta: [],
      localStorage: []
    });

    expect(snapshot.chatPersistence).toEqual(expect.objectContaining({
      orphanedLegacyMessageChunkCount: 1,
      staleCommitManifestCount: 1,
      staleCommittedMessageChunkCount: 1,
      tombstonedLegacyMessageChunkCount: 1,
      tombstonedConversationEnvelopeCount: 1,
      pendingLegacyIndexCount: 1,
      legacyMessageChunkCount: 3
    }));
  });

  it('uses asset keys and metadata sizes for lightweight health without reading asset blobs', () => {
    const snapshot = buildLocalDataHealthSnapshot({
      now: 123,
      kv: [],
      assetMeta: [
        { key: 'asset-1', value: { id: 'asset-1', kind: 'image', name: 'a.png', mimeType: 'image/png', size: 42, createdAt: 1 } },
        { key: 'asset-missing-binary', value: { id: 'asset-missing-binary', kind: 'file', name: 'b.txt', mimeType: 'text/plain', size: 8, createdAt: 1 } }
      ],
      assetBinaryKeys: ['asset-1', 'asset-orphan-binary'],
      assetPreviewKeys: ['asset-1', 'asset-preview-only'],
      localStorage: []
    });

    expect(snapshot.buckets.find((bucket) => bucket.id === 'assets')?.bytes).toBeGreaterThanOrEqual(50);
    expect(snapshot.assetStorage).toEqual({
      metaCount: 2,
      binaryCount: 2,
      previewCount: 2,
      completeAssetCount: 1,
      missingBinaryAssetCount: 1,
      orphanBinaryAssetCount: 1,
      orphanPreviewCacheCount: 1,
      oversizedPreviewCount: 0
    });
    expect(snapshot.census.asset).toEqual(expect.objectContaining({
      storedMetaCount: 2,
      storedBinaryCount: 2,
      storedPreviewCount: 2,
      storedOrphanAssetCount: 3,
      previewOnlyCount: 1
    }));
  });

  it('reports missing collaborator owners from chat references and orphan memory bodies', () => {
    const deletedPersonaRowKey = 'local-data-v1:row:persona:collaborator:persona-deleted';
    const snapshot = buildLocalDataHealthSnapshot({
      now: 123,
      kv: [
        {
          key: 'chat-catalog-v1',
          value: {
            activeConversationId: 'c-deleted',
            conversations: [{
              id: 'c-deleted',
              collaboratorId: 'persona-deleted',
              recordKey: 'chat-conversation-record-v1:c-deleted'
            }]
          }
        },
        {
          key: 'persona-state-v2',
          value: {
            activeCollaboratorId: 'pharos',
            personas: [
              { id: 'pharos', memory: { referenceDocs: [] } },
              { id: 'polaris-assistant', memory: { referenceDocs: [] } }
            ]
          }
        },
        {
          key: deletedPersonaRowKey,
          value: {
            schemaVersion: 1,
            key: deletedPersonaRowKey,
            ref: { domain: 'persona', kind: 'collaborator', id: 'persona-deleted' },
            version: 3,
            updatedAt: 200,
            state: 'deleted',
            deletedAt: 210
          }
        },
        { key: 'persona-memory-doc-content-v2:persona-deleted:doc-1', value: 'deleted collaborator memory body' },
        { key: 'persona-memory-doc-content-v3:persona-deleted:doc-2:0', value: 'chunk 1' },
        { key: 'persona-memory-doc-content-v3:persona-deleted:doc-2:1', value: 'chunk 2' },
        { key: 'persona-memory-doc-content-v2:persona-memory-only:doc-3', value: 'memory-only body' }
      ],
      assetMeta: [],
      localStorage: []
    });

    expect(snapshot.collaboratorOrphans).toEqual([
      {
        collaboratorId: 'persona-deleted',
        rowKey: deletedPersonaRowKey,
        rowState: 'deleted',
        rowUpdatedAt: 200,
        rowDeletedAt: 210,
        repositoryRowPresent: true,
        personaStateHasId: false,
        referencedByLiveOwnerRef: true,
        hasOrphanMemoryBodies: true,
        splitMemoryBodyCount: 1,
        chunkedMemoryBodyCount: 1,
        chunkedMemoryBodyChunkCount: 2
      },
      {
        collaboratorId: 'persona-memory-only',
        rowKey: 'local-data-v1:row:persona:collaborator:persona-memory-only',
        rowState: 'missing',
        rowUpdatedAt: null,
        rowDeletedAt: null,
        repositoryRowPresent: false,
        personaStateHasId: false,
        referencedByLiveOwnerRef: false,
        hasOrphanMemoryBodies: true,
        splitMemoryBodyCount: 1,
        chunkedMemoryBodyCount: 0,
        chunkedMemoryBodyChunkCount: 0
      }
    ]);
  });
});
