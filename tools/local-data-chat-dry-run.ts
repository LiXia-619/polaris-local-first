import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildChatMigrationDryRunReportFromExportZipBuffer,
  formatChatMigrationDryRunReport
} from '../src/engines/localData/chatMigrationDryRunExport';

function printUsage() {
  console.error('Usage: npm run local-data:chat-dry-run -- <polaris-export.zip> [--json]');
}

const args = process.argv.slice(2);
const zipPath = args.find((arg) => !arg.startsWith('--'));
const emitJson = args.includes('--json');

if (!zipPath) {
  printUsage();
  process.exit(2);
}

try {
  const report = await buildChatMigrationDryRunReportFromExportZipBuffer(
    await readFile(resolve(zipPath))
  );
  console.log(emitJson ? JSON.stringify(report, null, 2) : formatChatMigrationDryRunReport(report));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
