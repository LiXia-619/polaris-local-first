import {
  THEME_SURFACE_REGISTRY,
  type ThemeSurfaceContractGroup
} from '../../../config/theme/themeSurfaceRegistry';

type ThemeSurfaceSelectionSectionProps = {
  selectedSurfaceCodes: string[];
  onSelectedSurfaceCodesChange: (codes: string[]) => void;
  onSelectAll: () => void;
};

function buildNextCodes(selectedSurfaceCodes: string[], surfaceCode: string) {
  return selectedSurfaceCodes.includes(surfaceCode)
    ? selectedSurfaceCodes.filter((code) => code !== surfaceCode)
    : [...selectedSurfaceCodes, surfaceCode];
}

const SURFACE_GROUP_ORDER: ThemeSurfaceContractGroup[] = [
  'world-background',
  'world-chrome',
  'content-surface'
];

const SURFACE_GROUP_COPY: Record<
  ThemeSurfaceContractGroup,
  { title: string; description: string }
> = {
  'world-background': {
    title: '世界背景',
    description: '这一组负责整页气压、底色和呼吸感，换了会最先影响整个世界的温度。'
  },
  'world-chrome': {
    title: '顶部壳',
    description: '这一组是顶栏和导航壳，应该跟着世界气质走，但不该和内容卡面混成一层。'
  },
  'content-surface': {
    title: '内容表面',
    description: '这一组是卡片、气泡、发送栏和面板这些真正被放进世界里的物。'
  }
};

export function ThemeSurfaceSelectionSection({
  selectedSurfaceCodes,
  onSelectedSurfaceCodesChange,
  onSelectAll
}: ThemeSurfaceSelectionSectionProps) {
  const selectionCount = selectedSurfaceCodes.length;
  const selectionSummary =
    selectionCount === 0
      ? '当前没有聚焦区域，聊天里会默认按整页来理解这次换肤。'
      : selectionCount === 1
        ? '当前只盯住 1 个区域，后续更容易做精细微调。'
        : `当前聚焦 ${selectionCount} 个区域，后续会优先围绕这些地方继续收束。`;

  return (
    <section className="theme-studio-section">
      <div className="theme-studio-section-head theme-studio-section-head--actions">
        <div>
          <h3>聚焦区域</h3>
          <p>选中你现在最想盯住的界面部分。它会帮 AI 把注意力放到这些地方，不需要你记编号或规则。</p>
        </div>
        <button
          type="button"
          className="btn-secondary compact-btn"
          onClick={onSelectAll}
        >
          取消局部聚焦
        </button>
      </div>
      <div className="theme-surface-groups" role="list" aria-label="换肤聚焦区域">
        {SURFACE_GROUP_ORDER.map((group) => {
          const entries = THEME_SURFACE_REGISTRY.filter((entry) => entry.contractGroup === group);
          if (entries.length === 0) return null;
          const copy = SURFACE_GROUP_COPY[group];
          return (
            <section key={group} className="theme-surface-group">
              <header className="theme-surface-group-head">
                <strong>{copy.title}</strong>
                <p>{copy.description}</p>
              </header>
              <div className="theme-surface-grid">
                {entries.map((entry) => {
                  const code = entry.code;
                  const active = selectedSurfaceCodes.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`theme-surface-chip ${active ? 'active' : ''}`}
                      aria-pressed={active}
                      onClick={() => onSelectedSurfaceCodesChange(buildNextCodes(selectedSurfaceCodes, code))}
                    >
                      <span className="theme-surface-code">{entry.code}</span>
                      <span className="theme-surface-label">{entry.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div className="settings-note">
        {selectionSummary}
      </div>
    </section>
  );
}
