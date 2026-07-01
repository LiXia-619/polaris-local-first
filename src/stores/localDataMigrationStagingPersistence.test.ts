import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LocalDataDomain,
  LocalDataMigrationValidationReport,
  LocalDataPromotionReadinessReport
} from '../engines/localData';
import { readLocalDataPromotionReadinessEvidence } from '../infrastructure/localDataPromotionReadiness';
import { writeLocalDataMigrationValidationReport } from '../infrastructure/localDataMigrationValidationEvidence';
import { commitAssetRowsMigrationFromCurrentPersistence } from './assetMigrationPersistence';
import { commitChatMigrationStagingFromCurrentPersistence } from './chatMigrationDryRunPersistence';
import { commitCollectionRowsMigrationFromCurrentPersistence } from './collectionMigrationPersistence';
import { commitDocumentRowsMigrationFromCurrentPersistence } from './documentMigrationPersistence';
import {
  commitAndPromoteLocalDataLiveSourceDomainsFromCurrentPersistence,
  commitLocalDataLiveSourceStagingMigrationsFromCurrentPersistence,
  commitLocalDataStagingMigrationsFromCurrentPersistence
} from './localDataMigrationStagingPersistence';
import { promoteLocalDataLiveSourceDomains } from './localDataSourcePromotionPersistence';
import { commitPersonaRowsMigrationFromCurrentPersistence } from './personaMigrationPersistence';
import { commitRuntimeRowsMigrationFromCurrentPersistence } from './runtimeMigrationPersistence';
import { commitSpaceRowsMigrationFromCurrentPersistence } from './spaceMigrationPersistence';

vi.mock('./chatMigrationDryRunPersistence', () => ({
  commitChatMigrationStagingFromCurrentPersistence: vi.fn()
}));
vi.mock('./collectionMigrationPersistence', () => ({
  commitCollectionRowsMigrationFromCurrentPersistence: vi.fn()
}));
vi.mock('./personaMigrationPersistence', () => ({
  commitPersonaRowsMigrationFromCurrentPersistence: vi.fn()
}));
vi.mock('./runtimeMigrationPersistence', () => ({
  commitRuntimeRowsMigrationFromCurrentPersistence: vi.fn()
}));
vi.mock('./spaceMigrationPersistence', () => ({
  commitSpaceRowsMigrationFromCurrentPersistence: vi.fn()
}));
vi.mock('./documentMigrationPersistence', () => ({
  commitDocumentRowsMigrationFromCurrentPersistence: vi.fn()
}));
vi.mock('./assetMigrationPersistence', () => ({
  commitAssetRowsMigrationFromCurrentPersistence: vi.fn()
}));
vi.mock('../infrastructure/localDataPromotionReadiness', () => ({
  readLocalDataPromotionReadinessEvidence: vi.fn()
}));
vi.mock('../infrastructure/localDataMigrationValidationEvidence', () => ({
  writeLocalDataMigrationValidationReport: vi.fn()
}));
vi.mock('./localDataSourcePromotionPersistence', () => ({
  promoteLocalDataLiveSourceDomains: vi.fn()
}));

const chatValidationReport: LocalDataMigrationValidationReport = {
  id: 'chat:commit:validation',
  domain: 'chat',
  commitId: 'chat-commit',
  version: 7,
  validatedAt: 101,
  stagingHydrated: true,
  legacyBaselineCount: 0,
  legacyBaselineObjectIds: [],
  activeBaselineObjectIds: [],
  activeObjectCount: 0,
  activeObjectIds: [],
  quarantinedObjectCount: 0,
  quarantinedObjectIds: [],
  duplicateObjectIdCount: 0,
  missingActiveCollaboratorIdCount: 0,
  missingActiveCollaboratorIds: [],
  activeIncompleteRowCount: 0,
  activeTimedOutRowCount: 0,
  recoveredMetadata: {
    activeConversationId: null
  }
};

const readinessReport: LocalDataPromotionReadinessReport = {
  canHydrate: true,
  canPromote: true,
  activeDataSource: 'unknown',
  domains: [],
  blockers: [],
  warnings: []
};

function validationReport(domain: LocalDataDomain): LocalDataMigrationValidationReport {
  return {
    id: `${domain}:commit:validation`,
    domain,
    commitId: `${domain}-commit`,
    version: 7,
    validatedAt: 101,
    stagingHydrated: true,
    legacyBaselineCount: 0,
    legacyBaselineObjectIds: [],
    activeBaselineObjectIds: [],
    activeObjectCount: 0,
    activeObjectIds: [],
    quarantinedObjectCount: 0,
    quarantinedObjectIds: [],
    duplicateObjectIdCount: 0,
    missingActiveCollaboratorIdCount: 0,
    missingActiveCollaboratorIds: [],
    activeIncompleteRowCount: 0,
    activeTimedOutRowCount: 0,
    recoveredMetadata: domain === 'chat'
      ? { activeConversationId: null }
      : domain === 'collection'
        ? { activeProjectId: null }
        : domain === 'persona'
          ? { activeCollaboratorId: null }
          : {}
  };
}

