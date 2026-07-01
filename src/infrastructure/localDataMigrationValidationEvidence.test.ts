import { describe, expect, it } from 'vitest';
import type {
  LocalDataDomain,
  LocalDataMigrationValidationReport
} from '../engines/localData/types';
import {
  getLocalDataMigrationValidationReportKey,
  readPersistedLocalDataMigrationValidationReportsFromEntries
} from './localDataMigrationValidationEvidence';

function validationReport(domain: LocalDataDomain): LocalDataMigrationValidationReport {
  return {
    id: `${domain}:commit:validation`,
    domain,
    commitId: `${domain}-commit`,
    version: 1,
    validatedAt: 100,
    stagingHydrated: true,
    legacyBaselineCount: 1,
    legacyBaselineObjectIds: [`${domain}-object`],
    activeBaselineObjectIds: [`${domain}-object`],
    activeObjectCount: 1,
    activeObjectIds: [`${domain}-object`],
    quarantinedObjectCount: 0,
    quarantinedObjectIds: [],
    duplicateObjectIdCount: 0,
    missingActiveCollaboratorIdCount: 0,
    missingActiveCollaboratorIds: [],
    activeIncompleteRowCount: 0,
    activeTimedOutRowCount: 0,
    recoveredMetadata: domain === 'chat' ? { activeConversationId: `${domain}-object` } : {}
  };
}

describe('readPersistedLocalDataMigrationValidationReportsFromEntries', () => {
  it('reads only shape-valid migration validation evidence for the requested domain', () => {
    const chatReport = validationReport('chat');

    expect(readPersistedLocalDataMigrationValidationReportsFromEntries([
      { key: getLocalDataMigrationValidationReportKey('chat'), value: chatReport },
      { key: getLocalDataMigrationValidationReportKey('persona'), value: { ...validationReport('chat') } },
      { key: getLocalDataMigrationValidationReportKey('runtime'), value: { domain: 'runtime' } }
    ])).toEqual({
      chat: chatReport
    });
  });
});
