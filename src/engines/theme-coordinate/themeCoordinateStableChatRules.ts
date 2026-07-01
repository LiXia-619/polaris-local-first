import type { ThemeToolScope } from '../../types/domain';
import type { ThemeCoordinatePreview } from './themeCoordinateSpaceMapping';
import {
  cssBlock,
  isPrototypeFamily,
  lerp
} from './themeCoordinateStableRuleShared';

export function buildBackgroundRule(scope: ThemeToolScope, preview: ThemeCoordinatePreview) {
  void scope;
  void preview;
  return '';
}

export function buildChatTypographyRules(preview: ThemeCoordinatePreview) {
  const airy = Math.max(0, (-preview.state.meaning + 10) / 20);
  const tactile = Math.max(0, (preview.state.meaning + 10) / 20);
  const energetic = Math.max(0, (preview.state.emotion + 10) / 20);
  const restrained = 1 - energetic;

  const bubbleSize = `${lerp(13.1, 14.7, airy * 0.52 + energetic * 0.18).toFixed(2)}px`;
  const bubbleWeight = Math.round(lerp(395, 520, energetic * 0.64 + tactile * 0.08));
  const bubbleTracking = `${(0.001 + airy * 0.014 + restrained * 0.01 - energetic * 0.004).toFixed(3)}em`;
  const bubbleLine = lerp(1.5, 1.76, airy * 0.52 + restrained * 0.18).toFixed(2);
  const paragraphGap = `${lerp(0.4, 0.68, airy * 0.42 + restrained * 0.18).toFixed(2)}em`;

  const composerSize = `${lerp(14.2, 16.1, airy * 0.44 + energetic * 0.22).toFixed(2)}px`;
  const composerWeight = Math.round(lerp(400, 520, energetic * 0.56));
  const composerTracking = `${(0.002 + airy * 0.01 + restrained * 0.006 - energetic * 0.003).toFixed(3)}em`;
  const composerLine = lerp(1.44, 1.68, airy * 0.46 + restrained * 0.14).toFixed(2);

  const hintSize = `${lerp(10.6, 11.7, airy * 0.38 + restrained * 0.18).toFixed(2)}px`;
  const hintTracking = `${(0.006 + airy * 0.012 + restrained * 0.008).toFixed(3)}em`;
  const emptyTitleSize = `${lerp(13.4, 15, airy * 0.42 + energetic * 0.1).toFixed(2)}px`;
  const emptyHintSize = `${lerp(11.8, 13, airy * 0.34 + restrained * 0.14).toFixed(2)}px`;
  const flowGap = `${Math.round(lerp(12, 18, airy * 0.5 + restrained * 0.16))}px`;

  return [
    cssBlock('.app-shell.chat .chat-flow', `gap: ${flowGap};`),
    cssBlock(
      '.app-shell.chat .bubble.user, .app-shell.chat .bubble.assistant',
      `font-size: ${bubbleSize};\nfont-weight: ${bubbleWeight};\nletter-spacing: ${bubbleTracking};\nline-height: ${bubbleLine};`
    ),
    cssBlock(
      '.app-shell.chat .bubble.user .message-rich-text, .app-shell.chat .bubble.assistant .message-rich-text',
      `gap: ${paragraphGap};\nletter-spacing: ${bubbleTracking};\nline-height: ${bubbleLine};`
    ),
    cssBlock('.app-shell.chat .bubble.user .message-rich-text-paragraph, .app-shell.chat .bubble.assistant .message-rich-text-paragraph', `line-height: ${bubbleLine};`),
    cssBlock('.app-shell.chat .bubble.user .message-markdown-heading, .app-shell.chat .bubble.assistant .message-markdown-heading', `letter-spacing: ${`${(0.004 + energetic * 0.01 + airy * 0.004).toFixed(3)}em`};`),
    cssBlock('.app-shell.chat .assistant-streaming-hint, .app-shell.chat .system-inline-note', `font-size: ${hintSize};\nletter-spacing: ${hintTracking};`),
    cssBlock('.app-shell.chat .chat-box textarea', `font-size: ${composerSize};\nfont-weight: ${composerWeight};\nletter-spacing: ${composerTracking};\nline-height: ${composerLine};`),
    cssBlock('.app-shell.chat .active-preview-copy strong', `letter-spacing: ${`${(0.004 + airy * 0.008 + energetic * 0.006).toFixed(3)}em`};`),
    cssBlock('.app-shell.chat .active-preview-copy p', `font-size: ${hintSize};\nline-height: ${composerLine};`),
    cssBlock('.app-shell.chat .chat-empty-state .empty-state-title', `font-size: ${emptyTitleSize};\nletter-spacing: ${`${(0.004 + airy * 0.01 + restrained * 0.008).toFixed(3)}em`};`),
    cssBlock('.app-shell.chat .chat-empty-state .empty-state-hint', `font-size: ${emptyHintSize};\nline-height: ${lerp(1.5, 1.72, airy * 0.42 + restrained * 0.16).toFixed(2)};`)
  ].filter(Boolean).join('\n');
}

