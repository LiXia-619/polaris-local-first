import { deleteAsset } from '../../infrastructure/assetStore';
import { useChatStore } from '../../stores/chatStore';

type MenuStorageMaintenanceUi = {
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
};

type StorageMaintenanceRefresh = (options?: { includeRuntimeLog?: boolean }) => Promise<void>;

type SetBusyState = (value: boolean) => void;

type MenuStorageMaintenanceActionsArgs = {
  ui: MenuStorageMaintenanceUi;
  refreshStorageHealth: StorageMaintenanceRefresh;
  setClearingDiagnostics: SetBusyState;
  setClearingConversationAttachments: SetBusyState;
  setClearingOrphanAssets: SetBusyState;
  setClearingRedundantPreviews: SetBusyState;
};

function formatBytesForAlert(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('zh-CN', { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} MB`;
}

async function buildAssetGovernanceReferences() {
  const { buildStableAssetGovernanceReferences } = await import('../data-work/assetGovernanceReferences');
  return await buildStableAssetGovernanceReferences();
}

export function createMenuStorageMaintenanceActions({
  ui,
  refreshStorageHealth,
  setClearingDiagnostics,
  setClearingConversationAttachments,
  setClearingOrphanAssets,
  setClearingRedundantPreviews
}: MenuStorageMaintenanceActionsArgs) {
  const clearDiagnostics = async () => {
    if (!ui.confirm('只会清理本机诊断日志，不会删除对话、房间、工作区、附件或备份。继续吗？')) return;
    try {
      setClearingDiagnostics(true);
      const [
        { clearRequestDebugEntries },
        { clearStreamDebugEntries },
        { clearChatQaAuditEntries },
        { clearModelFlowTraceEntries },
        { clearEnvironmentContractQaReports },
        { clearRuntimePerformanceEntries },
        { clearAssetGovernanceDebugEntries },
        { clearLatestPersistenceError },
        { clearClientErrorLog },
        { clearAppRuntimeLogEntries }
      ] = await Promise.all([
        import('../../engines/request/requestDebugRuntime'),
        import('../../engines/chat-api/chatApiStreamDebug'),
        import('../chat/chatQaAuditRuntime'),
        import('../chat/modelFlowTraceRuntime'),
        import('../chat/chatEnvironmentContractQa'),
        import('../developer/runtime-performance/runtimePerformanceLog'),
        import('../developer/assetGovernanceDebug'),
        import('../../infrastructure/persistenceDiagnostics'),
        import('../../infrastructure/clientErrorLog'),
        import('../../infrastructure/appRuntimeLog')
      ]);
      clearRequestDebugEntries();
      clearStreamDebugEntries();
      clearChatQaAuditEntries();
      clearModelFlowTraceEntries();
      clearEnvironmentContractQaReports();
      clearRuntimePerformanceEntries();
      clearAssetGovernanceDebugEntries();
      clearLatestPersistenceError();
      clearClientErrorLog();
      clearAppRuntimeLogEntries();
      await refreshStorageHealth({ includeRuntimeLog: true });
      ui.alert('已清理本机诊断日志。');
    } catch (error) {
      ui.alert(error instanceof Error ? error.message : '清理诊断日志失败');
    } finally {
      setClearingDiagnostics(false);
    }
  };

  const clearOrphanAssets = async () => {
    try {
      setClearingOrphanAssets(true);
      const [{ auditStoredAssets, sweepOrphanAssets }] = await Promise.all([
        import('../../engines/assetGovernance')
      ]);
      const references = await buildAssetGovernanceReferences();
      const audit = await auditStoredAssets(references);
      const cleanupCount = audit.orphanAssetCount + audit.orphanPreviewCacheCount;
      if (cleanupCount === 0) {
        ui.alert('现在没有可清理的未引用附件或孤儿预览缓存。');
        return;
      }

      if (!ui.confirm(
        [
          `清理 ${audit.orphanAssetCount} 个未引用附件和 ${audit.orphanPreviewCacheCount} 个孤儿预览缓存，预计释放 ${formatBytesForAlert(audit.orphanTotalBytes)}。`,
          '只会删除没有被对话记录、图片库、协作者头像、主题背景、字体、房间、工作区文件、参考资料或待发送栏引用的本机附件资产。',
          '预览缓存不是资产本体；只清理没有对应资产实体的孤儿预览。',
          '这个动作不会自动清理仍在对话记录里的图片或文件。继续吗？'
        ].join('\n')
      )) {
        return;
      }

      const result = await sweepOrphanAssets(await buildAssetGovernanceReferences(), {
        candidateAssetIds: audit.orphanAssetIds,
        candidatePreviewCacheIds: audit.orphanPreviewCacheIds
      });
      await refreshStorageHealth({ includeRuntimeLog: true });
      ui.alert(`已清理 ${result.deletedAssetIds.length} 个未引用附件和 ${result.deletedPreviewCacheIds.length} 个孤儿预览缓存。`);
    } catch (error) {
      ui.alert(error instanceof Error ? error.message : '清理未引用附件失败');
    } finally {
      setClearingOrphanAssets(false);
    }
  };

  const clearConversationAttachmentCopies = async () => {
    try {
      setClearingConversationAttachments(true);
      const [
        {
          auditStoredAssets,
          collectConversationOnlyAssetIds
        },
        { clearPersistedConversationAttachmentsByAssetIds }
      ] = await Promise.all([
        import('../../engines/assetGovernance'),
        import('../../stores/chatCurrentPersistence')
      ]);
      const references = await buildAssetGovernanceReferences();
      const conversationOnlyAssetIds = collectConversationOnlyAssetIds(references);
      const audit = await auditStoredAssets(references);
      const candidates = audit.entries.filter((entry) =>
        conversationOnlyAssetIds.has(entry.id)
        && entry.referenced
        && (entry.hasMeta || entry.hasBinary || entry.hasPreview)
      );

      if (candidates.length === 0) {
        ui.alert('现在没有可清理的对话临时附件。');
        return;
      }

      const totalBytes = candidates.reduce((sum, entry) => sum + entry.totalBytes, 0);
      if (!ui.confirm(
        [
          `清理 ${candidates.length} 个对话临时附件，预计释放 ${formatBytesForAlert(totalBytes)}。`,
          '已保存到图片库、头像、背景、字体、房间或待发送栏里的文件不会被清理。',
          '聊天记录会保留附件条目，但清理后不能再下载、读正文或当图片素材使用。继续吗？'
        ].join('\n')
      )) {
        return;
      }

      const clearResult = await clearPersistedConversationAttachmentsByAssetIds(candidates.map((entry) => entry.id));
      if (clearResult.clearedAssetIds.length === 0) {
        ui.alert('没有找到可清理的对话临时附件引用。');
        return;
      }

      useChatStore.getState().clearConversationAttachmentsByAssetIds(clearResult.clearedAssetIds, clearResult.clearedAt);
      await useChatStore.getState().persistToDb();
      await Promise.all(clearResult.clearedAssetIds.map((assetId) => deleteAsset(assetId)));
      await refreshStorageHealth({ includeRuntimeLog: true });
      ui.alert(`已清理 ${clearResult.clearedAttachmentCount} 个对话临时附件。`);
    } catch (error) {
      ui.alert(error instanceof Error ? error.message : '清理对话临时附件失败');
    } finally {
      setClearingConversationAttachments(false);
    }
  };

  const clearRedundantAssetPreviews = async () => {
    try {
      setClearingRedundantPreviews(true);
      const [{ auditRedundantAssetPreviews, sweepRedundantAssetPreviews }] = await Promise.all([
        import('../../engines/assetGovernance')
      ]);
      const audit = await auditRedundantAssetPreviews();
      if (audit.redundantPreviewAssetIds.length === 0) {
        ui.alert('现在没有可清理的重复图片预览。');
        return;
      }

      if (!ui.confirm(
        [
          `清理 ${audit.redundantPreviewAssetIds.length} 个重复图片预览，预计释放 ${formatBytesForAlert(audit.redundantPreviewBytes)}。`,
          '只会删除不比原图更小的预览副本；图片原文件会保留，列表需要时会回退读取原图。',
          '继续吗？'
        ].join('\n')
      )) {
        return;
      }

      const result = await sweepRedundantAssetPreviews();
      await refreshStorageHealth({ includeRuntimeLog: true });
      ui.alert(`已清理 ${result.deletedCount} 个重复图片预览。`);
    } catch (error) {
      ui.alert(error instanceof Error ? error.message : '清理重复图片预览失败');
    } finally {
      setClearingRedundantPreviews(false);
    }
  };

  return {
    clearDiagnostics,
    clearOrphanAssets,
    clearConversationAttachmentCopies,
    clearRedundantAssetPreviews
  };
}
