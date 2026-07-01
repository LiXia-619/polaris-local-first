import type { ThemePreset, ThemeVariables } from '../../types/domain';
import { CUSTOM_THEME_BASE_VARIABLES, normalizeThemeVariables } from './themePresetVariables';

export function createPreset(
  id: string,
  name: string,
  mood: string,
  description: string,
  cssVariables: ThemeVariables,
  options: {
    css: string;
    recipe?: ThemePreset['recipe'];
    styleLabel?: string;
    visibleInStudio?: boolean;
  }
): ThemePreset {
  const baseVariables = normalizeThemeVariables(CUSTOM_THEME_BASE_VARIABLES);
  const overrideVariables = normalizeThemeVariables(cssVariables);

  return {
    id,
    name,
    mood,
    description,
    css: options.css,
    recipe: options.recipe,
    styleLabel: options.styleLabel,
    visibleInStudio: options.visibleInStudio ?? true,
    cssVariables: {
      ...baseVariables,
      ...overrideVariables
    }
  };
}

const COLLECTION_GLASS_CARD_CSS = `
.app-shell.collection {
  --collection-card-background:
    linear-gradient(145deg, rgba(255,255,255,.38), rgba(220,226,228,.74) 54%, rgba(210,240,232,.30) 100%),
    linear-gradient(180deg, rgba(120,132,138,.08), rgba(255,255,255,.03)),
    radial-gradient(circle at top left, rgba(255,255,255,.3), transparent 34%),
    rgba(246, 248, 248, .86);
  --collection-card-border-color: color-mix(in srgb, var(--border-hover) 76%, rgba(122,134,131,.34));
  --collection-card-shadow:
    0 18px 40px rgba(44, 126, 129, .14),
    0 8px 18px rgba(94, 107, 110, .08),
    inset 0 0 0 1px rgba(255,255,255,.34);
  --collection-card-hover-shadow:
    0 24px 52px rgba(44, 126, 129, .20),
    inset 0 0 0 1px rgba(255,255,255,.34);
}

.app-shell.collection .conversation-card .micro-action-btn,
.app-shell.collection .code-card-run-dot,
.app-shell.collection .code-card-composer-tool {
  backdrop-filter: blur(14px) saturate(1.08);
  background:
    linear-gradient(135deg, rgba(255,255,255,.42), rgba(223,230,231,.68) 58%, rgba(219,255,245,.14)),
    linear-gradient(180deg, rgba(122,134,138,.07), rgba(255,255,255,.02));
  border-color: color-mix(in srgb, var(--border-hover) 74%, rgba(118,132,128,.28));
  border-width: 1.2px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.28);
}
`;

const SHELLS = ['.app-shell.collection', '.app-shell.chat'];

/* Chat cool palette is now defined in shell.css at the base level,
   so it applies regardless of which preset is active. */
const PAPER_CHAT_COOL_PALETTE = '';