const validationReports: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>> = {
  chat: chatValidationReport,
  collection: validationReport('collection'),
  persona: validationReport('persona'),
  runtime: validationReport('runtime'),
  space: validationReport('space'),
  document: validationReport('document'),
  asset: validationReport('asset')
};

function mockResult(domain: string) {
  return {
    commitMeta: {
      domain,
      version: 7,
      committedAt: 100,
      commitId: `${domain}-commit`
    },
    census: {
      ok: true
    }
  };
}

function setupSuccessMocks(calls: string[]) {
  vi.mocked(commitChatMigrationStagingFromCurrentPersistence).mockImplementation(async () => {
    calls.push('chat');
    return {
      report: { ok: true },
      promotionEvidence: {
        commitMeta: {
          domain: 'chat',
          version: 7,
          committedAt: 100,
          commitId: 'chat-commit'
        },
        validationReport: chatValidationReport
      }
    } as Awaited<ReturnType<typeof commitChatMigrationStagingFromCurrentPersistence>>;
  });
  vi.mocked(commitCollectionRowsMigrationFromCurrentPersistence).mockImplementation(async () => {
    calls.push('collection');
    return mockResult('collection') as Awaited<ReturnType<typeof commitCollectionRowsMigrationFromCurrentPersistence>>;
  });
  vi.mocked(commitPersonaRowsMigrationFromCurrentPersistence).mockImplementation(async () => {
    calls.push('persona');
    return mockResult('persona') as Awaited<ReturnType<typeof commitPersonaRowsMigrationFromCurrentPersistence>>;
  });
  vi.mocked(commitRuntimeRowsMigrationFromCurrentPersistence).mockImplementation(async () => {
    calls.push('runtime');
    return mockResult('runtime') as Awaited<ReturnType<typeof commitRuntimeRowsMigrationFromCurrentPersistence>>;
  });
  vi.mocked(commitSpaceRowsMigrationFromCurrentPersistence).mockImplementation(async () => {
    calls.push('space');
    return mockResult('space') as Awaited<ReturnType<typeof commitSpaceRowsMigrationFromCurrentPersistence>>;
  });
  vi.mocked(commitDocumentRowsMigrationFromCurrentPersistence).mockImplementation(async () => {
    calls.push('document');
    return mockResult('document') as Awaited<ReturnType<typeof commitDocumentRowsMigrationFromCurrentPersistence>>;
  });
  vi.mocked(commitAssetRowsMigrationFromCurrentPersistence).mockImplementation(async () => {
    calls.push('asset');
    return mockResult('asset') as Awaited<ReturnType<typeof commitAssetRowsMigrationFromCurrentPersistence>>;
  });
  vi.mocked(readLocalDataPromotionReadinessEvidence).mockImplementation(async () => {
    calls.push('readiness');
    return {
      readiness: readinessReport,
      validationReports,
      validationFailures: {}
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(writeLocalDataMigrationValidationReport).mockResolvedValue(undefined);
  vi.mocked(promoteLocalDataLiveSourceDomains).mockResolvedValue({
    requestedDomains: ['chat', 'collection', 'persona', 'runtime', 'space'],
    domains: ['chat', 'collection', 'persona', 'runtime', 'space'],
    skippedDomains: [],
    readiness: readinessReport,
    activeDataSource: {
      schemaVersion: 1,
      key: 'local-data-v1:active-data-source',
      activeDataSource: 'repository',
      activeCommitId: 'space-commit',
      stagingCommitId: null,
      updatedAt: 200,
      domains: {}
    }
  });
});

describe('commitLocalDataStagingMigrationsFromCurrentPersistence', () => {
  it('stages all domains in one ordered pass and reads final readiness with chat validation evidence', async () => {
    const calls: string[] = [];
    setupSuccessMocks(calls);

    const result = await commitLocalDataStagingMigrationsFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      validatedAt: 101
    });

    expect(calls).toEqual([
      'chat',
      'collection',
      'persona',
      'runtime',
      'space',
      'document',
      'asset',
      'readiness'
    ]);
    expect(commitRuntimeRowsMigrationFromCurrentPersistence).toHaveBeenCalledWith({
      version: 7,
      committedAt: 100
    });
    expect(readLocalDataPromotionReadinessEvidence).toHaveBeenCalledWith({
      validationReports: {
        chat: chatValidationReport
      }
    });
    expect(writeLocalDataMigrationValidationReport).toHaveBeenCalledWith(chatValidationReport);
    expect(result.readiness).toBe(readinessReport);
    expect(result.validationReports).toBe(validationReports);
    expect(result.validationFailures).toEqual({});
  });

  it('keeps chat promotion evidence when missing chat records are quarantined', async () => {
    const calls: string[] = [];
    setupSuccessMocks(calls);
    const quarantinedChatValidationReport: LocalDataMigrationValidationReport = {
      ...chatValidationReport,
      legacyBaselineCount: 2,
      legacyBaselineObjectIds: ['c-live', 'c-missing'],
      activeBaselineObjectIds: ['c-live'],
      activeObjectCount: 1,
      activeObjectIds: ['c-live'],
      quarantinedObjectCount: 1,
      quarantinedObjectIds: ['c-missing'],
      recoveredMetadata: {
        activeConversationId: 'c-live'
      }
    };
    vi.mocked(commitChatMigrationStagingFromCurrentPersistence).mockImplementation(async () => {
      calls.push('chat');
      return {
        report: {
          ok: false,
          mismatches: {
            missingConversationCount: 1
          },
          projection: {
            promotionReady: true,
            quarantinedObjectCount: 1
          }
        },
        promotionEvidence: {
          commitMeta: {
            domain: 'chat',
            version: 7,
            committedAt: 100,
            commitId: 'chat-commit'
          },
          validationReport: quarantinedChatValidationReport
        }
      } as Awaited<ReturnType<typeof commitChatMigrationStagingFromCurrentPersistence>>;
    });

    await commitLocalDataStagingMigrationsFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      validatedAt: 101
    });

    expect(readLocalDataPromotionReadinessEvidence).toHaveBeenCalledWith({
      validationReports: {
        chat: quarantinedChatValidationReport
      }
    });
    expect(writeLocalDataMigrationValidationReport).toHaveBeenCalledWith(quarantinedChatValidationReport);
  });

  it('fails fast when a domain staging bridge throws', async () => {
    const calls: string[] = [];
    setupSuccessMocks(calls);
    vi.mocked(commitRuntimeRowsMigrationFromCurrentPersistence).mockImplementation(async () => {
      calls.push('runtime');
      throw new Error('runtime staging failed');
    });

    await expect(commitLocalDataStagingMigrationsFromCurrentPersistence({
      version: 7,
      committedAt: 100
    })).rejects.toThrow('runtime staging failed');

    expect(calls).toEqual(['chat', 'collection', 'persona', 'runtime']);
    expect(commitSpaceRowsMigrationFromCurrentPersistence).not.toHaveBeenCalled();
    expect(readLocalDataPromotionReadinessEvidence).not.toHaveBeenCalled();
  });

  it('can stage and then promote live source domains with chat validation evidence', async () => {
    const calls: string[] = [];
    setupSuccessMocks(calls);

    const result = await commitAndPromoteLocalDataLiveSourceDomainsFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      validatedAt: 101
    });

    expect(promoteLocalDataLiveSourceDomains).toHaveBeenCalledWith({
      validationReports
    });
    expect(result.staging.readiness).toBe(readinessReport);
    expect(result.promotion.activeDataSource.activeDataSource).toBe('repository');
  });
});

