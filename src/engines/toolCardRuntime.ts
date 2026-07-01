import { normalizeCodeLanguage } from './codeCardLanguage';
import type { CodeCard } from '../types/domain';

const TOOL_CARD_NAME_PREFIX = 'cardTool_';

export type ToolCardInvocationPayload = {
  input?: string;
  args?: Record<string, unknown>;
  targetLabel?: string;
};

export type ToolCardExecutionEnvelope = {
  __polarisTool: true;
  result: unknown;
  resultProvided: boolean;
  roomState: Record<string, unknown>;
};

function normalizeToolNameFragment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function isToolCodeCard(card: Pick<CodeCard, 'kind'>) {
  return card.kind === 'tool';
}

export function isRunnableToolCodeCard(card: Pick<CodeCard, 'kind' | 'language'>) {
  return isToolCodeCard(card) && normalizeCodeLanguage(card.language) === 'javascript';
}

export function buildToolCardFunctionName(card: Pick<CodeCard, 'id' | 'title'>) {
  const titleFragment = normalizeToolNameFragment(card.title).slice(0, 28);
  const idFragment = normalizeToolNameFragment(card.id).slice(-12) || 'card';
  const base = titleFragment
    ? `${TOOL_CARD_NAME_PREFIX}${titleFragment}_${idFragment}`
    : `${TOOL_CARD_NAME_PREFIX}${idFragment}`;
  return base.slice(0, 64);
}

export function resolveToolCardFunctionNames(cards: CodeCard[]) {
  return cards
    .filter((card) => isRunnableToolCodeCard(card))
    .map((card) => buildToolCardFunctionName(card));
}

export function buildToolCardExecutionCode(args: {
  card: Pick<CodeCard, 'id' | 'title' | 'language' | 'cardNote' | 'tags' | 'code'>;
  payload?: ToolCardInvocationPayload;
  roomState?: Record<string, unknown>;
}) {
  const { card, payload, roomState } = args;
  const toolCardLiteral = JSON.stringify({
    id: card.id,
    title: card.title,
    language: normalizeCodeLanguage(card.language),
    cardNote: card.cardNote,
    tags: card.tags
  });
  const payloadLiteral = JSON.stringify({
    input: payload?.input,
    args: normalizeObject(payload?.args),
    targetLabel: payload?.targetLabel
  });
  const roomStateLiteral = JSON.stringify(normalizeObject(roomState));

  return `
const __polarisToolCard = ${toolCardLiteral};
const __polarisToolPayload = ${payloadLiteral};
function __polarisToolClone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch (_error) {
    return {};
  }
}
function __polarisToolNormalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return __polarisToolClone(value);
}
let __polarisToolRoomState = __polarisToolNormalizeObject(${roomStateLiteral});
const PolarisRoom = {
  id: __polarisToolCard.id,
  getState() {
    return __polarisToolClone(__polarisToolRoomState);
  },
  setState(nextState) {
    __polarisToolRoomState = __polarisToolNormalizeObject(nextState);
    return this.getState();
  },
  patchState(patch) {
    __polarisToolRoomState = {
      ...__polarisToolRoomState,
      ...__polarisToolNormalizeObject(patch)
    };
    return this.getState();
  },
  save() {
    return this.getState();
  },
  whenReady() {
    return Promise.resolve(this.getState());
  }
};
const PolarisTool = Object.freeze({
  input: typeof __polarisToolPayload.input === 'string' ? __polarisToolPayload.input : '',
  args: __polarisToolNormalizeObject(__polarisToolPayload.args),
  targetLabel:
    typeof __polarisToolPayload.targetLabel === 'string'
      ? __polarisToolPayload.targetLabel
      : undefined,
  card: __polarisToolCard,
  getState: () => PolarisRoom.getState(),
  setState: (nextState) => PolarisRoom.setState(nextState),
  patchState: (patch) => PolarisRoom.patchState(patch),
  whenReady: () => PolarisRoom.whenReady()
});
window.PolarisTool = PolarisTool;
window.PolarisRoom = PolarisRoom;
const __polarisToolResult = await (async () => {
${card.code}
})();
return JSON.stringify({
  __polarisTool: true,
  result: __polarisToolResult === undefined ? null : __polarisToolResult,
  resultProvided: __polarisToolResult !== undefined,
  roomState: PolarisRoom.getState()
});
`.trim();
}

export function parseToolCardExecutionEnvelope(returnValue: string | undefined): ToolCardExecutionEnvelope | null {
  if (!returnValue?.trim()) return null;

  try {
    const parsed = JSON.parse(returnValue) as Partial<ToolCardExecutionEnvelope> | null;
    if (!parsed || parsed.__polarisTool !== true) return null;
    return {
      __polarisTool: true,
      result: parsed.result,
      resultProvided: parsed.resultProvided === true,
      roomState: normalizeObject(parsed.roomState)
    };
  } catch {
    return null;
  }
}