export const PAPER_PRESET_CSS = SHELLS.map((selector) => `
/* ── Colorful grid paper background ── */
${selector}::before { content: ''; position: absolute; inset: 0; pointer-events: none; background-image:
  linear-gradient(180deg, rgba(255,255,255,.22), transparent 32%),
  repeating-linear-gradient(0deg, rgba(220,170,200,.11) 0 1px, transparent 1px 22px),
  repeating-linear-gradient(90deg, rgba(220,170,200,.08) 0 1px, transparent 1px 22px),
  repeating-linear-gradient(0deg, rgba(180,170,230,.09) 0 1px, transparent 1px 66px),
  repeating-linear-gradient(90deg, rgba(170,190,240,.07) 0 1px, transparent 1px 44px),
  repeating-linear-gradient(0deg, rgba(200,180,230,.06) 0 1px, transparent 1px 88px);
  opacity: .9; }
/* ── Page edge & light wash ── */
${selector}::after { content: ''; position: absolute; inset: 0; pointer-events: none; background:
  linear-gradient(90deg, rgba(255,255,255,.22), transparent 12%, transparent 88%, rgba(210,180,210,.08)),
  radial-gradient(ellipse at 20% 8%, rgba(255,230,244,.22), transparent 32%);
  mix-blend-mode: screen; opacity: .72; }
/* ── Cards / panels: cream paper with subtle grid bleed-through ── */
${selector} .chat-box,
${selector} .card,
${selector} .settings-sheet,
${selector} .menu-sheet { border-style: solid; border-width: 1.4px;
  border-color: color-mix(in srgb, var(--border) 68%, rgba(210,170,200,.22));
  background:
    linear-gradient(180deg, rgba(255,255,252,.88), rgba(250,242,231,.76)),
    repeating-linear-gradient(0deg, rgba(220,170,200,.05) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(90deg, rgba(220,170,200,.04) 0 1px, transparent 1px 22px);
  box-shadow: 0 12px 28px rgba(172,130,162,.10), inset 0 1px 0 rgba(255,255,255,.52); }
`).join('\n') + `
/* ── Collection cards ── */
.app-shell.collection {
  --collection-card-background:
    linear-gradient(180deg, rgba(255,255,252,.92), rgba(248,238,224,.78)),
    repeating-linear-gradient(0deg, rgba(220,170,200,.06) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(90deg, rgba(220,170,200,.04) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(90deg, rgba(170,190,240,.04) 0 1px, transparent 1px 44px),
    rgba(255,255,252,.92);
  --collection-card-border-color: color-mix(in srgb, var(--border-hover) 62%, rgba(210,170,200,.18));
  --collection-card-shadow: 0 14px 32px rgba(172,130,162,.10), inset 0 1px 0 rgba(255,255,255,.48);
}

/* ── Washi tape decorations on collection cards ── */
.app-shell.collection .card::before,
.app-shell.collection .code-card-composer::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 22px;
  width: 52px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(135deg, rgba(230,180,210,.52), rgba(240,190,220,.38));
  border-bottom: 1px dashed rgba(210,150,186,.24);
  transform: rotate(-2deg);
  opacity: .88;
  pointer-events: none;
  z-index: 1;
}
.app-shell.collection .card::after,
.app-shell.collection .code-card-composer::after {
  content: '';
  position: absolute;
  top: -3px;
  right: 24px;
  width: 40px;
  height: 13px;
  border-radius: 2px;
  background: linear-gradient(135deg, rgba(170,180,240,.48), rgba(200,200,240,.32));
  border-bottom: 1px dashed rgba(170,160,210,.20);
  transform: rotate(2.5deg);
  opacity: .84;
  pointer-events: none;
  z-index: 1;
}

/* ── Tags: colored label stickers ── */
.app-shell.collection .tags span {
  background: linear-gradient(135deg, rgba(240,200,230,.38), rgba(255,236,208,.28));
  border: 1px solid rgba(200,160,190,.22);
  border-radius: 4px;
  color: var(--text-soft);
}
.app-shell.collection .tags span:nth-child(2n) {
  background: linear-gradient(135deg, rgba(200,200,240,.36), rgba(220,220,248,.26));
  border-color: rgba(170,170,220,.20);
}
.app-shell.collection .tags span:nth-child(3n) {
  background: linear-gradient(135deg, rgba(210,200,240,.36), rgba(230,220,248,.26));
  border-color: rgba(180,170,220,.20);
}

/* ── Shelf tabs: keep the active state on the button itself ── */
.app-shell .shelf-tab.active {
  background: none;
}

/* ── Topbar: paper continuation ── */
.app-shell.collection .topbar-surface {
  border-bottom: 1px dashed rgba(210,170,200,.22);
}
.app-shell.chat .topbar-surface {
  border-bottom: none;
}

/* ── User bubble: torn sticky note ── */
.app-shell.chat .bubble.user {
  background:
    linear-gradient(180deg, rgba(255,246,252,.92), rgba(252,240,248,.82)),
    repeating-linear-gradient(0deg, rgba(220,170,200,.04) 0 1px, transparent 1px 22px);
  border: 1.4px solid rgba(210,170,200,.26);
  border-radius: 20px 20px 6px 20px;
  box-shadow: 0 6px 18px rgba(172,130,162,.08), 2px 3px 0 -1px rgba(210,170,200,.08);
  position: relative;
}

/* ── Assistant reply text: pencil note in margin ── */
.app-shell.chat .bubble.assistant {
  padding: 4px 0 4px 14px;
  border-left: 2.5px solid rgba(208,168,118,.28);
  background: transparent;
  color: rgba(72, 60, 82, .96);
  text-shadow: 0 1px 0 rgba(255,255,255,.20);
  font-style: normal;
}

/* ── Composer: letter writing area with ruled lines ── */
.app-shell.chat .chat-box {
  border: 1.4px dashed rgba(210,170,200,.34);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255,252,255,.94), rgba(254,248,255,.86)),
    repeating-linear-gradient(0deg, rgba(200,180,230,.06) 0 1px, transparent 1px 24px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 8px 20px rgba(172,130,162,.06);
}

/* ── Send button: round stamp ── */
.app-shell.chat .send-btn {
  border-radius: 50%;
}

/* ── Micro buttons: small paper chips ── */
.app-shell .micro-action-btn {
  border: 1px dashed rgba(210,170,200,.28);
  background: rgba(255,250,254,.72);
  border-radius: 12px;
}

/* ── Topbar: paper-like separation for collection, transparent for chat ── */
.app-shell.collection .topbar-surface {
  border-bottom: 1px dashed rgba(210,170,200,.22);
}
.app-shell.chat .topbar-surface {
  border-bottom: none;
}

/* ── Tool event: dashed border like a cut-out ── */
.app-shell.chat .tool-event {
  border-style: dashed;
  border-color: rgba(210,170,200,.28);
}

/* ── Thinking box: subtle note card ── */
.app-shell.chat .thinking-box {
  border-style: dashed;
  border-color: rgba(210,170,200,.22);
  background: rgba(255,252,244,.48);
}

/* ── Empty state: watercolor hint ── */
.empty-state-floating .empty-state-title {
  color: rgba(180,140,100,.52);
}
.empty-state-floating .empty-state-hint {
  color: rgba(180,140,100,.36);
}
.empty-state-floating .empty-state-icon {
  background: linear-gradient(135deg, #d4789a, #b088cc, #7ca8e6, #d4789a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Settings sheet: warm paper ── */
.app-shell.chat .settings-sheet,
.app-shell.chat .menu-sheet {
  border-radius: 26px 26px 0 0;
  border-top: 1px dashed rgba(210,170,200,.22);
}
` + PAPER_CHAT_COOL_PALETTE;

