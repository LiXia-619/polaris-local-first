import { useEffect, useRef, useState } from 'react';
import type { CodeCardActionMode } from '../../../../app/chat/chatDerivedState';
import { isThemeCssCodeBlock } from '../../../../app/chat/chatCodeBlockSemantics';
import type { CodeBlockCandidate } from '../../../../engines/codeCardEngine';
import { useI18n, type I18nTranslator } from '../../../../i18n';
import { writeTextToClipboard } from '../../../../infrastructure/clipboard';
import type { ChatMessage, ToolInvocation } from '../../../../types/domain';
import { Icon } from '../../../Icon';
import { runSuccessAction } from '../../../haptics';
import { MessageCodeBlockView } from './MessageCodeBlockView';

const SANDBOX_DRAWER_COLLAPSE_MS = 720;

type Translate = I18nTranslator['t'];

type MessageCodeProps = {
  blocks: CodeBlockCandidate[];
  codeCardActionMode: CodeCardActionMode;
  isExpanded: boolean;
  message: ChatMessage;
  sandboxDraftActive?: boolean;
  sandboxToolInvocation?: ToolInvocation | null;
  onToggleExpanded: () => void;
  onApplyCustomCss: (css: string) => void;
};

function drawerTitle(
  t: Translate,
  mode: CodeCardActionMode,
  count: number,
  isSandboxDrawer: boolean,
  isSandboxLive: boolean,
  hasRunCodeOrigin: boolean
) {
  if (isSandboxDrawer && isSandboxLive) {
    return 'Runway in motion';
  }
  if (isSandboxDrawer && hasRunCodeOrigin) return 'Runtime trace';
  if (mode === 'open') {
    return count === 1 ? t('chat.code.drawer.savedSingle') : t('chat.code.drawer.savedMultiple', { count });
  }
  if (isSandboxDrawer) {
    return count === 1 ? t('chat.code.drawer.draftSingle') : t('chat.code.drawer.draftMultiple', { count });
  }
  return count === 1 ? t('chat.code.drawer.detailSingle') : t('chat.code.drawer.detailMultiple', { count });
}

function drawerBody(t: Translate, isSandboxDrawer: boolean, isSandboxLive: boolean, hasRunCodeOrigin: boolean) {
  if (isSandboxDrawer && isSandboxLive) {
    return 'sandbox stream · unfolding below';
  }
  if (isSandboxDrawer && hasRunCodeOrigin) {
    return 'execution surface · tap to inspect';
  }
  if (isSandboxDrawer) return 'write surface · inner scroll';
  return t('chat.code.drawer.detailBody');
}

function drawerKicker(t: Translate, isSandboxDrawer: boolean, isSandboxLive: boolean, hasRunCodeOrigin: boolean) {
  if (isSandboxDrawer && isSandboxLive) {
    return 'POLARIS RUNWAY';
  }
  if (isSandboxDrawer && hasRunCodeOrigin) {
    return 'SANDBOX TRACE';
  }
  if (isSandboxDrawer) return 'CODE RUNWAY';
  return t('chat.code.drawer.detailKicker');
}

function drawerToggleLabel(t: Translate, isSandboxDrawer: boolean, isExpanded: boolean, hasRunCodeOrigin: boolean) {
  if (isSandboxDrawer) {
    if (hasRunCodeOrigin) return isExpanded ? 'CLOSE TRACE' : 'OPEN TRACE';
    return isExpanded ? 'CLOSE CODE' : 'OPEN CODE';
  }
  return isExpanded ? t('chat.code.drawer.collapseDetail') : t('chat.code.drawer.expandDetail');
}

function blockEyebrow(t: Translate, block: CodeBlockCandidate, index: number, total: number) {
  const prefix = total > 1 ? t('chat.code.blockNumber', { index: index + 1 }) : t('chat.code.drawer.detailKicker');
  return `${prefix} · ${block.language}`;
}

function blockTags(block: CodeBlockCandidate) {
  return [block.language, ...block.tags.filter((tag) => tag !== block.language)];
}

function sandboxBlockLabel(block: CodeBlockCandidate, index: number, total: number) {
  if (total === 1) return block.language;
  return `${index + 1}. ${block.language}`;
}

