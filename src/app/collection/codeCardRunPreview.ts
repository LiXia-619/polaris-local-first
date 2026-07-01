import { buildCodeCardPreview, inferCodeLanguage } from '../../engines/codeCardEngine';
import type { CodeCard } from '../../types/domain';
import { resolveCodeCardPresentation, type CodeCardPresentation } from './codeCardPresentation';

export type CodeCardRunPreview = {
  previewItemId: string | null;
  projectId: string | null;
  projectFileCount: number | null;
  title: string;
  srcDoc: string | null;
  content: string;
  language: string;
  presentation: CodeCardPresentation;
};

export function buildCodeCardRunPreview(seed: Partial<CodeCard> & { id?: string | null }): CodeCardRunPreview {
  const code = seed.code ?? '';
  const language = inferCodeLanguage(code, seed.language);
  const presentation = resolveCodeCardPresentation({
    kind: seed.kind,
    language
  });

  return {
    previewItemId: seed.id ?? null,
    projectId: null,
    projectFileCount: null,
    title: seed.title ?? '未命名卡片',
    srcDoc: presentation === 'code' ? buildCodeCardPreview(language, code) : null,
    content: code,
    language,
    presentation
  };
}
