import type { LocalDataCensusDomainReport } from './localDataCensusReportTypes';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function collectOwnerScopedObjects(args: {
  items: unknown[];
  kind: string;
  report: LocalDataCensusDomainReport;
  knownOwnerIds: Set<string>;
  resolveRecoveredOwnerCollaboratorId?: (item: Record<string, unknown>) => string | null;
  onItem: (item: Record<string, unknown>, objectId: string) => void;
}) {
  args.items.forEach((item) => {
    if (!isPlainRecord(item)) return;
    const id = readString(item.id);
    if (!id) return;
    const objectId = `${args.kind}:${id}`;
    args.report.baselineObjectIds.push(objectId);
    args.report.activeObjectIds.push(objectId);
    const ownerCollaboratorId = readString(item.ownerCollaboratorId);
    if (!ownerCollaboratorId) {
      args.report.missingOwnerObjectIds.push(objectId);
      const recoveredOwnerCollaboratorId = args.resolveRecoveredOwnerCollaboratorId?.(item) ?? null;
      if (recoveredOwnerCollaboratorId && args.knownOwnerIds.has(recoveredOwnerCollaboratorId)) {
        args.report.recoverableOwnerObjectIds.push(objectId);
      } else {
        args.report.unresolvedOwnerObjectIds.push(objectId);
      }
    }
    if (ownerCollaboratorId && !args.knownOwnerIds.has(ownerCollaboratorId)) {
      args.report.danglingOwnerObjectIds.push(objectId);
    }
    args.onItem(item, id);
  });
}
