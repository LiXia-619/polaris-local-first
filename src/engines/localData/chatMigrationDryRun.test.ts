import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { ChatMessage, Conversation } from '../../types/domain';
import {
  buildChatMigrationDryRunProjection,
  buildChatMigrationDryRunReport,
  summarizeChatMigrationDryRun
} from './chatMigrationDryRun';
import { buildChatMigrationDryRunReportFromExportZipBuffer } from './chatMigrationDryRunExport';

function message(id: string, timestamp: number, content = id): ChatMessage {
  return {
    id,
    role: 'user',
    content,
    timestamp
  };
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c-1',
    title: 'One',
    collaboratorId: 'pharos',
    activeProjectId: 'project-1',
    messages: [
      message('m-1', 10, 'hello polaris-asset://asset-1')
    ],
    workspaceLedger: [],
    task: null,
    draft: 'draft body',
    pinnedAt: null,
    updatedAt: 20,
    ...overrides
  };
}

async function exportZipBuffer(args: {
  chatState: {
    conversations: Conversation[];
    activeConversationId: string | null;
  };
  assetIds?: string[];
}) {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({
    format: 'polaris-export',
    version: 1,
    stores: {
      chat: 'stores/chat.json'
    },
    assets: {
      index: 'assets/index.json'
    }
  }));
  zip.file('stores/chat.json', JSON.stringify(args.chatState));
  zip.file('assets/index.json', JSON.stringify(
    (args.assetIds ?? []).map((id) => ({ id }))
  ));
  return await zip.generateAsync({ type: 'uint8array' });
}

describe('buildChatMigrationDryRunReport', () => {
  it('reports a clean reusable preflight for a complete chat export snapshot', async () => {
    const chatState = {
      conversations: [conversation()],
      activeConversationId: 'c-1'
    };

    const report = await buildChatMigrationDryRunReport({
      chatState,
      assetIndexIds: ['asset-1'],
      version: 7,
      committedAt: 100,
      validatedAt: 110
    });

    expect(report.ok).toBe(true);
    expect(report.summary).toEqual(expect.objectContaining({
      conversationCount: 1,
      messageCount: 1,
      activeConversationRecovered: true,
      totalMismatchCount: 0
    }));
    expect(report.projection).toEqual(expect.objectContaining({
      stagingHydrated: true,
      promotionReady: true,
      activeObjectCount: 1,
      quarantinedObjectCount: 0
    }));
    expect(report.mismatches).toEqual({
      missingConversationCount: 0,
      unexpectedConversationCount: 0,
      messageCountMismatchCount: 0,
      latestTimestampMismatchCount: 0,
      durableFieldMismatchCount: 0,
      assetProjectionMismatchCount: 0,
      missingAssetRefCount: 0
    });
  });

  it('detects durable field and message projection mismatches without exposing message text', async () => {
    const chatState = {
      conversations: [conversation()],
      activeConversationId: 'c-1'
    };
    const projection = await buildChatMigrationDryRunProjection({
      chatState,
      version: 7,
      committedAt: 100,
      validatedAt: 110
    });
    const row = projection.rows[0]!;
    row.record = {
      ...row.record!,
      value: {
        ...row.record!.value,
        draft: 'changed',
        messages: []
      }
    };

    const report = summarizeChatMigrationDryRun({
      chatState,
      assetIndexIds: ['asset-1'],
      projection
    });

    expect(report.ok).toBe(false);
    expect(report.mismatches.messageCountMismatchCount).toBe(1);
    expect(report.details.durableFieldMismatches).toEqual(
      expect.arrayContaining([
        { conversationId: 'c-1', field: 'draft' },
        { conversationId: 'c-1', field: 'messages' }
      ])
    );
    expect(JSON.stringify(report)).not.toContain('hello');
  });

  it('reports referenced assets that are missing from the export asset index', async () => {
    const buffer = await exportZipBuffer({
      chatState: {
        conversations: [conversation()],
        activeConversationId: 'c-1'
      },
      assetIds: []
    });

    const report = await buildChatMigrationDryRunReportFromExportZipBuffer(buffer);

    expect(report.ok).toBe(false);
    expect(report.assetRefs).toEqual(expect.objectContaining({
      referencedAssetCount: 1,
      projectedAssetRefCount: 1,
      assetIndexCount: 0,
      missingAssetRefCount: 1,
      missingAssetRefIds: ['asset-1']
    }));
  });

  it('blocks promotion when the source carries bulk quarantine and recovery markers', async () => {
    const chatState = {
      conversations: [conversation()],
      activeConversationId: 'c-1'
    };

    const report = await buildChatMigrationDryRunReport({
      chatState,
      assetIndexIds: ['asset-1'],
      sourceQuarantinedConversationIds: Array.from({ length: 12 }, (_value, index) => `c-quarantine-${index}`),
      sourceRecoveredConversationIds: Array.from({ length: 40 }, (_value, index) => `c-recovered-${index}`),
      version: 7,
      committedAt: 100,
      validatedAt: 110
    });

    expect(report.ok).toBe(false);
    expect(report.projection).toEqual(expect.objectContaining({
      promotionReady: false,
      promotionError: 'source-integrity:bulk-quarantine-recovered-markers'
    }));
    expect(report.sourceIntegrity).toEqual(expect.objectContaining({
      sourceConversationCount: 13,
      visibleConversationCount: 1,
      quarantinedConversationCount: 12,
      recoveredConversationCount: 40,
      bulkMarkerCount: 52,
      blockers: [
        'source-integrity:bulk-quarantine-recovered-markers',
        'source-integrity:visible-conversation-subset'
      ]
    }));
    expect(JSON.stringify(report)).not.toContain('hello');
  });

  it('keeps isolated source quarantine markers from blocking otherwise clean promotion', async () => {
    const chatState = {
      conversations: [conversation()],
      activeConversationId: 'c-1'
    };

    const report = await buildChatMigrationDryRunReport({
      chatState,
      assetIndexIds: ['asset-1'],
      sourceQuarantinedConversationIds: ['c-quarantine-isolated'],
      version: 7,
      committedAt: 100,
      validatedAt: 110
    });

    expect(report.ok).toBe(true);
    expect(report.projection.promotionReady).toBe(true);
    expect(report.sourceIntegrity).toEqual(expect.objectContaining({
      sourceConversationCount: 2,
      visibleConversationCount: 1,
      quarantinedConversationCount: 1,
      recoveredConversationCount: 0,
      bulkMarkerCount: 1,
      blockers: []
    }));
  });
});
