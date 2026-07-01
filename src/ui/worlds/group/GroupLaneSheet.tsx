import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { MessageMarkdown } from '../chat/message/MessageMarkdown';
import type { Persona } from '../../../types/domain';
import { GroupAvatar } from './GroupAvatar';
import type { GroupController } from './groupController';

type GroupLaneSheetProps = {
  controller: GroupController;
  member: Persona;
};

function LaneTypingDots() {
  return (
    <span className="group-typing-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function GroupLaneSheet({ controller, member }: GroupLaneSheetProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
  const items = controller.laneTimelineFor(member.id);
  const replying = controller.laneReplyingMemberIds.includes(member.id);
  const failed = controller.laneFailedMemberIds.includes(member.id);
  // 私域里正在跑的工具：干什么就写什么，不躲在「输入中」后面
  const activityKey = controller.memberLiveStates.find((state) => state.member.id === member.id)?.activityKey ?? null;
  const busy = replying || Boolean(activityKey);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [items.length, busy]);

  const send = () => {
    const content = draft.trim();
    if (!content || replying) return;
    setDraft('');
    void controller.whisper(member.id, content);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const onGrabberPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    dragRef.current = {
      startY: event.clientY,
      startHeight: sheet.getBoundingClientRect().height,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onGrabberPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (!drag || !sheet) return;
    const delta = drag.startY - event.clientY;
    if (Math.abs(delta) > 4) drag.moved = true;
    if (!drag.moved) return;
    const next = Math.min(window.innerHeight - 8, Math.max(120, drag.startHeight + delta));
    sheet.style.transition = 'none';
    sheet.style.height = `${next}px`;
  };

  const onGrabberPointerUp = () => {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    dragRef.current = null;
    if (!sheet) return;
    const settledHeight = sheet.getBoundingClientRect().height;
    sheet.style.transition = '';
    sheet.style.height = '';
    if (!drag) return;
    if (!drag.moved) {
      setExpanded((current) => !current);
      return;
    }
    const viewport = window.innerHeight;
    if (settledHeight > viewport * 0.74) {
      setExpanded(true);
    } else if (settledHeight < viewport * 0.3) {
      controller.setLaneMemberId(null);
    } else {
      setExpanded(false);
    }
  };

  return (
    <div className="group-sheet-backdrop is-lane" onClick={() => controller.setLaneMemberId(null)}>
      <div
        ref={sheetRef}
        className={`group-sheet group-lane ${expanded ? 'is-expanded' : ''}`}
        role="dialog"
        aria-label={t('group.lane.title', { name: member.name })}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="group-lane-grabber"
          role="button"
          aria-label={expanded ? t('group.lane.collapse') : t('group.lane.expand')}
          onPointerDown={onGrabberPointerDown}
          onPointerMove={onGrabberPointerMove}
          onPointerUp={onGrabberPointerUp}
          onPointerCancel={onGrabberPointerUp}
        >
          <span aria-hidden="true" />
        </div>
        <header className="group-sheet-header">
          <span className="group-lane-identity">
            <GroupAvatar persona={member} size={30} />
            <strong>{t('group.lane.title', { name: member.name })}</strong>
          </span>
          <button
            type="button"
            className="group-icon-btn"
            onClick={() => controller.setLaneMemberId(null)}
            aria-label={t('group.create.cancel')}
          >
            <Icon name="x" size={15} />
          </button>
        </header>
        <p className="group-lane-hint">{t('group.lane.hint', { name: member.name })}</p>
        <div className="group-lane-scroll" ref={scrollRef}>
          {items.length === 0 && !busy ? (
            <p className="group-sheet-empty">{t('group.lane.empty')}</p>
          ) : (
            <ul className="group-lane-list">
              {items.map((item) =>
                item.type === 'whisper' ? (
                  <li
                    key={item.id}
                    className={`group-lane-whisper ${item.author === 'user' ? 'is-user' : 'is-member'}`}
                  >
                    <span className="group-lane-whisper-bubble">
                      {item.author === 'user' ? item.content : <MessageMarkdown content={item.content} />}
                    </span>
                  </li>
                ) : (
                  <li key={item.id} className="group-lane-entry">
                    <span className="group-lane-excerpt">{item.publicExcerpt || '…'}</span>
                    {item.thinkingText ? (
                      <details className="group-lane-thinking">
                        <summary>{t('group.lane.thinking')}</summary>
                        <pre>{item.thinkingText}</pre>
                      </details>
                    ) : null}
                    {item.codeBlocks.map((block, index) => (
                      <details className="group-lane-thinking is-code" key={`${item.id}-code-${index}`}>
                        <summary>
                          {block.language ? `${block.language} · ` : `${t('group.lane.codeBlock')} · `}
                          {t('group.timeline.codeLines', { lines: block.lineCount })}
                        </summary>
                        <pre>{block.code}</pre>
                      </details>
                    ))}
                    {item.memoryRecall.length > 0 ? (
                      <details className="group-lane-thinking is-recall">
                        <summary>{t('group.lane.memoryRecall', { count: item.memoryRecall.length })}</summary>
                        <ul className="group-lane-recall-list">
                          {item.memoryRecall.map((recall) => (
                            <li key={recall.id}>
                              <strong>{recall.label}</strong>
                              <span>{recall.excerpt}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {item.toolEvents.length > 0 ? (
                      <div className="group-lane-tools">
                        {item.toolEvents.map((event) => (
                          <span key={event.id} className={`group-lane-tool is-${event.status}`}>
                            <Icon name="wand" size={12} />
                            <span>{event.title || event.toolName || t('group.lane.tool')}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                )
              )}
              {busy ? (
                <li className="group-lane-whisper is-member">
                  <span className="group-lane-whisper-bubble is-typing">
                    <LaneTypingDots />
                    {activityKey ? <span className="group-typing-activity">{t(activityKey)}</span> : null}
                  </span>
                </li>
              ) : null}
              {failed ? (
                <li className="group-lane-failed-row">
                  <span>{t('group.lane.whisperFailed')}</span>
                  <button type="button" onClick={() => void controller.retryWhisper(member.id)}>
                    {t('group.timeline.retry')}
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
        <div className="group-lane-composer">
          <textarea
            rows={1}
            value={draft}
            placeholder={t('group.lane.composerPlaceholder', { name: member.name })}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className={`group-composer-send ${draft.trim() && !replying ? 'has-content' : ''}`}
            disabled={!draft.trim() || replying}
            onClick={send}
            aria-label={t('group.composer.send')}
          >
            <Icon name="send" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