export const GLASS_PRESET_CSS = SHELLS.map((selector) => `
${selector}::before { content: ''; position: absolute; inset: 0; pointer-events: none; background:
  radial-gradient(circle at 18% 16%, rgba(255,255,255,.28), transparent 24%),
  radial-gradient(circle at 82% 12%, rgba(171,242,229,.22), transparent 22%),
  linear-gradient(180deg, rgba(255,255,255,.12), transparent 42%);
  opacity: .88; }
${selector}::after { content: ''; position: absolute; inset: 0; pointer-events: none; background-image:
  repeating-linear-gradient(135deg, rgba(255,255,255,.09) 0 1px, transparent 1px 14px);
  opacity: .42; }
${selector} .chat-box,
${selector} .card,
${selector} .settings-sheet { backdrop-filter: blur(16px) saturate(1.12); background:
  linear-gradient(145deg, rgba(255,255,255,.42), rgba(221,227,229,.76) 58%, rgba(229,255,249,.14)),
  linear-gradient(180deg, rgba(119,131,137,.08), rgba(255,255,255,.02)); border-width: 1.2px; box-shadow:
  0 18px 36px rgba(44, 126, 129, .12),
  0 8px 18px rgba(92, 106, 109, .08),
  inset 0 0 0 1px rgba(255,255,255,.36); }
`).join('\n') + COLLECTION_GLASS_CARD_CSS;

export const AURORA_PRESET_CSS = `
body[data-polaris-preset='aurora-drift'] {
  --chat-bubble-user-shadow: 0 10px 22px rgba(128, 106, 210, .12);
  --chat-bubble-assistant-backdrop: none;
  --chat-system-note-backdrop: none;
  --chat-composer-backdrop: none;
  --chat-preview-strip-backdrop: none;
  --sheet-surface-backdrop: none;
}

.app-shell.chat::before,
.app-shell.collection::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255,255,255,.2), transparent 38%);
  opacity: .62;
}

.app-shell.chat::after,
.app-shell.collection::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: transparent;
}

.app-shell.chat .bubble,
.app-shell.chat .chat-box-shell,
.app-shell.chat .active-preview-strip,
.app-shell.chat .system-inline-note,
.app-shell.chat .tool-event,
.app-shell.chat .tool-btn,
.app-shell.chat .message-code-card,
.app-shell.chat .message-code-drawer-head,
.app-shell.chat .message-projected-code,
.app-shell.chat .settings-sheet,
.app-shell.chat .menu-sheet {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.app-shell.chat .bubble.user {
  border-radius: 24px 24px 8px 24px;
  border: 1px solid rgba(255,255,255,.34);
  background: var(--bubble-user);
}

.app-shell.chat .bubble.assistant {
  background: transparent;
  border: 0;
  border-left: 2px solid rgba(255,255,255,.34);
  border-radius: 0;
  padding: 3px 0 3px 12px;
  box-shadow: none;
}

.app-shell.chat .chat-box-shell,
.app-shell.chat .tool-event,
.app-shell.chat .message-code-card,
.app-shell.chat .message-code-drawer-head,
.app-shell.chat .message-projected-code,
.app-shell.chat .settings-sheet,
.app-shell.chat .menu-sheet {
  background: linear-gradient(180deg, rgba(255,255,255,.46), rgba(244,238,255,.24));
  box-shadow: 0 10px 24px rgba(118, 96, 180, .08), inset 0 1px 0 rgba(255,255,255,.32);
}

.app-shell.collection {
  --collection-card-background:
    linear-gradient(145deg, rgba(251,246,255,.88) 0%, rgba(228,233,255,.72) 54%, rgba(204,255,235,.46) 100%);
  --collection-card-border-color: rgba(162, 132, 220, .24);
  --collection-card-shadow: 0 10px 24px rgba(118, 96, 180, .10), inset 0 1px 0 rgba(255,255,255,.28);
  --collection-card-hover-shadow: 0 14px 30px rgba(118, 96, 180, .14), inset 0 1px 0 rgba(255,255,255,.32);
}

.app-shell.collection .card,
.app-shell.collection .conversation-card .micro-action-btn,
.app-shell.collection .code-card-run-dot,
.app-shell.collection .code-card-composer-tool {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.app-shell .bg-glow-top,
.app-shell .bg-glow-bottom,
.app-shell.chat .tool-event-icon.running {
  animation: none;
}
`;

