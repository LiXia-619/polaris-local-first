import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  requestMiniMaxVoiceCatalog,
  requestMiniMaxVoiceDesign,
  type MiniMaxVoiceDesignResult
} from '../../../engines/miniMaxVoiceManagementClient';
import { createUid } from '../../../engines/id';
import type { VoiceGenerationCustomVoice, VoiceGenerationSettings } from '../../../types/domain';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';

type MiniMaxVoiceDesignerDialogProps = {
  voiceGeneration: VoiceGenerationSettings;
  onClose: () => void;
  onSetVoiceGeneration: (patch: Partial<VoiceGenerationSettings>) => void;
};

type DesignerTab = 'library' | 'design';
type BusyState = 'idle' | 'syncing' | 'designing' | 'playing';

function mergeCustomVoices(
  current: VoiceGenerationCustomVoice[] | undefined,
  incoming: VoiceGenerationCustomVoice[]
) {
  const now = Date.now();
  const merged = new Map<string, VoiceGenerationCustomVoice>();
  for (const voice of current ?? []) {
    merged.set(`${voice.providerType}:${voice.voice}`, voice);
  }
  for (const voice of incoming) {
    const key = `${voice.providerType}:${voice.voice}`;
    const existing = merged.get(key);
    merged.set(key, {
      ...existing,
      ...voice,
      id: existing?.id ?? voice.id,
      label: voice.label || existing?.label || voice.voice,
      createdAt: existing?.createdAt ?? voice.createdAt ?? now,
      updatedAt: now
    });
  }
  return Array.from(merged.values());
}

function buildSavedVoice(label: string, voiceId: string): VoiceGenerationCustomVoice {
  const now = Date.now();
  return {
    id: createUid('voice-minimax'),
    providerType: 'minimax',
    label: label.trim() || voiceId,
    voice: voiceId,
    source: 'minimax-generation',
    createdAt: now,
    updatedAt: now
  };
}