export function MessageCode({
  blocks,
  codeCardActionMode,
  isExpanded,
  message,
  sandboxDraftActive = false,
  sandboxToolInvocation = null,
  onToggleExpanded,
  onApplyCustomCss
}: MessageCodeProps) {
  const { t } = useI18n();
  const [copiedBlockKey, setCopiedBlockKey] = useState<string | null>(null);
  const autoManagedToolIdRef = useRef<string | null>(null);
  const collapseTimerRef = useRef<number | null>(null);
  const dismissedLiveKeyRef = useRef<string | null>(null);
  const sandboxTool =
    sandboxToolInvocation?.kind === 'runCode'
      ? sandboxToolInvocation
      : null;
  const hasRunCodeOrigin =
    sandboxDraftActive
    || Boolean(sandboxTool)
    || (message.nativeToolCalls?.some((toolCall) => toolCall.name.trim() === 'runCode') ?? false);
  const liveSandboxKey = sandboxDraftActive
    ? `draft:${message.id}`
    : sandboxTool?.status === 'running'
      ? `tool:${sandboxTool.id}`
      : null;
  const isSandboxLive = sandboxDraftActive || sandboxTool?.status === 'running';
  const isSandboxDrawer = hasRunCodeOrigin || codeCardActionMode !== 'hidden';

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current === null) return;
    window.clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = null;
  };

  const copyBlock = async (block: CodeBlockCandidate) => {
    if (!block.code.trim()) return;
    await runSuccessAction(() => writeTextToClipboard(block.code));
    const key = `${message.id}-${block.blockIndex}`;
    setCopiedBlockKey(key);
    window.setTimeout(() => {
      setCopiedBlockKey((current) => (current === key ? null : current));
    }, 1400);
  };

  useEffect(() => () => {
    clearCollapseTimer();
  }, []);

  useEffect(() => {
    if (!sandboxDraftActive) return;
    if (dismissedLiveKeyRef.current === `draft:${message.id}`) return;
    if (isExpanded) return;
    autoManagedToolIdRef.current = 'draft';
    onToggleExpanded();
  }, [sandboxDraftActive, isExpanded, message.id, onToggleExpanded]);

  useEffect(() => {
    if (!sandboxTool) {
      if (!sandboxDraftActive) {
        autoManagedToolIdRef.current = null;
        dismissedLiveKeyRef.current = null;
      }
      clearCollapseTimer();
      return;
    }

    clearCollapseTimer();

    if (sandboxTool.status === 'running') {
      autoManagedToolIdRef.current = sandboxTool.id;
      if (!isExpanded) {
        if (dismissedLiveKeyRef.current !== `tool:${sandboxTool.id}`) {
          onToggleExpanded();
        }
      }
      return;
    }

    if (sandboxTool.status !== 'executed') {
      return;
    }

    if (autoManagedToolIdRef.current !== sandboxTool.id || !isExpanded) {
      return;
    }

    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null;
      if (autoManagedToolIdRef.current !== sandboxTool.id) return;
      autoManagedToolIdRef.current = null;
      onToggleExpanded();
    }, SANDBOX_DRAWER_COLLAPSE_MS);

    return () => {
      clearCollapseTimer();
    };
  }, [sandboxTool, isExpanded, onToggleExpanded]);

  const handleToggleExpanded = () => {
    if (liveSandboxKey) {
      dismissedLiveKeyRef.current = isExpanded ? liveSandboxKey : null;
    }
    autoManagedToolIdRef.current = null;
    clearCollapseTimer();
    onToggleExpanded();
  };

  return (
    <div
      className={`message-code-drawer ${isExpanded ? 'open' : 'collapsed'} ${isSandboxDrawer ? 'message-code-drawer--sandbox' : ''}`}
      data-message-id={message.id}
    >
      <button
        type="button"
        className={`message-code-drawer-head ${codeCardActionMode} ${isSandboxDrawer ? 'message-code-drawer-head--sandbox' : ''}`}
        onClick={handleToggleExpanded}
        aria-expanded={isExpanded}
      >
        <div className="message-code-drawer-head-main">
          <span className="message-code-drawer-head-icon" aria-hidden="true">
            <Icon name="code" size={14} />
          </span>
          <div className="message-code-drawer-head-copy">
            <span className="message-code-drawer-kicker">{drawerKicker(t, isSandboxDrawer, isSandboxLive, hasRunCodeOrigin)}</span>
            <strong>{drawerTitle(t, codeCardActionMode, blocks.length, isSandboxDrawer, isSandboxLive, hasRunCodeOrigin)}</strong>
            <p>{drawerBody(t, isSandboxDrawer, isSandboxLive, hasRunCodeOrigin)}</p>
          </div>
        </div>
        <span className="message-code-drawer-toggle">{drawerToggleLabel(t, isSandboxDrawer, isExpanded, hasRunCodeOrigin)}</span>
      </button>
      {isExpanded ? (
        isSandboxDrawer ? (
          <div className="message-code-sandbox-band" aria-label={t('chat.code.sandboxBandAria')}>
            <div className="message-code-sandbox-scroll">
              {blocks.map((block, index) => (
                <section
                  key={`${message.id}-${block.blockIndex}`}
                  className="message-code-sandbox-block"
                >
                  <div className="message-code-sandbox-block-head">
                    <div className="message-code-sandbox-block-copy">
                      <span>{sandboxBlockLabel(block, index, blocks.length)}</span>
                      <strong>{block.title}</strong>
                    </div>
                    <div className="message-code-sandbox-block-actions">
                      {isThemeCssCodeBlock(block) ? (
                        <button
                          type="button"
                          className="message-code-card-apply"
                          onClick={() => onApplyCustomCss(block.code)}
                          aria-label={t('chat.code.applyCss')}
                          title={t('chat.code.applyCss')}
                        >
                          <Icon name="brush" size={13} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`message-code-card-copy ${copiedBlockKey === `${message.id}-${block.blockIndex}` ? 'copied' : ''}`}
                        onClick={() => { void copyBlock(block); }}
                        aria-label={copiedBlockKey === `${message.id}-${block.blockIndex}` ? t('chat.code.copied') : t('chat.code.copy')}
                        title={copiedBlockKey === `${message.id}-${block.blockIndex}` ? t('chat.code.copied') : t('chat.code.copy')}
                      >
                        <Icon name="copy" size={13} />
                      </button>
                    </div>
                  </div>
                  <MessageCodeBlockView
                    code={block.code}
                    language={block.language}
                    className="message-code-sandbox-pre"
                  />
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="message-code-stack">
            {blocks.map((block, index) => (
              <article
                key={`${message.id}-${block.blockIndex}`}
                className="message-code-card"
              >
                <div className="message-code-card-meta">
                  <div className="message-code-card-title">
                    <span>{blockEyebrow(t, block, index, blocks.length)}</span>
                    <strong>{block.title}</strong>
                  </div>
                  <div className="message-code-card-side">
                    <div className="message-code-card-tags">
                      {blockTags(block).slice(0, 4).map((tag) => (
                        <span key={`${message.id}-${block.blockIndex}-${tag}`}>{tag}</span>
                      ))}
                    </div>
                    {isThemeCssCodeBlock(block) ? (
                      <button
                        type="button"
                        className="message-code-card-apply"
                        onClick={() => onApplyCustomCss(block.code)}
                        aria-label={t('chat.code.applyCss')}
                        title={t('chat.code.applyCss')}
                      >
                        <Icon name="brush" size={13} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`message-code-card-copy ${copiedBlockKey === `${message.id}-${block.blockIndex}` ? 'copied' : ''}`}
                      onClick={() => { void copyBlock(block); }}
                      aria-label={copiedBlockKey === `${message.id}-${block.blockIndex}` ? t('chat.code.copied') : t('chat.code.copy')}
                      title={copiedBlockKey === `${message.id}-${block.blockIndex}` ? t('chat.code.copied') : t('chat.code.copy')}
                    >
                      <Icon name="copy" size={13} />
                    </button>
                  </div>
                </div>
                <MessageCodeBlockView code={block.code} language={block.language} />
              </article>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