export const PLUSH_PRESET_CSS = SHELLS.map((selector) => `
${selector}::before { content: ''; position: absolute; inset: 0; pointer-events: none; background:
  radial-gradient(circle at 16% 18%, rgba(255,225,233,.24), transparent 22%),
  radial-gradient(circle at 78% 72%, rgba(209,185,255,.18), transparent 24%),
  linear-gradient(180deg, rgba(255,255,255,.12), transparent 42%);
  opacity: .82; }
${selector}::after { content: ''; position: absolute; inset: 0; pointer-events: none; background:
  radial-gradient(circle at 50% 0%, rgba(255,255,255,.18), transparent 32%);
  opacity: .74; }
${selector} .chat-box,
${selector} .card,
${selector} .settings-sheet { border-radius: 28px; border-width: 1.4px; box-shadow:
  0 20px 44px rgba(145, 90, 126, .14),
  inset 0 1px 0 rgba(255,255,255,.42); }
${selector} .bubble.user { border-radius: 30px; border-width: 1.4px; box-shadow: 0 12px 24px rgba(145, 90, 126, .10); }
${selector} .bubble.assistant {
  padding: 3px 0 3px 10px;
  border-left: 2px solid color-mix(in srgb, var(--accent-soft) 82%, transparent);
}
`).join('\n');

export const POLARIS_PRESET_CSS = SHELLS.map((selector) => `
${selector}::before { content: ''; position: absolute; inset: 0; pointer-events: none; background:
  radial-gradient(circle at 18% 14%, rgba(109, 136, 214, .14), transparent 24%),
  radial-gradient(circle at 84% 9%, rgba(243, 214, 151, .10), transparent 18%),
  linear-gradient(180deg, rgba(255,255,255,.03), transparent 24%);
  opacity: .96; }
${selector}::after { content: ''; position: absolute; inset: 0; pointer-events: none; background-image:
  radial-gradient(circle at 22% 18%, rgba(255,255,255,.12) 0 1px, transparent 1px),
  radial-gradient(circle at 76% 28%, rgba(255,255,255,.08) 0 1px, transparent 1px),
  radial-gradient(circle at 64% 78%, rgba(255,255,255,.06) 0 1px, transparent 1px);
  background-size: 180px 180px, 240px 240px, 210px 210px;
  opacity: .58; }
`).join('\n') + `
.app-shell.chat .topbar-surface,
.app-shell.collection .topbar-surface {
  background: linear-gradient(180deg, rgba(7, 9, 18, .84), rgba(8, 12, 24, .28));
  border-bottom: 1px solid rgba(160, 190, 255, .07);
  backdrop-filter: blur(18px);
}

.app-shell.collection .search-input,
.app-shell.collection .chip,
.app-shell.collection .card,
.app-shell.collection .code-card-composer,
.app-shell.collection .empty-state-card,
.app-shell.collection .conversation-card {
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
}

.app-shell.collection .brand h1,
.app-shell.collection .collection-filter-panel .chip.active,
.app-shell.collection .card h3,
.app-shell.collection .conversation-card-persona,
.app-shell.collection .conversation-card-updated {
  color: #cfa85f;
}

.app-shell.collection .brand p,
.app-shell.collection .world-collection,
.app-shell.collection .card .card-meta-row small,
.app-shell.collection .conversation-excerpt,
.app-shell.collection .conversation-stats,
.app-shell.collection .conversation-stats span,
.app-shell.collection .code-card-origin,
.app-shell.collection .card pre,
.app-shell.collection .tags span,
.app-shell.collection .collection-filter-panel .chip {
  color: rgba(184, 151, 95, .84);
}

.app-shell.collection .shelf-tab-label {
  color: rgba(153, 125, 80, .9);
}

.app-shell.collection .shelf-tab.active .shelf-tab-label,
.app-shell.collection .shelf-tab:hover .shelf-tab-label {
  color: #ba9557;
}

.app-shell.collection .collection-filter-panel .chip {
  border-color: rgba(198, 167, 105, .22);
}

.app-shell.collection {
  --collection-card-border-color: rgba(198, 167, 105, .22);
}

.app-shell.collection .collection-filter-panel .chip.active,
.app-shell.collection .shelf-tab.active {
  box-shadow: none;
}

.app-shell.chat .bubble.user {
  color: var(--text);
  border-color: rgba(170, 195, 255, .13);
}

.app-shell.chat .bubble.assistant {
  color: rgba(222, 232, 255, .94);
  background: transparent;
  box-shadow: none;
}

.app-shell.chat .bubble.assistant,
.app-shell.collection .card,
.app-shell.collection .conversation-card,
.app-shell.collection .code-card-composer {
  border-color: rgba(130, 160, 225, .09);
}
`;

