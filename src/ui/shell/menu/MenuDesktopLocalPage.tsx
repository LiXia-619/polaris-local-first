import { useEffect, useMemo, useState } from 'react';
import {
  buildDesktopWorkspaceBinding,
  buildDesktopWorkspaceManifestContent,
  buildDesktopWorkspaceStarterEntry,
  chooseDesktopWorkspaceEntryPath,
  DESKTOP_WORKSPACE_MANIFEST_PATH,
  inferDesktopWorkspaceFileLanguage,
  parseDesktopWorkspaceManifest
} from '../../../app/desktop/desktopWorkspaceBinding';
import {
  syncDesktopProjectFromDisk,
  syncDesktopProjectToDisk,
  type DesktopWorkspaceSyncConfirmationRequest
} from '../../../app/desktop/desktopWorkspaceSyncActions';
import {
  buildLocalizedDesktopSyncConfirmationMessage,
  describeLocalizedDesktopSyncResult
} from '../../../app/desktop/desktopWorkspaceSyncLocalization';
import { inferManualProjectFileRole } from '../../../app/collection/projectWorkspaceCreation';
import { normalizeCodeCardFilePath } from '../../../engines/roomProjects';
import { useCollectionStore } from '../../../stores/collectionStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import type { DesktopTrustedRoot } from '../../../desktop/localHost';
import {
  createUnavailableDesktopLocalState,
  getDesktopLocalHostBridge,
  type DesktopLocalCommandResult,
  type DesktopLocalDirectoryListing,
  type DesktopLocalHostState,
  type DesktopLocalPermissionMode
} from '../../../desktop/localHost';
import { Icon } from '../../Icon';
import { useI18n, type I18nTranslator } from '../../../i18n';

type MenuDesktopLocalPageProps = {
  onBack: () => void;
};

