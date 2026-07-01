import type { ThemeToolScope, World } from '../../types/domain';
import {
  THEME_COORDINATE_SURFACE_AI_LABEL,
  THEME_COORDINATE_SURFACE_CODE,
  type ThemeCoordinateSurface
} from './themeCoordinateSurfaceMeta';

type StructureRegion = {
  surface: ThemeCoordinateSurface;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
};

type StructurePhone = {
  title: string;
  tone: 'chat' | 'collection';
  x: number;
  y: number;
  active: boolean;
  regions: StructureRegion[];
};

const CHAT_REGIONS: StructureRegion[] = [
  { surface: 'background', x: 24, y: 24, width: 292, height: 496, radius: 34 },
  { surface: 'topbar', x: 24, y: 24, width: 292, height: 88, radius: 34 },
  { surface: 'system-note', x: 48, y: 116, width: 220, height: 30, radius: 15 },
  { surface: 'chat-ai-bubble', x: 44, y: 158, width: 180, height: 90, radius: 22 },
  { surface: 'chat-user-bubble', x: 124, y: 266, width: 152, height: 58, radius: 22 },
  { surface: 'panel', x: 44, y: 348, width: 220, height: 82, radius: 22 },
  { surface: 'composer', x: 42, y: 454, width: 236, height: 38, radius: 19 }
];

const COLLECTION_REGIONS: StructureRegion[] = [
  { surface: 'background', x: 24, y: 24, width: 292, height: 496, radius: 34 },
  { surface: 'topbar', x: 24, y: 24, width: 292, height: 88, radius: 34 },
  { surface: 'panel', x: 44, y: 116, width: 220, height: 44, radius: 18 },
  { surface: 'card', x: 44, y: 184, width: 220, height: 230, radius: 24 }
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function structurePhones(args: {
  activeWorld?: World;
  scopeHint?: ThemeToolScope;
}) {
  const preferCollection = args.scopeHint === 'collection' || args.activeWorld === 'collection';
  const preferChat = args.scopeHint === 'chat' || args.activeWorld === 'chat';

  return [
    {
      title: 'Chat Map',
      tone: 'chat' as const,
      x: 28,
      y: 86,
      active: preferChat || (!preferCollection && !preferChat),
      regions: CHAT_REGIONS
    },
    {
      title: 'Collection Map',
      tone: 'collection' as const,
      x: 372,
      y: 86,
      active: preferCollection,
      regions: COLLECTION_REGIONS
    }
  ] satisfies StructurePhone[];
}

function renderRegion(region: StructureRegion) {
  const code = THEME_COORDINATE_SURFACE_CODE[region.surface];
  const label = THEME_COORDINATE_SURFACE_AI_LABEL[region.surface];
  const badgeX = region.x + 10;
  const badgeY = region.y + 10;
  const nameX = region.x + 10;
  const nameY = region.y + region.height - 12;

  return [
    `<rect x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}" rx="${region.radius ?? 18}" fill="rgba(255,255,255,0.06)" stroke="rgba(159,178,255,0.88)" stroke-width="1.5" stroke-dasharray="${region.surface === 'background' ? '0' : '4 4'}"/>`,
    `<rect x="${badgeX}" y="${badgeY}" width="30" height="20" rx="10" fill="#121829" opacity="0.92"/>`,
    `<text x="${badgeX + 15}" y="${badgeY + 14}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" font-weight="700" fill="#f6f8ff">${escapeXml(code)}</text>`,
    `<text x="${nameX}" y="${nameY}" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11.5" font-weight="600" fill="#d9e5ff">${escapeXml(label)}</text>`
  ].join('');
}

function renderPhone(phone: StructurePhone) {
  const headerFill = phone.active ? 'rgba(145,171,255,0.14)' : 'rgba(255,255,255,0.04)';
  const shellStroke = phone.active ? 'rgba(145,171,255,0.72)' : 'rgba(255,255,255,0.16)';

  return [
    `<g transform="translate(${phone.x}, ${phone.y})">`,
    `<text x="18" y="0" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="18" font-weight="700" fill="#f6f8ff">${escapeXml(phone.title)}</text>`,
    `<text x="18" y="20" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11.5" fill="rgba(235,241,255,0.72)">${phone.active ? 'current focus' : 'alternate world'}</text>`,
    `<rect x="0" y="28" width="340" height="544" rx="44" fill="rgba(7,11,24,0.84)" stroke="${shellStroke}" stroke-width="2"/>`,
    `<rect x="24" y="52" width="292" height="496" rx="34" fill="rgba(17,24,41,0.82)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`,
    `<rect x="24" y="52" width="292" height="88" rx="34" fill="${headerFill}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`,
    ...phone.regions.map((region) => renderRegion(region)),
    `</g>`
  ].join('');
}

export function buildThemeCoordinateStructureMapDataUrl(args?: {
  activeWorld?: World;
  scopeHint?: ThemeToolScope;
}) {
  const phones = structurePhones(args ?? {});
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="680" viewBox="0 0 720 680" fill="none">`,
    `<rect width="720" height="680" rx="36" fill="#060916"/>`,
    `<rect x="24" y="24" width="672" height="632" rx="28" fill="url(#bg)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>`,
    `<text x="42" y="52" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="22" font-weight="800" fill="#ffffff">Polaris Stable Theme Structure Map</text>`,
    `<text x="42" y="76" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12.5" fill="rgba(235,241,255,0.76)">Use the numbered regions when referencing theme surfaces. Prefer these codes over inventing new area names.</text>`,
    ...phones.map((phone) => renderPhone(phone)),
    `<defs>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="720" y2="680" gradientUnits="userSpaceOnUse">`,
    `<stop stop-color="#0B1024"/>`,
    `<stop offset="0.56" stop-color="#131B32"/>`,
    `<stop offset="1" stop-color="#0A0E1B"/>`,
    `</linearGradient>`,
    `</defs>`,
    `</svg>`
  ].join('');

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function buildThemeCoordinateStructureMapPromptText(args?: {
  activeWorld?: World;
  scopeHint?: ThemeToolScope;
}) {
  const focus =
    args?.scopeHint === 'collection' || args?.activeWorld === 'collection'
      ? '当前更值得先看右侧 Collection Map。'
      : '当前更值得先看左侧 Chat Map。';
  return [
    '系统附加了一张 Polaris 编号结构图，这不是用户上传图片。',
    '引用主题表面时，直接引用图上的 01 到 08，不要混用 surface 名、中文名、英文名或自己发明的新叫法。',
    focus
  ].join(' ');
}