export function buildTopbarRules(preview: ThemeCoordinatePreview, scope: ThemeToolScope) {
  const spec = preview.surfaceSpecs.topbar;
  const clear = preview.surfaceTraits.topbar === 'topbar-clear';
  const cloudFrame = preview.surfaceTraits.composer === 'composer-cloud';
  const woodRaised = isPrototypeFamily(preview, 'grain-wood');
  const airy = Math.max(0, (-preview.state.meaning + 10) / 20);
  const energetic = Math.max(0, (preview.state.emotion + 10) / 20);
  const restrained = 1 - energetic;
  const brandTracking = `${(0.008 + airy * 0.026 + restrained * 0.012).toFixed(3)}em`;
  const metaTracking = `${(0.01 + airy * 0.032 + restrained * 0.018).toFixed(3)}em`;
  const topbarGap = `${Math.round(lerp(10, 18, airy * 0.56 + restrained * 0.18))}px`;
  const actionGap = `${Math.round(lerp(6, 12, airy * 0.42 + restrained * 0.24))}px`;
  const buttonHeight = `${Math.round(lerp(34, 40, energetic * 0.58 + (1 - airy) * 0.2))}px`;
  const buttonRadius = `${Math.round(lerp(12, 18, airy * 0.74 + restrained * 0.12))}px`;
  const brandPadY = `${Math.round(lerp(2, 7, airy * 0.52 + restrained * 0.18))}px`;
  const bannerGap = `${Math.round(lerp(6, 10, airy * 0.5 + restrained * 0.16))}px`;
  const topbarSelector = scope === 'chat' ? 'chat-topbar' : 'app-topbar';
  const topbarRule = cssBlock(topbarSelector, clear
    ? 'background: transparent;\nborder: 0;\nbox-shadow: none;\nbackdrop-filter: none;'
    : woodRaised
      ? `background: color-mix(in srgb, ${spec.fill} 92%, rgba(255,255,255,0.04));\nborder: 0;\nbox-shadow: none;\nbackdrop-filter: blur(${spec.blur}) saturate(1.01);\ncolor: ${spec.text};`
      : `background: ${spec.fill} padding-box, ${spec.borderPaint} border-box;\nborder: ${spec.borderWidth} ${spec.borderStyle} transparent;\nbox-shadow: none;\nbackdrop-filter: blur(${spec.blur}) saturate(1.02);\ncolor: ${spec.text};`);
  const buttonRule = cssBlock('app-button', clear
    ? 'background: transparent;\nborder: 0;\nbox-shadow: none;\nbackdrop-filter: none;'
    : cloudFrame
      ? `background: linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02)) padding-box, linear-gradient(135deg, color-mix(in srgb, ${spec.accent} 24%, transparent), color-mix(in srgb, ${spec.text} 12%, transparent) 56%, color-mix(in srgb, ${spec.accent} 18%, transparent)) border-box;\nborder: 1.5px dotted transparent;\ncolor: ${spec.text};\nbox-shadow: 0 8px 18px color-mix(in srgb, ${spec.accent} 10%, transparent), inset 0 1px 0 rgba(255,255,255,0.14);`
      : woodRaised
        ? `background: color-mix(in srgb, ${spec.fill} 82%, rgba(255,255,255,0.05));\nborder: 0;\ncolor: ${spec.text};\nbox-shadow: inset 0 1px 0 rgba(255,255,255,0.12);`
        : `background: color-mix(in srgb, ${spec.fill} 42%, transparent);\nborder-color: color-mix(in srgb, ${spec.accent} 16%, transparent);\ncolor: ${spec.text};\nbox-shadow: inset 0 1px 0 rgba(255,255,255,0.08);`);
  const previewBannerRule = cssBlock('app-preview-banner', clear
    ? 'background: transparent;\nborder: 0;\nbox-shadow: none;\nbackdrop-filter: none;'
    : woodRaised
      ? `background: color-mix(in srgb, ${spec.fill} 78%, rgba(255,255,255,0.04));\nborder: 0;\nbox-shadow: none;\ncolor: ${spec.muted};\nbackdrop-filter: blur(${spec.blur}) saturate(1.01);`
      : `background: color-mix(in srgb, ${spec.fill} 48%, transparent);\nborder-color: color-mix(in srgb, ${spec.accent} 18%, transparent);\nbox-shadow: none;\ncolor: ${spec.muted};\nbackdrop-filter: blur(${spec.blur}) saturate(1.02);`);
  const postureRules = [
    cssBlock('.topbar .topbar-main', `gap: ${topbarGap};`),
    cssBlock('.topbar .topbar-actions', `gap: ${actionGap};`),
    cssBlock('.topbar .brand-trigger', `${woodRaised ? 'background: transparent;\nborder: 0;\nbox-shadow: none;\nbackdrop-filter: none;' : ''}\npadding-top: ${brandPadY};\npadding-bottom: ${brandPadY};`),
    cssBlock('.topbar .brand h1', `letter-spacing: ${brandTracking};`),
    cssBlock('.topbar .brand p', `letter-spacing: ${metaTracking};`),
    cssBlock('.topbar .preview-banner-trigger', `gap: ${bannerGap};`),
    cssBlock('.topbar .action-btn', `height: ${buttonHeight};\nborder-radius: ${buttonRadius};`),
    cssBlock('.topbar .icon-btn', `width: ${buttonHeight};`),
    cssBlock('.topbar .theme-menu-btn', 'width: 40px;\nheight: 40px;\nborder-radius: 12px;'),
    cssBlock('.topbar .drawer-trigger-label', `letter-spacing: ${`${(0.004 + energetic * 0.018 + airy * 0.006).toFixed(3)}em`};`),
    ...(woodRaised
      ? [
          cssBlock('.topbar .action-btn:hover, .topbar .action-btn:focus-visible, .topbar .brand-trigger:hover, .topbar .brand-trigger:focus-visible', 'transform: none;\nbox-shadow: inset 0 1px 0 rgba(255,255,255,0.12);')
        ]
      : [])
  ];
  return [topbarRule, buttonRule, previewBannerRule, ...postureRules].filter(Boolean).join('\n');
}

