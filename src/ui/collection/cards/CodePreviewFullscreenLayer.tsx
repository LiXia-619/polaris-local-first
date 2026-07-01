import { CodeRunFullscreen } from '../workshop/CodeRunFullscreen';
import { TextReadingFullscreen } from '../workshop/TextReadingFullscreen';
import { RoomProjectRunFullscreen } from './RoomProjectRunFullscreen';

type CodePreviewFullscreenLayerProps = {
  previewPresentation: 'code' | 'text' | null;
  previewItemId: string | null;
  previewProjectId: string | null;
  previewProjectFileCount: number | null;
  previewTitle: string | null;
  previewLanguage: string | null;
  previewSrcDoc: string | null;
  previewContent: string;
  onClosePreview: () => void;
};

export function CodePreviewFullscreenLayer({
  previewPresentation,
  previewItemId,
  previewProjectId,
  previewProjectFileCount,
  previewTitle,
  previewLanguage,
  previewSrcDoc,
  previewContent,
  onClosePreview
}: CodePreviewFullscreenLayerProps) {
  const showProjectRunner =
    Boolean(previewProjectId)
    && previewTitle !== null
    && previewPresentation === 'code'
    && typeof previewSrcDoc === 'string';

  return (
    <>
      {showProjectRunner && previewProjectId && previewTitle && previewSrcDoc ? (
        <RoomProjectRunFullscreen
          projectId={previewProjectId}
          title={previewTitle}
          fileCount={previewProjectFileCount ?? 0}
          srcDoc={previewSrcDoc}
          code={previewContent}
          onClose={onClosePreview}
        />
      ) : null}

      {!showProjectRunner && previewTitle && previewPresentation === 'code' && (
        <CodeRunFullscreen
          cardId={previewItemId}
          title={previewTitle}
          srcDoc={previewSrcDoc}
          code={previewContent}
          onClose={onClosePreview}
        />
      )}

      {previewTitle && previewPresentation === 'text' && previewLanguage && (
        <TextReadingFullscreen
          title={previewTitle}
          language={previewLanguage}
          content={previewContent}
          onClose={onClosePreview}
        />
      )}
    </>
  );
}
