import { useEffect, useRef } from 'react';
import { HelpHint } from '../../../HelpHint';
import { useChatActions, useChatComposer, useChatPresentation } from '../context/ChatContext';
import { useI18n } from '../../../../i18n';

export function ChatWorkspaceBanner() {
  const { t } = useI18n();
  const composer = useChatComposer();
  const presentation = useChatPresentation();
  const actions = useChatActions();
  const banner = composer.workspaceBanner;
  const announcedWorkspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (banner.mode !== 'active') {
      announcedWorkspaceIdRef.current = null;
      return;
    }
    if (announcedWorkspaceIdRef.current === banner.workspace.projectId) return;
    announcedWorkspaceIdRef.current = banner.workspace.projectId;
    actions.setCommandStatus(t('chat.workspaceBanner.contextHint'));
  }, [actions, banner, t]);

  if (banner.mode === 'proposal') {
    const proposal = banner.proposal;
    const fileSummary = proposal.requestedFilePaths?.length
      ? proposal.requestedFilePaths.slice(0, 3).join(' · ')
      : null;
    const currentWorkspace = banner.currentWorkspace;
    const copyLine = banner.intent === 'create'
      ? t('chat.workspaceBanner.createCopy', { assistantName: presentation.assistantName })
      : banner.intent === 'switch'
        ? t('chat.workspaceBanner.switchCopy', { assistantName: presentation.assistantName })
        : t('chat.workspaceBanner.enterCopy', { assistantName: presentation.assistantName });
    const primaryLabel = banner.intent === 'create'
      ? t('chat.workspaceBanner.createAction')
      : banner.intent === 'switch'
        ? t('chat.workspaceBanner.switchAction')
        : t('chat.workspaceBanner.enterAction');
    const secondaryLabel = currentWorkspace ? t('chat.workspaceBanner.stayHere') : t('chat.workspaceBanner.notNow');

    return (
      <div className="chat-workspace-banner proposal" role="region" aria-label={t('chat.workspaceBanner.proposalAria')}>
        <div className="chat-workspace-banner-copy">
          <strong>
            {proposal.requestedProjectTitle}
            <HelpHint
              className="help-hint--workspace-banner"
              label={t('chat.workspaceBanner.proposalHintLabel')}
              text={t('chat.workspaceBanner.proposalHintText')}
            />
          </strong>
          <span>{copyLine}</span>
          {currentWorkspace ? <span>{t('chat.workspaceBanner.currentWorkspace', { workspace: currentWorkspace.title })}</span> : null}
          {fileSummary ? <em>{fileSummary}</em> : null}
        </div>
        <div className="chat-workspace-banner-actions">
          <button type="button" className="tool-btn compact primary" onClick={() => { void actions.acceptWorkspaceProposal(); }}>
            {primaryLabel}
          </button>
          <button type="button" className="tool-btn compact" onClick={actions.rejectWorkspaceProposal}>
            {secondaryLabel}
          </button>
        </div>
      </div>
    );
  }

  if (banner.mode !== 'active') {
    return null;
  }

  return (
    <div className="chat-workspace-banner active compact" role="status" aria-label={t('chat.workspaceBanner.activeAria')}>
      <div className="chat-workspace-banner-copy">
        <strong>
          {banner.workspace.title}
          <HelpHint
            className="help-hint--workspace-banner"
            label={t('chat.workspaceBanner.activeHintLabel')}
            text={t('chat.workspaceBanner.activeHintText')}
          />
        </strong>
        <span>{t('chat.workspaceBanner.fileCount', { count: banner.workspace.fileCount })}</span>
        <em>{t('chat.workspaceBanner.lockedBudget')}</em>
      </div>
      <div className="chat-workspace-banner-actions">
        <button type="button" className="tool-btn compact" onClick={actions.openActiveWorkspace}>
          {t('chat.workspaceBanner.viewFiles')}
        </button>
      </div>
    </div>
  );
}