export function buildTopbarBaseRule(preview: ThemeCoordinatePreview, scope: ThemeToolScope) {
  const spec = preview.surfaceSpecs.topbar;
  const clear = preview.surfaceTraits.topbar === 'topbar-clear';
  const woodRaised = isPrototypeFamily(preview, 'grain-wood');
  return cssBlock(
    scope === 'chat' ? 'chat-topbar' : 'app-topbar',
    clear
      ? 'background: transparent;\nborder: 0;\nbox-shadow: none;\nbackdrop-filter: none;'
      : woodRaised
        ? `background: color-mix(in srgb, ${spec.fill} 92%, rgba(255,255,255,0.04));\nborder: 0;\nbox-shadow: none;\nbackdrop-filter: blur(${spec.blur}) saturate(1.01);\ncolor: ${spec.text};`
        : `background: ${spec.fill} padding-box, ${spec.borderPaint} border-box;\nborder: ${spec.borderWidth} ${spec.borderStyle} transparent;\nbox-shadow: none;\nbackdrop-filter: blur(${spec.blur}) saturate(1.02);\ncolor: ${spec.text};`
  );
}

function buildSurfaceLayeredFill(args: {
  fill: string;
  accent: string;
  text: string;
  borderPaint: string;
  surface: 'assistant-bubble' | 'user-bubble' | 'system-note' | 'composer' | 'panel';
  includeBorder?: boolean;
}) {
  const { fill, accent, text, borderPaint, surface, includeBorder = true } = args;
  const overlays =
    surface === 'assistant-bubble'
      ? [
          `radial-gradient(circle at 18% 18%, color-mix(in srgb, ${accent} 14%, transparent), transparent 48%)`,
          `linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015) 34%, transparent 78%)`
        ]
      : surface === 'user-bubble'
        ? [
            `radial-gradient(circle at 82% 18%, color-mix(in srgb, ${accent} 16%, transparent), transparent 44%)`,
            `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 32%, transparent 76%)`
          ]
        : surface === 'system-note'
          ? [
              `linear-gradient(90deg, color-mix(in srgb, ${accent} 12%, transparent), transparent 42%)`,
              `linear-gradient(180deg, rgba(255,255,255,0.055), transparent 74%)`
            ]
          : surface === 'composer'
            ? [
                `radial-gradient(circle at 16% 18%, color-mix(in srgb, ${accent} 11%, transparent), transparent 46%)`,
                `linear-gradient(115deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 28%, transparent 62%)`
              ]
            : [
                `radial-gradient(circle at top left, color-mix(in srgb, ${accent} 11%, transparent), transparent 42%)`,
                `radial-gradient(circle at bottom right, color-mix(in srgb, ${text} 5%, transparent), transparent 48%)`,
                `linear-gradient(180deg, rgba(255,255,255,0.06), transparent 72%)`
              ];

  return includeBorder
    ? `${overlays.join(', ')}, ${fill} padding-box, ${borderPaint} border-box`
    : `${overlays.join(', ')}, ${fill}`;
}

