import type { CSSProperties } from 'react';
import type { ResolvedRoomProjectFile } from '../../../engines/roomProjects';
import { useI18n, type AppLanguage, type I18nTranslator } from '../../../i18n';
import { Icon } from '../../Icon';
import { runImpactAction } from '../../haptics';

type RoomProjectFileTreeProps = {
  files: ResolvedRoomProjectFile[];
  onOpenFile: (fileId: string) => void;
};

type FileTreeNode = {
  name: string;
  path: string;
  children: Map<string, FileTreeNode>;
  file?: ResolvedRoomProjectFile;
};

function createTreeNode(name: string, path: string): FileTreeNode {
  return {
    name,
    path,
    children: new Map()
  };
}

function buildFileTree(files: ResolvedRoomProjectFile[], language: AppLanguage) {
  const root = createTreeNode('', '');
  files
    .map((file) => ({
      file,
      segments: file.path.split('/').map((segment) => segment.trim()).filter(Boolean)
    }))
    .filter((entry) => entry.segments.length > 0)
    .sort((left, right) => left.file.path.localeCompare(right.file.path, language))
    .forEach(({ file, segments }) => {
      let current = root;
      segments.forEach((segment, index) => {
        const path = segments.slice(0, index + 1).join('/');
        const existing = current.children.get(segment);
        const next = existing ?? createTreeNode(segment, path);
        if (!existing) current.children.set(segment, next);
        if (index === segments.length - 1) next.file = file;
        current = next;
      });
    });
  return root;
}

function sortTreeNodes(nodes: Iterable<FileTreeNode>, language: AppLanguage) {
  return [...nodes].sort((left, right) => {
    const leftDirectory = !left.file;
    const rightDirectory = !right.file;
    if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1;
    return left.name.localeCompare(right.name, language);
  });
}

function fileMeta(file: ResolvedRoomProjectFile, t: I18nTranslator['t']) {
  if (file.isEntry) return t('collection.project.fileTreeEntry');
  return file.role ?? file.language.toUpperCase();
}

function RoomProjectFileTreeNode({
  node,
  depth,
  language,
  t,
  onOpenFile
}: {
  node: FileTreeNode;
  depth: number;
  language: AppLanguage;
  t: I18nTranslator['t'];
  onOpenFile: (fileId: string) => void;
}) {
  const indentStyle = {
    '--room-project-file-tree-indent': `${depth * 13}px`
  } as CSSProperties;

  const file = node.file;
  if (file) {
    return (
      <button
        type="button"
        className={`room-project-file-tree-row room-project-file-tree-row--file ${file.isEntry ? 'entry' : ''}`}
        style={indentStyle}
        onClick={(event) => {
          runImpactAction(() => onOpenFile(file.fileId), { element: event.currentTarget });
        }}
      >
        <span className="room-project-file-tree-icon" aria-hidden="true">
          <Icon name={file.isEntry ? 'sparkle' : 'code'} size={11} />
        </span>
        <span className="room-project-file-tree-copy">
          <strong>{node.name}</strong>
          <small>{fileMeta(file, t)}</small>
        </span>
      </button>
    );
  }

  return (
    <>
      <div className="room-project-file-tree-row room-project-file-tree-row--directory" style={indentStyle}>
        <span className="room-project-file-tree-icon" aria-hidden="true">
          <Icon name="folder" size={11} />
        </span>
        <span className="room-project-file-tree-copy">
          <strong>{node.name}</strong>
          <small>{t('collection.project.fileTreeItemCount', { count: node.children.size })}</small>
        </span>
      </div>
      {sortTreeNodes(node.children.values(), language).map((child) => (
        <RoomProjectFileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          language={language}
          t={t}
          onOpenFile={onOpenFile}
        />
      ))}
    </>
  );
}

export function RoomProjectFileTree({ files, onOpenFile }: RoomProjectFileTreeProps) {
  const { t, language } = useI18n();
  if (files.length === 0) return null;
  const tree = buildFileTree(files, language);
  const rootNodes = sortTreeNodes(tree.children.values(), language);

  return (
    <div className="room-project-file-tree" aria-label={t('collection.project.fileTreeAria')}>
      <div className="room-project-file-tree-head">
        <Icon name="folder" size={12} />
        <strong>{t('collection.project.fileTreeTitle')}</strong>
      </div>
      <div className="room-project-file-tree-list">
        {rootNodes.map((node) => (
          <RoomProjectFileTreeNode
            key={node.path}
            node={node}
            depth={0}
            language={language}
            t={t}
            onOpenFile={onOpenFile}
          />
        ))}
      </div>
    </div>
  );
}
