import { useEffect, useState } from 'react';
import { parseMcpServersJson, serializeMcpServersToJson } from '../../../stores/runtimeStoreMcp';
import { useI18n } from '../../../i18n/useI18n';
import type { McpServerConfig } from '../../../types/domain';
import { Icon } from '../../Icon';

type McpJsonEditorSheetProps = {
  open: boolean;
  servers: McpServerConfig[];
  onClose: () => void;
  onSave: (servers: McpServerConfig[]) => void;
};

export function McpJsonEditorSheet({
  open,
  servers,
  onClose,
  onSave
}: McpJsonEditorSheetProps) {
  const { t } = useI18n();
  const [jsonText, setJsonText] = useState('');

  useEffect(() => {
    if (!open) return;
    setJsonText(serializeMcpServersToJson(servers));
  }, [open, servers]);

  if (!open) return null;

  const submit = () => {
    try {
      onSave(parseMcpServersJson(jsonText));
      onClose();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('settings.mcp.jsonParseFailed'));
    }
  };

  return (
    <div className="mcp-inline-sheet-overlay" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="mcp-inline-sheet mcp-inline-sheet--tall" role="dialog" aria-modal="true" aria-label={t('settings.mcp.jsonTitle')}>
        <div className="sheet-handle" />
        <div className="mcp-inline-sheet-header">
          <button type="button" className="mcp-icon-button" onClick={onClose} aria-label={t('settings.mcp.close')}>
            <Icon name="x" size={16} />
          </button>
          <strong>{t('settings.mcp.jsonTitle')}</strong>
          <button type="button" className="mcp-inline-sheet-confirm" onClick={submit}>
            {t('settings.mcp.save')}
          </button>
        </div>

        <div className="settings-form mcp-settings-form mcp-json-form">
          <label className="mcp-json-field">
            MCP JSON
            <textarea
              className="mcp-json-editor"
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              spellCheck={false}
            />
          </label>
        </div>

        <div className="mcp-inline-sheet-actions mcp-inline-sheet-actions--json">
          <button type="button" className="mcp-btn secondary" onClick={() => setJsonText(serializeMcpServersToJson(servers))}>
            {t('settings.mcp.reset')}
          </button>
          <button type="button" className="mcp-btn primary" onClick={submit}>
            {t('settings.mcp.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