function bubbleRadius(spec: ThemeCoordinatePreview['surfaceSpecs']['chat-user-bubble'], trait?: string, side: 'user' | 'assistant' = 'user') {
  switch (trait) {
    case 'bubble-cloud': return '26px';
    case 'bubble-bare': return '0px';
    case 'bubble-recessed': return spec.radius;
    case 'bubble-pill': return '999px';
    case 'bubble-round-left': return side === 'user' ? `${spec.radius} 12px 12px ${spec.radius}` : `${spec.radius} ${spec.radius} ${spec.radius} 12px`;
    case 'bubble-soft-asym': return side === 'user' ? `${spec.radius} calc(${spec.radius} * 0.82) 16px ${spec.radius}` : `${spec.radius} ${spec.radius} ${spec.radius} 16px`;
    default: return side === 'user' ? `${spec.radius} ${spec.radius} 8px ${spec.radius}` : `${spec.radius} ${spec.radius} ${spec.radius} 10px`;
  }
}

export function buildBubbleRule(selector: 'chat-bubble-user' | 'chat-bubble-assistant', spec: ThemeCoordinatePreview['surfaceSpecs']['chat-user-bubble'], trait?: string) {
  const isUser = selector === 'chat-bubble-user';
  const cloud = trait === 'bubble-cloud';
  const bare = trait === 'bubble-bare';
  const recessed = trait === 'bubble-recessed';
  const outline = trait === 'bubble-outline';
  const leftRail = trait === 'bubble-left-rail';
  const floating = trait === 'bubble-floating';
  const borderless = spec.borderWidth === '0px';
  const shadow = [
    leftRail ? `inset 3px 0 0 color-mix(in srgb, ${spec.accent} 26%, transparent)` : '',
    recessed
      ? `inset 0 1px 0 color-mix(in srgb, ${spec.text} 10%, transparent), inset 0 -1px 0 color-mix(in srgb, ${spec.accent} 12%, transparent), inset 0 12px 18px color-mix(in srgb, ${spec.text} 4%, transparent)`
      : '',
    cloud
      ? `0 10px 26px color-mix(in srgb, ${spec.accent} 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.22)`
      : '',
    floating ? `0 18px 36px color-mix(in srgb, ${spec.accent} 18%, transparent), ${spec.shadow}` : spec.shadow
  ].filter(Boolean).join(', ');
  const layeredFill = buildSurfaceLayeredFill({
    fill: spec.fill,
    accent: spec.accent,
    text: spec.text,
    borderPaint: spec.borderPaint,
    surface: isUser ? 'user-bubble' : 'assistant-bubble'
  });
  return cssBlock(selector, [
    `background: ${bare
      ? 'transparent'
      : cloud
        ? `linear-gradient(180deg, color-mix(in srgb, ${spec.text} 2%, transparent), rgba(255,255,255,0.01)), ${buildSurfaceLayeredFill({ fill: spec.fill, accent: spec.accent, text: spec.text, borderPaint: spec.borderPaint, surface: isUser ? 'user-bubble' : 'assistant-bubble', includeBorder: false })} padding-box, linear-gradient(135deg, color-mix(in srgb, ${spec.accent} 32%, transparent), color-mix(in srgb, ${spec.text} 16%, transparent) 52%, color-mix(in srgb, ${spec.accent} 22%, transparent)) border-box`
      : recessed
        ? spec.borderWidth === '0px'
          ? `${buildSurfaceLayeredFill({ fill: spec.fill, accent: spec.accent, text: spec.text, borderPaint: spec.borderPaint, surface: isUser ? 'user-bubble' : 'assistant-bubble', includeBorder: false })}`
          : `linear-gradient(180deg, color-mix(in srgb, ${spec.text} 3%, transparent), color-mix(in srgb, ${spec.accent} 6%, transparent)), ${layeredFill}`
        : outline
          ? `linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)) padding-box, ${spec.borderPaint} border-box`
          : leftRail
            ? `linear-gradient(90deg, color-mix(in srgb, ${spec.accent} 16%, transparent), transparent 34%), ${layeredFill}`
            : `${layeredFill}`};`,
    `border: ${bare || borderless ? '0' : cloud ? '1.6px dotted transparent' : `${spec.borderWidth} ${spec.borderStyle} transparent`};`,
    `border-radius: ${bubbleRadius(spec, trait, isUser ? 'user' : 'assistant')};`,
    `box-shadow: ${bare ? 'none' : shadow};`,
    `backdrop-filter: ${bare ? 'none' : `blur(${spec.blur})`};`,
    `color: ${spec.text};`,
    `padding: ${bare ? '0' : spec.padding};`,
    `letter-spacing: ${spec.letterSpacing};`,
    `line-height: ${spec.lineHeight};`,
    floating ? 'transform: translateY(-2px);' : ''
  ].filter(Boolean).join('\n'));
}