describe('commitLocalDataLiveSourceStagingMigrationsFromCurrentPersistence', () => {
  it('stages chat plus requested live-source domains without running document or asset staging', async () => {
    const calls: string[] = [];
    setupSuccessMocks(calls);

    const result = await commitLocalDataLiveSourceStagingMigrationsFromCurrentPersistence({
      domains: ['runtime', 'collection'],
      version: 7,
      committedAt: 100
    });

    expect(calls).toEqual(['chat', 'collection', 'runtime', 'readiness']);
    expect(commitChatMigrationStagingFromCurrentPersistence).toHaveBeenCalledWith({
      version: 7,
      committedAt: 100,
      validatedAt: 100
    });
    expect(commitDocumentRowsMigrationFromCurrentPersistence).not.toHaveBeenCalled();
    expect(commitAssetRowsMigrationFromCurrentPersistence).not.toHaveBeenCalled();
    expect(readLocalDataPromotionReadinessEvidence).toHaveBeenCalledWith({
      domains: ['chat', 'collection', 'runtime'],
      validationReports: {
        chat: chatValidationReport
      }
    });
    expect(writeLocalDataMigrationValidationReport).toHaveBeenCalledWith(chatValidationReport);
    expect(result.chat).toBeDefined();
    expect(result.collection).toEqual(mockResult('collection'));
    expect(result.runtime).toEqual(mockResult('runtime'));
    expect(result.persona).toBeUndefined();
    expect(result.space).toBeUndefined();
  });

  it('stages document rows when document is requested as a live-source domain', async () => {
    const calls: string[] = [];
    setupSuccessMocks(calls);

    const result = await commitLocalDataLiveSourceStagingMigrationsFromCurrentPersistence({
      domains: ['runtime', 'document'],
      version: 7,
      committedAt: 100
    });

    expect(calls).toEqual(['chat', 'runtime', 'document', 'readiness']);
    expect(commitDocumentRowsMigrationFromCurrentPersistence).toHaveBeenCalledWith({
      version: 7,
      committedAt: 100
    });
    expect(readLocalDataPromotionReadinessEvidence).toHaveBeenCalledWith({
      domains: ['chat', 'runtime', 'document'],
      validationReports: {
        chat: chatValidationReport
      }
    });
    expect(result.document).toEqual(mockResult('document'));
    expect(result.runtime).toEqual(mockResult('runtime'));
    expect(commitAssetRowsMigrationFromCurrentPersistence).not.toHaveBeenCalled();
  });
});