function splitCommandArgs(value: string) {
  return value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatPermissionMode(mode: DesktopLocalPermissionMode, t: I18nTranslator['t']) {
  return mode === 'trusted'
    ? t('settings.desktopLocal.permissionTrusted')
    : t('settings.desktopLocal.permissionConfirmEach');
}

function createDesktopBoundProjectId(existingIds: Set<string>) {
  let attempt = 0;
  while (true) {
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const id = attempt === 0 ? `desktop-project-${suffix}` : `desktop-project-${suffix}-${attempt}`;
    if (!existingIds.has(id)) return id;
    attempt += 1;
  }
}

function formatDesktopSyncTimestamp(value: number, language: I18nTranslator['language']) {
  return new Intl.DateTimeFormat(language, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatFileKind(kind: DesktopLocalDirectoryListing['entries'][number]['kind'], t: I18nTranslator['t']) {
  if (kind === 'directory') return t('settings.desktopLocal.fileKindDirectory');
  if (kind === 'file') return t('settings.desktopLocal.fileKindFile');
  return t('settings.desktopLocal.fileKindOther');
}

function confirmDesktopSyncPlan(request: DesktopWorkspaceSyncConfirmationRequest, t: I18nTranslator['t']) {
  const message = buildLocalizedDesktopSyncConfirmationMessage(request, t);
  return message ? window.confirm(message) : true;
}

export function MenuDesktopLocalPage({ onBack }: MenuDesktopLocalPageProps) {
  const { t, language } = useI18n();
  const bridge = getDesktopLocalHostBridge();
  const roomProjects = useCollectionStore((store) => store.roomProjects);
  const projectFiles = useCollectionStore((store) => store.projectFiles);
  const createProject = useCollectionStore((store) => store.createProject);
  const createProjectFile = useCollectionStore((store) => store.createProjectFile);
  const updateProject = useCollectionStore((store) => store.updateProject);
  const updateProjectFile = useCollectionStore((store) => store.updateProjectFile);
  const frontstageCollaboratorId = useSpaceStore((store) => store.frontstageCollaboratorId);
  const collectionProjectId = useSpaceStore((store) => store.collectionProjectId);
  const setWorld = useSpaceStore((store) => store.setWorld);
  const setCollectionShelf = useSpaceStore((store) => store.setCollectionShelf);
  const setCollectionProjectId = useSpaceStore((store) => store.setCollectionProjectId);
  const [state, setState] = useState<DesktopLocalHostState>(() => createUnavailableDesktopLocalState());
  const [listing, setListing] = useState<DesktopLocalDirectoryListing | null>(null);
  const [command, setCommand] = useState('pwd');
  const [commandArgs, setCommandArgs] = useState('');
  const [commandResult, setCommandResult] = useState<DesktopLocalCommandResult | null>(null);
  const [bindingStatus, setBindingStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boundProjectByRootId = useMemo(
    () => new Map(
      roomProjects
        .filter((project) => project.desktopBinding?.rootId)
        .map((project) => [project.desktopBinding!.rootId, project] as const)
    ),
    [roomProjects]
  );
  const currentDesktopProject = useMemo(
    () => roomProjects.find((project) => project.id === collectionProjectId && project.desktopBinding) ?? null,
    [collectionProjectId, roomProjects]
  );
  const currentDesktopRoot = useMemo(
    () => currentDesktopProject?.desktopBinding
      ? state.trustedRoots.find((root) => root.id === currentDesktopProject.desktopBinding!.rootId) ?? null
      : null,
    [currentDesktopProject, state.trustedRoots]
  );
  const selectedRoot = useMemo(
    () => currentDesktopRoot ?? state.trustedRoots[0] ?? null,
    [currentDesktopRoot, state.trustedRoots]
  );

  const refreshState = async () => {
    if (!bridge) {
      setState(createUnavailableDesktopLocalState());
      return;
    }
    setState(await bridge.getState());
  };

  const runAction = async (action: () => Promise<void>) => {
    try {
      setBusy(true);
      setError(null);
      setBindingStatus(null);
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('settings.desktopLocal.operationFailed'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshState();
  }, []);

  useEffect(() => {
    if (!bridge || !selectedRoot) {
      setListing(null);
      return;
    }
    void runAction(async () => {
      setListing(await bridge.listDirectory({ rootId: selectedRoot.id }));
    });
  }, [selectedRoot?.id]);

  const setPermissionMode = (mode: DesktopLocalPermissionMode) => runAction(async () => {
    if (!bridge) return;
    setState(await bridge.setPermissionMode(mode));
  });

  const chooseRoot = () => runAction(async () => {
    if (!bridge) return;
    const nextState = await bridge.chooseRoot();
    setState(nextState);
  });

  const removeRoot = (rootId: string) => runAction(async () => {
    if (!bridge) return;
    const nextState = await bridge.removeRoot(rootId);
    setState(nextState);
    if (selectedRoot?.id === rootId) {
      setListing(null);
      setCommandResult(null);
    }
  });

  const refreshListing = () => runAction(async () => {
    if (!bridge || !selectedRoot) return;
    setListing(await bridge.listDirectory({ rootId: selectedRoot.id }));
  });

  const runCommand = () => runAction(async () => {
    if (!bridge || !selectedRoot) return;
    setCommandResult(await bridge.runCommand({
      rootId: selectedRoot.id,
      command,
      args: splitCommandArgs(commandArgs)
    }));
  });

  const revealProject = (projectId: string) => {
    setWorld('collection');
    setCollectionShelf('project');
    setCollectionProjectId(projectId);
  };

  const bindRootAsWorkspaceInternal = async (root: DesktopTrustedRoot, reveal = true) => {
    if (!bridge) return;

    const existingProject = boundProjectByRootId.get(root.id);
    if (existingProject) {
      if (reveal) {
        revealProject(existingProject.id);
        setBindingStatus(t('settings.desktopLocal.bindingOpened', { title: existingProject.title }));
      }
      return existingProject.id;
    }

    const rootListing = await bridge.listDirectory({ rootId: root.id });
    setListing(rootListing);

    let manifest = null;
    const hasPolarisDir = rootListing.entries.some((entry) => entry.kind === 'directory' && entry.name === '.polaris');
    if (hasPolarisDir) {
      const manifestListing = await bridge.listDirectory({ rootId: root.id, relativePath: '.polaris' });
      const hasManifest = manifestListing.entries.some((entry) => entry.kind === 'file' && entry.name === 'workspace.json');
      if (hasManifest) {
        const manifestFile = await bridge.readFile({ rootId: root.id, relativePath: DESKTOP_WORKSPACE_MANIFEST_PATH });
        manifest = parseDesktopWorkspaceManifest(manifestFile.content);
      }
    }

    const entryFilePath = chooseDesktopWorkspaceEntryPath({
      entries: rootListing.entries,
      manifest
    });
    const normalizedEntryPath = normalizeCodeCardFilePath(entryFilePath) ?? 'index.html';
    const title = manifest?.title ?? root.label;
    const entryExistsInRoot = rootListing.entries.some((entry) =>
      entry.kind === 'file' && normalizeCodeCardFilePath(entry.name) === normalizedEntryPath
    );
    let entryContent = '';

    if (!entryExistsInRoot && normalizedEntryPath === 'index.html') {
      entryContent = buildDesktopWorkspaceStarterEntry(title);
      await bridge.writeFile({
        rootId: root.id,
        relativePath: normalizedEntryPath,
        content: entryContent
      });
    } else {
      const entryFile = await bridge.readFile({
        rootId: root.id,
        relativePath: normalizedEntryPath
      });
      entryContent = entryFile.content;
    }

    const projectId = manifest?.projectId ?? createDesktopBoundProjectId(new Set(roomProjects.map((project) => project.id)));
    const binding = buildDesktopWorkspaceBinding({
      root,
      entryFilePath: normalizedEntryPath
    });
    await bridge.writeFile({
      rootId: root.id,
      relativePath: DESKTOP_WORKSPACE_MANIFEST_PATH,
      content: buildDesktopWorkspaceManifestContent({
        projectId,
        title,
        entryFilePath: normalizedEntryPath,
        updatedAt: binding.syncedAt
      })
    });

    const resolvedProjectId = createProject({
      id: projectId,
      title,
      ownerCollaboratorId: frontstageCollaboratorId ?? undefined,
      desktopBinding: binding,
      source: 'manual'
    });
    if (!resolvedProjectId) {
      throw new Error(t('settings.desktopLocal.createWorkspaceFailed'));
    }

    const language = inferDesktopWorkspaceFileLanguage(normalizedEntryPath, entryContent);
    const existingFile = projectFiles.find((file) =>
      file.projectId === resolvedProjectId
      && normalizeCodeCardFilePath(file.filePath) === normalizedEntryPath
    );
    const entryFileId = existingFile?.id ?? createProjectFile({
      projectId: resolvedProjectId,
      filePath: normalizedEntryPath,
      fileRole: inferManualProjectFileRole(normalizedEntryPath, language),
      language,
      content: entryContent,
      ownerCollaboratorId: frontstageCollaboratorId ?? undefined,
      source: 'manual'
    });
    if (!entryFileId) {
      throw new Error(t('settings.desktopLocal.createEntryFileFailed'));
    }
    if (existingFile) {
      updateProjectFile(existingFile.id, {
        fileRole: inferManualProjectFileRole(normalizedEntryPath, language),
        language,
        content: entryContent
      });
    }
    updateProject(resolvedProjectId, {
      title,
      entryFileId,
      desktopBinding: binding
    });
    if (reveal) {
      revealProject(resolvedProjectId);
      setBindingStatus(t('settings.desktopLocal.bindingCreated', { root: root.label, entry: normalizedEntryPath }));
    }
    return resolvedProjectId;
  };

  const bindRootAsWorkspace = (root: DesktopTrustedRoot) => runAction(async () => {
    await bindRootAsWorkspaceInternal(root, true);
  });

  const syncRootFromDisk = (root: DesktopTrustedRoot) => runAction(async () => {
    if (!bridge) return;
    const projectId = await bindRootAsWorkspaceInternal(root, false);
    if (!projectId) return;
    const result = await syncDesktopProjectFromDisk({
      bridge,
      projectId,
      confirmPlan: (request) => confirmDesktopSyncPlan(request, t)
    });
    revealProject(projectId);
    setBindingStatus(describeLocalizedDesktopSyncResult(result, t));
  });

  const syncProjectToDisk = (root: DesktopTrustedRoot) => runAction(async () => {
    if (!bridge) return;
    const project = boundProjectByRootId.get(root.id);
    if (!project?.desktopBinding) {
      throw new Error(t('settings.desktopLocal.rootNotBound'));
    }
    const result = await syncDesktopProjectToDisk({
      bridge,
      projectId: project.id,
      confirmPlan: (request) => confirmDesktopSyncPlan(request, t)
    });
    revealProject(project.id);
    setBindingStatus(describeLocalizedDesktopSyncResult(result, t));
  });

  const syncCurrentProjectFromDisk = () => runAction(async () => {
    if (!bridge || !currentDesktopProject?.desktopBinding) return;
    const result = await syncDesktopProjectFromDisk({
      bridge,
      projectId: currentDesktopProject.id,
      confirmPlan: (request) => confirmDesktopSyncPlan(request, t)
    });
    revealProject(currentDesktopProject.id);
    setBindingStatus(describeLocalizedDesktopSyncResult(result, t));
  });

  const syncCurrentProjectToDisk = () => runAction(async () => {
    if (!bridge || !currentDesktopProject?.desktopBinding) return;
    const result = await syncDesktopProjectToDisk({
      bridge,
      projectId: currentDesktopProject.id,
      confirmPlan: (request) => confirmDesktopSyncPlan(request, t)
    });
    revealProject(currentDesktopProject.id);
    setBindingStatus(describeLocalizedDesktopSyncResult(result, t));
  });

  return (
    <div className="menu-sheet-page desktop-local-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={18} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.desktopLocal.kicker')}</small>
          <h2>{t('settings.desktopLocal.title')}</h2>
          <p>{state.available
            ? t('settings.desktopLocal.availableSummary', {
              count: state.trustedRoots.length,
              mode: formatPermissionMode(state.permissionMode, t)
            })
            : t('settings.desktopLocal.unavailableSummary')}</p>
        </div>
      </div>

      {!state.available ? (
        <section className="menu-section">
          <div className="settings-note desktop-local-empty">{t('settings.desktopLocal.unavailableNote')}</div>
        </section>
      ) : (
        <>
          <section className="menu-section">
            <div className="menu-section-head">
              <span className="menu-section-kicker">{t('settings.desktopLocal.permissionsSection')}</span>
              <p className="menu-section-note">{t('settings.desktopLocal.permissionsNote')}</p>
            </div>
            <div className="desktop-local-mode-row" role="group" aria-label={t('settings.desktopLocal.permissionModeAria')}>
              {(['confirm-each', 'trusted'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`desktop-local-mode ${state.permissionMode === mode ? 'active' : ''}`}
                  onClick={() => { void setPermissionMode(mode); }}
                  disabled={busy}
                >
                  {formatPermissionMode(mode, t)}
                </button>
              ))}
            </div>
          </section>

          {currentDesktopProject?.desktopBinding ? (
            <section className="menu-section desktop-local-current-project-section">
              <div className="menu-section-head">
                <span className="menu-section-kicker">{t('settings.desktopLocal.currentWorkspaceSection')}</span>
                <p className="menu-section-note">{t('settings.desktopLocal.currentWorkspaceNote')}</p>
              </div>
              <div className="desktop-local-current-project">
                <div className="desktop-local-current-project-main">
                  <span className="desktop-local-current-project-icon" aria-hidden="true">
                    <Icon name="navWorkspace" size={15} />
                  </span>
                  <div>
                    <strong>{currentDesktopProject.title}</strong>
                    <span>{currentDesktopRoot?.path ?? currentDesktopProject.desktopBinding.rootLabel}</span>
                    <span>
                      {t('settings.desktopLocal.entryLabel', { entry: currentDesktopProject.desktopBinding.entryFilePath })}
                      {' · '}
                      {t('settings.desktopLocal.lastSyncLabel', {
                        time: formatDesktopSyncTimestamp(currentDesktopProject.desktopBinding.syncedAt, language)
                      })}
                    </span>
                  </div>
                </div>
                <div className="desktop-local-root-actions">
                  <button type="button" className="btn-secondary compact" onClick={() => revealProject(currentDesktopProject.id)} disabled={busy}>
                    {t('settings.desktopLocal.open')}
                  </button>
                  <button type="button" className="btn-secondary compact" onClick={() => { void syncCurrentProjectFromDisk(); }} disabled={busy}>
                    {t('settings.desktopLocal.syncFromComputer')}
                  </button>
                  <button type="button" className="btn-secondary compact" onClick={() => { void syncCurrentProjectToDisk(); }} disabled={busy}>
                    {t('settings.desktopLocal.writeBackToComputer')}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="menu-section">
            <div className="menu-section-head">
              <span className="menu-section-kicker">{t('settings.desktopLocal.workspacesSection')}</span>
              <p className="menu-section-note">{t('settings.desktopLocal.workspacesNote')}</p>
            </div>
            <div className="desktop-local-roots">
              {state.trustedRoots.length === 0 ? (
                <div className="settings-note desktop-local-empty">{t('settings.desktopLocal.noWorkspaces')}</div>
              ) : state.trustedRoots.map((root) => (
                <div key={root.id} className="desktop-local-root">
                  <div>
                    <strong>{root.label}</strong>
                    <span>{root.path}</span>
                    {boundProjectByRootId.has(root.id) ? (() => {
                      const boundProject = boundProjectByRootId.get(root.id);
                      const syncCount = Object.keys(boundProject?.desktopBinding?.fileSync ?? {}).length;
                      return (
                        <>
                          <span>{t('settings.desktopLocal.boundProjectLabel', { title: boundProject?.title ?? '' })}</span>
                          <span>
                            {t('settings.desktopLocal.lastSyncLabel', {
                              time: boundProject?.desktopBinding?.syncedAt
                                ? formatDesktopSyncTimestamp(boundProject.desktopBinding.syncedAt, language)
                                : t('settings.desktopLocal.notSyncedYet')
                            })}
                            {syncCount > 0 ? t('settings.desktopLocal.syncFingerprintCount', { count: syncCount }) : ''}
                          </span>
                        </>
                      );
                    })() : null}
                  </div>
                  <div className="desktop-local-root-actions">
                    <button type="button" className="btn-secondary compact" onClick={() => { void bindRootAsWorkspace(root); }} disabled={busy}>
                      {boundProjectByRootId.has(root.id) ? t('settings.desktopLocal.open') : t('settings.desktopLocal.bind')}
                    </button>
                    <button type="button" className="btn-secondary compact" onClick={() => { void syncRootFromDisk(root); }} disabled={busy}>
                      {t('settings.desktopLocal.syncFromComputer')}
                    </button>
                    {boundProjectByRootId.has(root.id) ? (
                      <button type="button" className="btn-secondary compact" onClick={() => { void syncProjectToDisk(root); }} disabled={busy}>
                        {t('settings.desktopLocal.writeBackToComputer')}
                      </button>
                    ) : null}
                    <button type="button" className="btn-secondary compact" onClick={() => { void removeRoot(root.id); }} disabled={busy}>
                      {t('settings.desktopLocal.remove')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {bindingStatus ? <div className="settings-note desktop-local-bind-status">{bindingStatus}</div> : null}
            <div className="menu-inline-actions-stack">
              <button type="button" className="btn-secondary" onClick={() => { void chooseRoot(); }} disabled={busy}>
                {t('settings.desktopLocal.chooseFolder')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => { void refreshListing(); }} disabled={busy || !selectedRoot}>
                {t('settings.desktopLocal.refresh')}
              </button>
            </div>
          </section>

          {selectedRoot ? (
            <section className="menu-section">
              <div className="menu-section-head">
                <span className="menu-section-kicker">{t('settings.desktopLocal.filesSection')}</span>
                <p className="menu-section-note">{selectedRoot.label}</p>
              </div>
              <div className="desktop-local-file-list">
                {listing?.entries.slice(0, 24).map((entry) => (
                  <span key={`${entry.kind}:${entry.name}`} className="desktop-local-file">
                    <span>{formatFileKind(entry.kind, t)}</span>
                    <strong>{entry.name}</strong>
                  </span>
                )) ?? null}
                {listing && listing.entries.length === 0 ? (
                  <div className="settings-note desktop-local-empty">{t('settings.desktopLocal.emptyFolder')}</div>
                ) : null}
              </div>
            </section>
          ) : null}

          {selectedRoot ? (
            <section className="menu-section">
              <div className="menu-section-head">
                <span className="menu-section-kicker">{t('settings.desktopLocal.commandSection')}</span>
                <p className="menu-section-note">{t('settings.desktopLocal.commandNote')}</p>
              </div>
              <div className="settings-form desktop-local-command-form">
                <label>{t('settings.desktopLocal.commandLabel')}</label>
                <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="npm" />
                <label>{t('settings.desktopLocal.argsLabel')}</label>
                <input value={commandArgs} onChange={(event) => setCommandArgs(event.target.value)} placeholder="run build" />
              </div>
              <div className="menu-inline-actions-stack">
                <button type="button" className="btn-secondary" onClick={() => { void runCommand(); }} disabled={busy || !command.trim()}>
                  {t('settings.desktopLocal.run')}
                </button>
              </div>
              {commandResult ? (
                <pre className="desktop-local-command-output">{[
                  `$ ${commandResult.command} ${commandResult.args.join(' ')}`.trim(),
                  `exit ${commandResult.exitCode ?? commandResult.signal ?? 0} · ${commandResult.durationMs}ms`,
                  commandResult.stdout,
                  commandResult.stderr
                ].filter(Boolean).join('\n')}</pre>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      {error ? <div className="settings-note desktop-local-error">{error}</div> : null}
    </div>
  );
}