export function buildBubbleBorderRule(selector: 'chat-bubble-user' | 'chat-bubble-assistant', spec: ThemeCoordinatePreview['surfaceSpecs']['chat-user-bubble'], trait?: string) {
  const isUser = selector === 'chat-bubble-user';
  return cssBlock(selector, [
    `border: ${trait === 'bubble-bare' ? '0' : trait === 'bubble-cloud' ? '1.6px dotted transparent' : `${spec.borderWidth} ${spec.borderStyle} transparent`};`,
    `border-radius: ${bubbleRadius(spec, trait, isUser ? 'user' : 'assistant')};`
  ].filter(Boolean).join('\n'));
}

export function buildSystemNoteRule(preview: ThemeCoordinatePreview) {
  const spec = preview.surfaceSpecs['system-note'];
  return cssBlock('chat-system-note', [
    `background: ${buildSurfaceLayeredFill({ fill: spec.fill, accent: spec.accent, text: spec.text, borderPaint: spec.borderPaint, surface: 'system-note' })};`,
    `border: ${spec.borderWidth} ${spec.borderStyle} transparent;`,
    `border-radius: ${spec.radius};`,
    `box-shadow: ${spec.shadow};`,
    `backdrop-filter: blur(${spec.blur});`,
    `color: ${spec.muted};`,
    `padding: ${spec.padding};`,
    `letter-spacing: ${spec.letterSpacing};`,
    `line-height: ${spec.lineHeight};`
  ].join('\n'));
}

