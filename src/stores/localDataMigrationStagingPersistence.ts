import {
  readLocalDataPromotionReadinessEvidence
} from '../infrastructure/localDataPromotionReadiness';
import { writeLocalDataMigrationValidationReport } from '../infrastructure/localDataMigrationValidationEvidence';
import type { LocalDataPromotionReadinessReport } from '../engines/localData/promotionReadiness';
import type {
  LocalDataDomain,
  LocalDataMigrationValidationReport
} from '../engines/localData/types';
import {
  promoteLocalDataLiveSourceDomains,
  type LocalDataLiveSourcePromotionResult
} from './localDataSourcePromotionPersistence';
import {
  commitAssetRowsMigrationFromCurrentPersistence,
  type AssetRowsMigrationResult
} from './assetMigrationPersistence';
import {
  commitChatMigrationStagingFromCurrentPersistence,
  type CurrentChatMigrationStagingResult
} from './chatMigrationDryRunPersistence';
import {
  commitCollectionRowsMigrationFromCurrentPersistence,
  type CollectionRowsMigrationResult
} from './collectionMigrationPersistence';
import {
  commitDocumentRowsMigrationFromCurrentPersistence,
  type DocumentRowsMigrationResult
} from './documentMigrationPersistence';
import {
  commitPersonaRowsMigrationFromCurrentPersistence,
  type PersonaRowsMigrationResult
} from './personaMigrationPersistence';
import {
  commitRuntimeRowsMigrationFromCurrentPersistence,
  type RuntimeRowsMigrationResult
} from './runtimeMigrationPersistence';
import {
  commitSpaceRowsMigrationFromCurrentPersistence,
  type SpaceRowsMigrationResult
} from './spaceMigrationPersistence';

export type LocalDataMigrationStagingResult = {
  chat: CurrentChatMigrationStagingResult;
  collection: CollectionRowsMigrationResult;
  persona: PersonaRowsMigrationResult;
  runtime: RuntimeRowsMigrationResult;
  space: SpaceRowsMigrationResult;
  document: DocumentRowsMigrationResult;
  asset: AssetRowsMigrationResult;
  readiness: LocalDataPromotionReadinessReport;
  validationReports: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>>;
  validationFailures: Partial<Record<Exclude<LocalDataDomain, 'chat'>, string>>;
};

export type LocalDataLiveSourceStagingResult = {
  chat?: CurrentChatMigrationStagingResult;
  collection?: CollectionRowsMigrationResult;
  document?: DocumentRowsMigrationResult;
  persona?: PersonaRowsMigrationResult;
  runtime?: RuntimeRowsMigrationResult;
  space?: SpaceRowsMigrationResult;
  asset?: AssetRowsMigrationResult;
  readiness: LocalDataPromotionReadinessReport;
  validationReports: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>>;
  validationFailures: Partial<Record<Exclude<LocalDataDomain, 'chat'>, string>>;
};

export type LocalDataMigrationStagingAndPromotionResult = {
  staging: LocalDataMigrationStagingResult;
  promotion: LocalDataLiveSourcePromotionResult;
};

type LiveSourceStagingDomain = Extract<LocalDataDomain, 'collection' | 'document' | 'persona' | 'runtime' | 'space' | 'asset'>;
type StartupStagingDomain = Extract<LocalDataDomain, 'chat' | LiveSourceStagingDomain>;

export async function commitLocalDataStagingMigrationsFromCurrentPersistence(args: {
  version?: number;
  committedAt?: number;
  validatedAt?: number;
} = {}): Promise<LocalDataMigrationStagingResult> {
  const committedAt = args.committedAt ?? Date.now();
  const validatedAt = args.validatedAt ?? committedAt;
  const sharedArgs = {
    version: args.version,
    committedAt
  };

  const chat = await commitChatMigrationStagingFromCurrentPersistence({
    ...sharedArgs,
    validatedAt
  });
  const collection = await commitCollectionRowsMigrationFromCurrentPersistence(sharedArgs);
  const persona = await commitPersonaRowsMigrationFromCurrentPersistence(sharedArgs);
  const runtime = await commitRuntimeRowsMigrationFromCurrentPersistence(sharedArgs);
  const space = await commitSpaceRowsMigrationFromCurrentPersistence(sharedArgs);
  const document = await commitDocumentRowsMigrationFromCurrentPersistence(sharedArgs);
  const asset = await commitAssetRowsMigrationFromCurrentPersistence(sharedArgs);
  const validationReports: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>> = {};
  if (chat.promotionEvidence) {
    validationReports.chat = chat.promotionEvidence.validationReport;
    await writeLocalDataMigrationValidationReport(chat.promotionEvidence.validationReport);
  }
  const evidence = await readLocalDataPromotionReadinessEvidence({
    validationReports
  });

  return {
    chat,
    collection,
    persona,
    runtime,
    space,
    document,
    asset,
    readiness: evidence.readiness,
    validationReports: evidence.validationReports,
    validationFailures: evidence.validationFailures
  };
}

