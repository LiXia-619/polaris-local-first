// blank-base exists as the lowest visual safety net. Every selector is wrapped in :where(...)
// so any normal preset or generated selector can override it without !important.

function formatWhereSelectors(selectors: string[]) {
  return selectors.map((selector) => `:where(${selector})`).join(',\n');
}

function buildWorldBlankBaseCss(selector: string) {
  const isCollectionShell = selector === '.app-shell.collection';

  // Panels that render as opaque solid surfaces in either world.
  const solidPanelSelectors = [
    `${selector} .preview-banner-trigger`,
    `${selector} .code-card-composer`,
    `${selector} .thinking-box`,
    `${selector} .code-workshop`
  ];

  // In the chat world, a subset of panels floats with transparency instead of full opacity.
  // Collection world uses solid surfaces throughout.
  const floatingPanelSelectors = isCollectionShell
    ? []
    : [
        `${selector} .preview-banner-trigger`,
        `${selector} .tool-event`
      ];

  const floatingPanelCss = floatingPanelSelectors.length > 0
    ? `
${formatWhereSelectors(floatingPanelSelectors)} {
  background: color-mix(in srgb, var(--surface) 38%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 54%, transparent);
  box-shadow: 0 18px 42px color-mix(in srgb, var(--accent-soft) 22%, transparent);
  background-image: none;
}
`
    : '';

  return `
${formatWhereSelectors(solidPanelSelectors)} {
  background: color-mix(in srgb, var(--surface-solid) 92%, white);
  border: 1px solid color-mix(in srgb, var(--border) 92%, transparent);
  box-shadow: var(--shadow-panel);
  background-image: none;
}

${floatingPanelCss}

${formatWhereSelectors([
  `${selector} .preview-banner-trigger`
])} {
  border-radius: var(--radius-lg);
}

${formatWhereSelectors([
  `${selector} .theme-preset-card`,
  `${selector} .theme-custom-base-card`
])} {
  background-image: none;
  box-shadow: var(--shadow-panel);
}

${formatWhereSelectors([
  `${selector} .persona-editor input`,
  `${selector} .persona-editor textarea`,
  `${selector} .message-edit-input`
])} {
  background: color-mix(in srgb, var(--surface) 88%, white);
  border: 1px solid color-mix(in srgb, var(--border) 92%, transparent);
  box-shadow: none;
}

${formatWhereSelectors([
  `${selector} .btn-primary`
])} {
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 78%, white));
  color: white;
}
`;
}

export function buildThemeBlankBaseCss() {
  return [
    buildWorldBlankBaseCss('.app-shell.collection'),
    buildWorldBlankBaseCss('.app-shell.chat')
  ].join('\n');
}
