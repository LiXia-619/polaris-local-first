import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import JSZip from 'jszip';
import {
  buildLocalDataExportStagingReadbackReportFromZipReader,
  formatLocalDataExportStagingReadbackReport,
  type LocalDataExportStagingReadbackReport,
  type LocalDataExportZipReader
} from '../src/engines/localData';

const execFileAsync = promisify(execFile);

function printUsage() {
  console.error('Usage: npm run local-data:export-staging-readback -- <polaris-export.zip> [--json]');
}

async function createZipReader(zipPath: string): Promise<LocalDataExportZipReader> {
  const buffer = await readFile(zipPath);
  try {
    return await JSZip.loadAsync(buffer);
  } catch {
    return {
      file(path: string) {
        return {
          async: async (type: 'string') => {
            if (type !== 'string') throw new Error(`Unsupported zip read type: ${type}`);
            const { stdout } = await execFileAsync('bsdtar', ['-xOf', zipPath, path], {
              encoding: 'utf8',
              maxBuffer: 1024 * 1024 * 1024
            });
            return stdout;
          }
        };
      }
    };
  }
}

function redactDomain(domain: LocalDataExportStagingReadbackReport['collection']) {
  return {
    commitMeta: domain.commitMeta,
    expectedRepositoryRowCount: domain.expectedRepositoryRowCount,
    actualRepositoryRowCount: domain.actualRepositoryRowCount,
    ok: domain.ok,
    blockerCount: domain.blockers.length,
    warningCount: domain.warnings.length
  };
}

function redactReport(report: LocalDataExportStagingReadbackReport) {
  return {
    ok: report.ok,
    source: report.source,
    repository: report.repository,
    chat: {
      ...redactDomain(report.chat),
      contentPromotionReady: report.chat.contentPromotionReady,
      stagingHydrated: report.chat.stagingHydrated,
      conversationCount: report.chat.conversationCount,
      quarantinedObjectCount: report.chat.quarantinedObjectCount,
      duplicateObjectIdCount: report.chat.duplicateObjectIdCount,
      missingActiveCollaboratorIdCount: report.chat.missingActiveCollaboratorIdCount
    },
    collection: redactDomain(report.collection),
    persona: redactDomain(report.persona),
    runtime: redactDomain(report.runtime),
    space: redactDomain(report.space),
    document: {
      ...redactDomain(report.document),
      missingBodyCount: report.document.missingBodyCount,
      incompleteChunkCount: report.document.incompleteChunkCount,
      orphanBodyCount: report.document.orphanBodyCount
    },
    asset: {
      ...redactDomain(report.asset),
      activeObjectCount: report.asset.activeObjectCount,
      orphanObjectCount: report.asset.orphanObjectCount,
      missingMetaCount: report.asset.missingMetaCount,
      missingBinaryCount: report.asset.missingBinaryCount,
      previewOnlyCount: report.asset.previewOnlyCount
    },
    readiness: {
      canHydrate: report.readiness.canHydrate,
      canPromote: report.readiness.canPromote,
      activeDataSource: report.readiness.activeDataSource,
      blockerCount: report.readiness.blockers.length,
      warningCount: report.readiness.warnings.length,
      validationFailureCount: Object.keys(report.validationFailures).length,
      domains: report.readiness.domains.map((domain) => ({
        domain: domain.domain,
        status: domain.status,
        stageReady: domain.stageReady,
        promotionReady: domain.promotionReady,
        rowCount: domain.rowCount,
        completeRowCount: domain.completeRowCount,
        nonCompleteRowCount: domain.nonCompleteRowCount,
        hydrationStatus: domain.hydrationStatus,
        hydrationObjectCount: domain.hydrationObjectCount,
        blockerCount: domain.blockers.length,
        warningCount: domain.warnings.length,
        reasonCount: domain.reasons.length
      }))
    }
  };
}

const args = process.argv.slice(2);
const zipPath = args.find((arg) => !arg.startsWith('--'));
const emitJson = args.includes('--json');

if (!zipPath) {
  printUsage();
  process.exit(2);
}

try {
  const report = await buildLocalDataExportStagingReadbackReportFromZipReader({
    zip: await createZipReader(resolve(zipPath))
  });
  console.log(emitJson ? JSON.stringify(redactReport(report), null, 2) : formatLocalDataExportStagingReadbackReport(report));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