export async function commitLocalDataLiveSourceStagingMigrationsFromCurrentPersistence(args: {
  domains: LocalDataDomain[];
  includeChat?: boolean;
  version?: number;
  committedAt?: number;
  validatedAt?: number;
}): Promise<LocalDataLiveSourceStagingResult> {
  const committedAt = args.committedAt ?? Date.now();
  const validatedAt = args.validatedAt ?? committedAt;
  const selectedDomains = orderedUniqueLiveSourceDomains(args.domains);
  const readinessDomains = orderedUniqueStartupStagingDomains([
    ...(args.includeChat === false ? [] : ['chat'] satisfies LocalDataDomain[]),
    ...selectedDomains
  ]);
  const sharedArgs = {
    version: args.version,
    committedAt
  };
  const result: LocalDataLiveSourceStagingResult = {
    readiness: {
      canHydrate: true,
      canPromote: true,
      activeDataSource: 'unknown',
      domains: [],
      blockers: [],
      warnings: []
    },
    validationReports: {},
    validationFailures: {}
  };

  if (readinessDomains.includes('chat')) {
    result.chat = await commitChatMigrationStagingFromCurrentPersistence({
      ...sharedArgs,
      validatedAt
    });
    if (result.chat.promotionEvidence) {
      result.validationReports.chat = result.chat.promotionEvidence.validationReport;
      await writeLocalDataMigrationValidationReport(result.chat.promotionEvidence.validationReport);
    }
  }

  for (const domain of selectedDomains) {
    if (domain === 'collection') result.collection = await commitCollectionRowsMigrationFromCurrentPersistence(sharedArgs);
    if (domain === 'document') result.document = await commitDocumentRowsMigrationFromCurrentPersistence(sharedArgs);
    if (domain === 'persona') result.persona = await commitPersonaRowsMigrationFromCurrentPersistence(sharedArgs);
    if (domain === 'runtime') result.runtime = await commitRuntimeRowsMigrationFromCurrentPersistence(sharedArgs);
    if (domain === 'space') result.space = await commitSpaceRowsMigrationFromCurrentPersistence(sharedArgs);
    // Asset is staged LAST: its rows carry owner refs derived from scanning the other domains'
    // current data, so the asset migration runs after them.
    if (domain === 'asset') result.asset = await commitAssetRowsMigrationFromCurrentPersistence(sharedArgs);
  }

  const evidence = await readLocalDataPromotionReadinessEvidence({
    domains: readinessDomains,
    validationReports: result.validationReports
  });
  return {
    ...result,
    readiness: evidence.readiness,
    validationReports: evidence.validationReports,
    validationFailures: evidence.validationFailures
  };
}

export async function commitAndPromoteLocalDataLiveSourceDomainsFromCurrentPersistence(args: {
  version?: number;
  committedAt?: number;
  validatedAt?: number;
} = {}): Promise<LocalDataMigrationStagingAndPromotionResult> {
  const staging = await commitLocalDataStagingMigrationsFromCurrentPersistence(args);
  const promotion = await promoteLocalDataLiveSourceDomains({
    validationReports: staging.validationReports
  });
  return {
    staging,
    promotion
  };
}

function orderedUniqueLiveSourceDomains(domains: LocalDataDomain[]) {
  const requested = new Set(domains);
  return (['collection', 'persona', 'runtime', 'space', 'document', 'asset'] satisfies LiveSourceStagingDomain[])
    .filter((domain) => requested.has(domain));
}

function orderedUniqueStartupStagingDomains(domains: LocalDataDomain[]) {
  const requested = new Set(domains);
  return (['chat', 'collection', 'persona', 'runtime', 'space', 'document', 'asset'] satisfies StartupStagingDomain[])
    .filter((domain) => requested.has(domain));
}