export const NEON_PRESET_CSS = SHELLS.map((selector) => `
${selector}::before { content: ''; position: absolute; inset: 0; pointer-events: none; background:
  linear-gradient(135deg, rgba(255,89,140,.20), transparent 24%),
  linear-gradient(225deg, rgba(57,207,255,.20), transparent 26%),
  radial-gradient(circle at 22% 80%, rgba(255,220,104,.18), transparent 18%),
  radial-gradient(circle at 80% 18%, rgba(154,124,255,.18), transparent 20%);
  opacity: .96; }
${selector}::after { content: ''; position: absolute; inset: 0; pointer-events: none; background-image:
  repeating-linear-gradient(135deg, rgba(255,255,255,.10) 0 1px, transparent 1px 16px);
  mix-blend-mode: screen; opacity: .5; }
${selector} .chat-box,
${selector} .card,
${selector} .settings-sheet { border-width: 1.2px; border-color: color-mix(in srgb, var(--accent) 58%, white);
  box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 0 14px rgba(74, 143, 255, .10), 0 14px 26px rgba(59, 80, 150, .10); }
`).join('\n') + `
.app-shell.collection {
  --collection-card-background:
    linear-gradient(145deg, rgba(255,249,250,.92) 0%, rgba(255,224,208,.78) 24%, rgba(216,233,255,.82) 58%, rgba(249,220,255,.76) 100%),
    linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.04)),
    rgba(255,249,250,.92);
  --collection-card-border-color: color-mix(in srgb, var(--accent) 62%, rgba(255,105,157,.42));
  --collection-card-shadow:
    0 0 0 1px rgba(255,255,255,.14),
    0 0 16px rgba(44, 158, 255, .10),
    0 14px 28px rgba(136, 88, 195, .10);
}

.app-shell.collection .card::before,
.app-shell.collection .code-card-composer::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(118deg, rgba(255,255,255,.34), transparent 26%, rgba(255,255,255,.08) 42%, transparent 58%),
    repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 1px, transparent 1px 14px);
  mix-blend-mode: screen;
  opacity: .74;
}

.app-shell.collection .tags span {
  background: linear-gradient(135deg, rgba(255,181,210,.46), rgba(187,229,255,.44));
  color: rgba(68, 48, 84, .82);
}

.app-shell.collection .code-card-run-dot {
  background: linear-gradient(135deg, rgba(255,255,255,.74), rgba(208,229,255,.42));
  border-color: color-mix(in srgb, var(--accent) 66%, rgba(255,112,164,.42));
  box-shadow: 0 0 10px rgba(68, 172, 255, .10);
}

.app-shell.chat .bubble.user {
  border-width: 1.2px;
}
.app-shell.chat .bubble.assistant {
  padding-bottom: 5px;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 42%, transparent);
  box-shadow: inset 0 -1px 0 rgba(255,255,255,.18);
}
.app-shell .bg-glow-top,
.app-shell .bg-glow-bottom,
.app-shell .send-btn.has-content {
  animation: none;
}
`;