export function buildComposerRules(preview: ThemeCoordinatePreview) {
  const spec = preview.surfaceSpecs.composer;
  const trait = preview.surfaceTraits.composer;
  const cloud = trait === 'composer-cloud';
  const woodRaised = isPrototypeFamily(preview, 'grain-wood');
  const airy = Math.max(0, (-preview.state.meaning + 10) / 20);
  const energetic = Math.max(0, (preview.state.emotion + 10) / 20);
  const chatBoxGap = `${Math.round(lerp(9, 14, airy * 0.48 + energetic * 0.22))}px`;
  const quickGap = `${Math.round(lerp(7, 11, airy * 0.4 + energetic * 0.16))}px`;
  const composerRule = cssBlock('chat-composer', [
    `background: ${woodRaised ? `${spec.fill} padding-box, ${spec.borderPaint} border-box` : buildSurfaceLayeredFill({ fill: spec.fill, accent: spec.accent, text: spec.text, borderPaint: spec.borderPaint, surface: 'composer' })};`,
    `border: ${spec.borderWidth} ${spec.borderStyle} transparent;`,
    `border-radius: ${trait === 'composer-pill' ? '999px' : spec.radius};`,
    `box-shadow: ${spec.shadow};`,
    `backdrop-filter: blur(${spec.blur}) saturate(1.03);`,
    `color: ${spec.text};`,
    `padding: calc(${spec.padding} * 0.68) ${spec.padding};`,
    `gap: ${chatBoxGap};`
  ].join('\n'));
  const inputRule = cssBlock('chat-composer textarea', `color: ${spec.text};\nletter-spacing: ${spec.letterSpacing};\nline-height: ${spec.lineHeight};`);
  const placeholderRule = cssBlock('chat-composer textarea::placeholder', `color: ${spec.muted};`);
  const buttonRule = cssBlock('chat-send-button', [
    `background: ${cloud
      ? `linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02)) padding-box, linear-gradient(135deg, color-mix(in srgb, ${spec.accent} 30%, transparent), color-mix(in srgb, ${spec.text} 14%, transparent) 54%, color-mix(in srgb, ${spec.accent} 18%, transparent)) border-box`
      : woodRaised
        ? `color-mix(in srgb, ${spec.fill} 84%, rgba(255,255,255,0.05))`
        : `color-mix(in srgb, ${spec.accent} 28%, transparent)`};`,
    `border: ${cloud ? '1.5px dotted transparent' : woodRaised ? '0' : `1px solid color-mix(in srgb, ${spec.accent} 26%, transparent)`};`,
    `color: ${spec.text};`,
    `box-shadow: ${cloud
      ? `0 10px 24px color-mix(in srgb, ${spec.accent} 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.16)`
      : woodRaised
        ? `inset 0 1px 0 rgba(255,255,255,0.14)`
        : `0 10px 20px color-mix(in srgb, ${spec.accent} 12%, transparent)`};`,
    'width: 40px;',
    'height: 40px;',
    `border-radius: ${cloud ? '16px' : '15px'};`
  ].join('\n'));
  const quickActionRule = cssBlock('.chat-composer .composer-quick-actions', `gap: ${quickGap};`);
  const slotRule = cssBlock('.chat-composer .composer-slot-btn', [
    'width: 34px;',
    'height: 34px;',
    `border-radius: ${cloud ? '14px' : '12px'};`,
    ...(cloud
      ? [
          `background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02)) padding-box, linear-gradient(135deg, color-mix(in srgb, ${spec.accent} 24%, transparent), color-mix(in srgb, ${spec.text} 12%, transparent) 56%, color-mix(in srgb, ${spec.accent} 18%, transparent)) border-box;`,
          'border: 1.5px dotted transparent;',
          `box-shadow: 0 8px 20px color-mix(in srgb, ${spec.accent} 8%, transparent), inset 0 1px 0 rgba(255,255,255,0.14);`
        ]
      : woodRaised
        ? [
            `background: color-mix(in srgb, ${spec.fill} 84%, rgba(255,255,255,0.05));`,
            'border: 0;',
            `box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);`
          ]
        : [])
  ].join('\n'));
  return [composerRule, inputRule, placeholderRule, buttonRule, quickActionRule, slotRule].filter(Boolean).join('\n');
}

export function buildPanelRules(preview: ThemeCoordinatePreview, scope: ThemeToolScope) {
  const spec = preview.surfaceSpecs.panel;
  const declarations = [
    `background: ${buildSurfaceLayeredFill({ fill: spec.fill, accent: spec.accent, text: spec.text, borderPaint: spec.borderPaint, surface: 'panel' })};`,
    `border: ${spec.borderWidth} ${spec.borderStyle} transparent;`,
    `border-radius: ${spec.radius};`,
    `box-shadow: ${spec.shadow};`,
    `backdrop-filter: blur(${spec.blur});`,
    `color: ${spec.text};`,
    `letter-spacing: ${spec.letterSpacing};`,
    `line-height: ${spec.lineHeight};`
  ].join('\n');
  const rules = [cssBlock('chat-thinking-box', declarations)];
  if (scope !== 'chat') {
    rules.push(cssBlock('app-sheet', declarations));
    rules.push(cssBlock('app-provider-sheet', declarations));
    rules.push(cssBlock('app-theme-studio', declarations));
    rules.push(cssBlock('collection-search', declarations));
  }
  return rules.filter(Boolean).join('\n');
}
