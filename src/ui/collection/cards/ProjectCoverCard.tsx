import { memo, type CSSProperties } from 'react';
import { DEFAULT_CODE_CARD_FACE_ROOT_SCOPE, buildScopedCodeCardFaceCss } from '../../../engines/collectionCardFace';
import type { RoomProjectFileSummary } from '../../../engines/roomProjects';
import { useI18n, type I18nTranslator } from '../../../i18n';
import type { RoomProject } from '../../../types/domain';
import { collectionArchiveDateLabel } from '../collectionUtils';
import { ScopedCardFaceStyle } from './ScopedCardFaceStyle';

type ProjectCoverCardProps = {
  project: RoomProject;
  files: RoomProjectFileSummary[];
};

const PROJECT_COVER_PALETTES = [
  { accent: '#5f8f86', soft: '#dcebe6', paper: '#f5fbf8', border: '#a7c4bb', ink: '#416b64' },
  { accent: '#8f6d4d', soft: '#f1e2dc', paper: '#fff8f4', border: '#d0a995', ink: '#744d3f' },
  { accent: '#6f83a4', soft: '#e4e8f3', paper: '#f8f9ff', border: '#b8c2d8', ink: '#4f5f84' },
  { accent: '#9a7a43', soft: '#f1ead8', paper: '#fffaf0', border: '#d2bd82', ink: '#725c2e' },
  { accent: '#74648f', soft: '#ebe5f2', paper: '#fbf8ff', border: '#c3b4d7', ink: '#5e4f78' },
  { accent: '#8f5f6e', soft: '#f3e1e6', paper: '#fff8fa', border: '#d4aab6', ink: '#744857' }
] as const;

const PROJECT_COVER_MARKS = ['spark', 'rails', 'grid', 'steps'] as const;

function hashProjectCoverSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function resolveProjectCoverIdentity(project: RoomProject, files: RoomProjectFileSummary[]) {
  const seed = [
    project.id,
    project.title,
    project.coverNote ?? '',
    project.coverStyle ?? '',
    project.tags.join('|'),
    files.map((file) => `${file.path}:${file.language}:${file.isEntry ? 'entry' : 'file'}`).join('|')
  ].join('::');
  const hash = hashProjectCoverSeed(seed);
  const palette = PROJECT_COVER_PALETTES[hash % PROJECT_COVER_PALETTES.length];
  const mark = PROJECT_COVER_MARKS[Math.floor(hash / PROJECT_COVER_PALETTES.length) % PROJECT_COVER_MARKS.length];

  return { palette, mark };
}

function projectCoverTag(files: RoomProjectFileSummary[], t: I18nTranslator['t']) {
  return t('collection.project.fileCountShort', { count: files.length });
}

function projectCoverDescription(
  project: RoomProject,
  entryFile: RoomProjectFileSummary | undefined,
  t: I18nTranslator['t']
) {
  const coverNote = project.coverNote?.trim();
  if (coverNote) return coverNote;
  if (entryFile) return entryFile.path;
  return t('collection.project.coverWaiting');
}

export const ProjectCoverCard = memo(function ProjectCoverCard({ project, files }: ProjectCoverCardProps) {
  const { t } = useI18n();
  const entryFile = files.find((file) => file.isEntry) ?? files[0];
  const identity = resolveProjectCoverIdentity(project, files);
  const scopedCoverCss = buildScopedCodeCardFaceCss(project.id, project.coverStyle, DEFAULT_CODE_CARD_FACE_ROOT_SCOPE);
  const projectCoverStyle = {
    '--project-cover-accent': identity.palette.accent,
    '--project-cover-accent-soft': identity.palette.soft,
    '--project-cover-paper': identity.palette.paper,
    '--project-cover-border': identity.palette.border,
    '--project-cover-ink': identity.palette.ink
  } as CSSProperties;

  return (
    <>
      {scopedCoverCss ? <ScopedCardFaceStyle ownerId={`project-cover:${project.id}`} cssText={scopedCoverCss} /> : null}
      <div
        className="project-cover-card"
        data-polaris-card-id={project.id}
        style={projectCoverStyle}
        data-project-cover-mark={identity.mark}
      >
        <div className="project-cover-decoration" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="project-cover-inner">
          <div className="project-cover-header">
            <span className="project-cover-mark" aria-hidden="true" />
            <div className="project-cover-name">{t('common.workspace')}</div>
            <div className="project-cover-tag">{projectCoverTag(files, t)}</div>
          </div>
          <div className="project-cover-body">
            <h3 className="project-cover-title">{project.title}</h3>
            <p className="project-cover-description">{projectCoverDescription(project, entryFile, t)}</p>
          </div>
          <div className="project-cover-footer">
            <span className="project-cover-meta">{project.slug || 'project'}</span>
            <span className="project-cover-time">{collectionArchiveDateLabel(project.updatedAt)}</span>
          </div>
        </div>
      </div>
    </>
  );
});