export function MiniMaxVoiceDesignerDialog({
  voiceGeneration,
  onClose,
  onSetVoiceGeneration
}: MiniMaxVoiceDesignerDialogProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<DesignerTab>('library');
  const [busyState, setBusyState] = useState<BusyState>('idle');
  const [status, setStatus] = useState('');
  const [prompt, setPrompt] = useState('');
  const [previewText, setPreviewText] = useState(t('settings.voice.designPreviewText'));
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [saveLabel, setSaveLabel] = useState('');
  const [designResult, setDesignResult] = useState<MiniMaxVoiceDesignResult | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const miniMaxVoices = (voiceGeneration.customVoices ?? []).filter((voice) => voice.providerType === 'minimax');

  const stopAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (busyState === 'playing') {
      setBusyState('idle');
    }
  };

  useEffect(() => () => {
    abortRef.current?.abort();
    stopAudio();
  }, []);

  const syncVoices = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusyState('syncing');
    setStatus(t('settings.voice.librarySyncing'));
    try {
      const voices = await requestMiniMaxVoiceCatalog({
        settings: voiceGeneration,
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      onSetVoiceGeneration({
        customVoices: mergeCustomVoices(voiceGeneration.customVoices, voices)
      });
      setStatus(t('settings.voice.librarySynced').replace('{count}', String(voices.length)));
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus(error instanceof Error ? error.message : t('settings.voice.librarySyncFailed'));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusyState('idle');
    }
  };

  const selectVoice = (voice: VoiceGenerationCustomVoice) => {
    stopAudio();
    onSetVoiceGeneration({ voice: voice.voice });
    setStatus(t('settings.voice.librarySelected').replace('{name}', voice.label));
  };

  const deleteVoice = (voice: VoiceGenerationCustomVoice) => {
    const nextVoices = (voiceGeneration.customVoices ?? []).filter((item) => item.id !== voice.id);
    onSetVoiceGeneration({
      customVoices: nextVoices,
      voice: voiceGeneration.voice === voice.voice ? '' : voiceGeneration.voice
    });
  };

  const playBlob = async (blob: Blob) => {
    stopAudio();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audioUrlRef.current = audioUrl;
    audio.onended = () => {
      stopAudio();
      setStatus(t('settings.voice.previewReady'));
    };
    audio.onerror = () => {
      stopAudio();
      setStatus(t('settings.voice.previewFailed'));
    };
    setBusyState('playing');
    setStatus(t('settings.voice.previewPlaying'));
    await audio.play();
  };

  const designVoice = async () => {
    abortRef.current?.abort();
    stopAudio();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusyState('designing');
    setStatus(t('settings.voice.designing'));
    try {
      const result = await requestMiniMaxVoiceDesign({
        settings: voiceGeneration,
        prompt,
        previewText,
        voiceId: customVoiceId,
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      setDesignResult(result);
      setSaveLabel(saveLabel || result.voiceId);
      await playBlob(result.blob);
    } catch (error) {
      if (controller.signal.aborted) return;
      setBusyState('idle');
      setStatus(error instanceof Error ? error.message : t('settings.voice.designFailed'));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const saveDesignedVoice = () => {
    if (!designResult) return;
    const savedVoice = buildSavedVoice(saveLabel, designResult.voiceId);
    onSetVoiceGeneration({
      voice: designResult.voiceId,
      customVoices: mergeCustomVoices(voiceGeneration.customVoices, [savedVoice])
    });
    setTab('library');
    setStatus(t('settings.voice.designSaved').replace('{name}', savedVoice.label));
  };

  const dialog = (
    <div className="voice-designer-dialog" role="dialog" aria-modal="true" aria-labelledby="minimax-voice-designer-title">
      <button type="button" className="voice-designer-scrim" aria-label={t('settings.voice.designerClose')} onClick={onClose} />
      <div className="voice-designer-panel">
        <div className="voice-designer-head">
          <div>
            <span className="menu-section-kicker">{t('settings.voice.designerKicker')}</span>
            <h3 id="minimax-voice-designer-title">{t('settings.voice.designerTitle')}</h3>
          </div>
          <button type="button" className="voice-designer-close" aria-label={t('settings.voice.designerClose')} onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="voice-designer-tabs" role="tablist" aria-label={t('settings.voice.designerTitle')}>
          <button type="button" className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>
            <Icon name="voice" size={14} />
            <span>{t('settings.voice.libraryTab')}</span>
          </button>
          <button type="button" className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>
            <Icon name="wand" size={14} />
            <span>{t('settings.voice.designTab')}</span>
          </button>
        </div>

        {tab === 'library' ? (
          <div className="voice-library-panel">
            <div className="voice-designer-actions">
              <button type="button" className="btn-secondary compact" onClick={syncVoices} disabled={busyState === 'syncing'}>
                <Icon name="refresh" size={14} />
                <span>{busyState === 'syncing' ? t('settings.voice.librarySyncingShort') : t('settings.voice.librarySync')}</span>
              </button>
            </div>
            <div className="voice-library-list" data-empty={miniMaxVoices.length ? 'false' : 'true'}>
              {miniMaxVoices.length ? miniMaxVoices.map((voice) => (
                <div className="voice-library-item" key={voice.id} data-active={voiceGeneration.voice === voice.voice ? 'true' : 'false'}>
                  <button type="button" className="voice-library-main" onClick={() => selectVoice(voice)}>
                    <strong>{voice.label}</strong>
                    <span>{voice.voice}</span>
                  </button>
                  <button type="button" className="voice-library-icon-button" aria-label={t('settings.voice.libraryDelete')} onClick={() => deleteVoice(voice)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              )) : (
                <div className="voice-library-empty">
                  <Icon name="voice" size={18} />
                  <span>{t('settings.voice.libraryEmpty')}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="voice-design-panel">
            <label>{t('settings.voice.designPromptLabel')}</label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t('settings.voice.designPromptPlaceholder')}
              rows={4}
            />
            <label>{t('settings.voice.designPreviewLabel')}</label>
            <textarea
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value)}
              maxLength={500}
              rows={3}
            />
            <label>{t('settings.voice.designVoiceIdLabel')}</label>
            <input
              value={customVoiceId}
              onChange={(event) => setCustomVoiceId(event.target.value)}
              placeholder={t('settings.voice.designVoiceIdPlaceholder')}
            />
            <div className="voice-designer-actions voice-designer-actions--split">
              <button type="button" className="btn-secondary compact" onClick={designVoice} disabled={busyState === 'designing'}>
                <Icon name="wand" size={14} />
                <span>{busyState === 'designing' ? t('settings.voice.designingShort') : t('settings.voice.designGenerate')}</span>
              </button>
              <button
                type="button"
                className="btn-secondary compact"
                onClick={() => {
                  if (busyState === 'playing') {
                    stopAudio();
                    setStatus('');
                    return;
                  }
                  if (designResult) void playBlob(designResult.blob);
                }}
                disabled={!designResult}
              >
                <Icon name={busyState === 'playing' ? 'pause' : 'play'} size={14} />
                <span>{busyState === 'playing' ? t('settings.voice.previewStop') : t('settings.voice.previewPlay')}</span>
              </button>
            </div>
            {designResult ? (
              <div className="voice-design-save">
                <label>{t('settings.voice.designSaveLabel')}</label>
                <div className="voice-setting-row">
                  <input
                    value={saveLabel}
                    onChange={(event) => setSaveLabel(event.target.value)}
                    placeholder={designResult.voiceId}
                  />
                  <button type="button" className="btn-secondary compact" onClick={saveDesignedVoice}>
                    <Icon name="check" size={14} />
                    <span>{t('settings.voice.designSave')}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {status ? (
          <p className="voice-preview-status voice-designer-status" data-state={busyState}>{status}</p>
        ) : null}
      </div>
    </div>
  );

  return typeof document === 'undefined'
    ? dialog
    : createPortal(dialog, document.body);
}
