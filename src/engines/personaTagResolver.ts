import { createEmptyPersonaTags, flattenPersonaTags, normalizePersonaTags } from '../config/persona/personaTags';
import type {
  Persona,
  PersonaActionId,
  PersonaEmotionId,
  PersonaStackId,
  PersonaStabilityId,
  PersonaTagSelection,
  PersonaTemperamentId,
  PersonaWritingStyleId
} from '../types/domain';
import type {
  CognitiveAbstraction,
  CognitiveClosure,
  CoreResponseGate,
  RelationshipConflict,
  RelationshipDistance,
  RelationshipInitiative,
  RelationshipSoothing,
  RelationshipStance,
  StyleDensity,
  StyleImagery,
  StyleLength,
  StylePunctuation,
  StyleSoftness
} from '../types/personaCompiler';

type LegacyFlavorSeed = Partial<{
  stacks: PersonaStackId[];
  temperament: PersonaTemperamentId;
  emotionMode: PersonaEmotionId;
  relationAction: PersonaActionId;
  selfRegulation: PersonaStabilityId;
  writingStyle: PersonaWritingStyleId;
}>;

export type PersonaCompilerFlavorBridge = {
  distance: RelationshipDistance;
  initiative: RelationshipInitiative;
  soothing: RelationshipSoothing;
  conflict: RelationshipConflict;
  stance: RelationshipStance;
  responseGate: CoreResponseGate;
  abstraction: CognitiveAbstraction;
  closure: CognitiveClosure;
  density: StyleDensity;
  softness: StyleSoftness;
  imagery: StyleImagery;
  punctuation: StylePunctuation;
  length: StyleLength;
  styleCanonId: string;
  tags: PersonaTagSelection;
};

export function migrateLegacyPersonaTags(input: LegacyFlavorSeed): PersonaTagSelection {
  const tags = createEmptyPersonaTags();

  for (const tagId of input.stacks ?? []) addTag(tags, STACK_TO_TAGS[tagId] ?? []);
  if (input.temperament) addTag(tags, TEMPERAMENT_TO_TAGS[input.temperament] ?? []);
  if (input.emotionMode) addTag(tags, EMOTION_TO_TAGS[input.emotionMode] ?? []);
  if (input.relationAction) addTag(tags, ACTION_MODE_TO_TAGS[input.relationAction] ?? []);
  if (input.selfRegulation) addTag(tags, STABILITY_TO_TAGS[input.selfRegulation] ?? []);
  if (input.writingStyle) addTag(tags, WRITING_STYLE_TO_TAGS[input.writingStyle] ?? []);

  return tags;
}

export function resolvePersonaTags(persona: Pick<Persona, 'tags'> & LegacyFlavorSeed): PersonaTagSelection {
  const normalized = normalizePersonaTags(persona.tags);
  if (flattenPersonaTags(normalized).length > 0) return normalized;
  return migrateLegacyPersonaTags(persona);
}

export function resolvePersonaCompilerFlavor(persona: Pick<
  Persona,
  'relationship' | 'expression' | 'initiative' | 'silence' | 'disagreement' | 'attachment' | 'humor' | 'baseId' | 'tags'
> &
  LegacyFlavorSeed): PersonaCompilerFlavorBridge {
  const tags = resolvePersonaTags(persona);
  const has = (tagId: string) => hasTag(tags, tagId);

  const distance = vote<RelationshipDistance>(
    ['clingy', 'close', 'balanced', 'spacious'],
    ({ add }) => {
      add('balanced', 1);

      if (persona.relationship === 'assistant') add('spacious', 3);
      if (persona.relationship === 'companion') add('close', 2);
      if (persona.expression === 'reserved') add('spacious', 2);
      if (persona.expression === 'intimate') add('close', 2);
      if (persona.expression === 'unbounded') add('clingy', 1);
      if (persona.attachment === 'physical') add('clingy', 2);
      if (persona.attachment === 'protective') add('close', 1);
      if (has('clingy')) add('clingy', 3);
      if (has('protective') || has('considerate') || has('partial')) add('close', 1);
      if (has('boundaried') || has('distant') || has('cool')) add('spacious', 2);
      if (has('equal') || has('steady')) add('balanced', 1);
    }
  );

  const initiative = vote<RelationshipInitiative>(
    ['responsive', 'balanced', 'leading'],
    ({ add }) => {
      add('balanced', 1);
      if (persona.initiative === 'reactive') add('responsive', 3);
      if (persona.initiative === 'proactive') add('leading', 2);
      if (persona.initiative === 'assertive') add('leading', 3);
      if (has('dominant') || has('guiding') || has('push') || has('ignite')) add('leading', 2);
      if (has('watch') || has('receive') || has('accompany') || has('boundaried')) add('responsive', 1);
    }
  );

  const soothing = vote<RelationshipSoothing>(
    ['verbal', 'practical', 'quiet', 'structured'],
    ({ add }) => {
      add('quiet', 1);
      if (persona.attachment === 'verbal') add('verbal', 3);
      if (persona.attachment === 'acts') add('practical', 3);
      if (persona.attachment === 'presence' || persona.attachment === 'physical') add('quiet', 2);
      if (has('soothe') || has('considerate') || has('gentle')) add('verbal', 2);
      if (has('receive') || has('watch') || has('soft')) add('quiet', 1);
      if (has('guiding') || has('rational') || has('gather') || has('correct')) add('structured', 2);
      if (has('reliable')) add('practical', 1);
    }
  );

  const conflict = vote<RelationshipConflict>(
    ['direct', 'gentle', 'detoured', 'deferred'],
    ({ add }) => {
      add('gentle', 1);
      if (persona.disagreement === 'confrontational') add('direct', 3);
      if (persona.disagreement === 'honest') add('gentle', 2);
      if (persona.disagreement === 'soft_nudge') add('detoured', 2);
      if (persona.disagreement === 'defer') add('deferred', 3);
      if (has('venomous') || has('sharp') || has('biting') || has('direct') || has('pierce') || has('correct')) add('direct', 2);
      if (has('gentle') || has('soft') || has('soothe')) add('gentle', 1);
      if (has('subtle') || has('restrained') || has('test')) add('detoured', 1);
      if (has('watch')) add('deferred', 1);
      if (has('boundaried') || has('strict')) add('direct', 1);
    }
  );

  const stance = vote<RelationshipStance>(
    ['guarding', 'parallel', 'guiding', 'following'],
    ({ add }) => {
      add('parallel', 1);
      if (persona.relationship === 'assistant') add('guiding', 3);
      if (persona.relationship === 'roleplay') add('following', 3);
      if (persona.relationship === 'companion') add('guarding', 2);
      if (persona.attachment === 'protective' || has('protective')) add('guarding', 2);
      if (has('guiding') || has('push')) add('guiding', 2);
      if (has('equal')) add('parallel', 2);
    }
  );

  const responseGate = vote<CoreResponseGate>(
    ['feeling-first', 'structure-first'],
    ({ add }) => {
      add('feeling-first', 1);
      if (has('rational') || has('rational_thinking') || has('realistic') || has('strict') || has('pierce') || has('gather')) add('structure-first', 2);
      if (has('emotional') || has('gentle') || has('soft') || has('soothe') || has('accompany') || has('receive')) add('feeling-first', 2);
      if (has('steady') || has('reliable')) add('structure-first', 1);
    }
  );

  const abstraction = vote<CognitiveAbstraction>(
    ['abstract', 'concrete'],
    ({ add }) => {
      if (persona.baseId === 'living') add('abstract', 2);
      add('concrete', 1);
      if (has('poetic') || has('romantic') || has('gloomy') || has('intuitive') || has('fated')) add('abstract', 2);
      if (has('rational') || has('rational_thinking') || has('realistic') || has('strict') || has('direct')) add('concrete', 2);
    }
  );

  const closure = vote<CognitiveClosure>(
    ['open', 'structured'],
    ({ add }) => {
      add('structured', 1);
      if (has('subtle') || has('playful') || has('poetic') || has('intuitive') || has('test')) add('open', 2);
      if (has('direct') || has('serious') || has('rational') || has('rational_thinking') || has('gather') || has('push')) add('structured', 2);
    }
  );

  const density = vote<StyleDensity>(
    ['airy', 'balanced', 'dense'],
    ({ add }) => {
      add('balanced', 1);
      if (has('talkative') || has('poetic') || has('soft') || has('gloomy') || has('romantic')) add('dense', 2);
      if (has('direct') || has('taciturn') || has('venomous') || has('light')) add('airy', 2);
      if (has('steady') || has('serious') || has('rational')) add('balanced', 1);
    }
  );

  const softness = vote<StyleSoftness>(
    ['soft', 'clean', 'sharp'],
    ({ add }) => {
      add('clean', 1);
      if (has('gentle') || has('soft') || has('considerate') || has('soothe')) add('soft', 2);
      if (has('sharp') || has('venomous') || has('biting') || has('provocative') || has('dominant')) add('sharp', 2);
      if (has('steady') || has('rational') || has('boundaried')) add('clean', 1);
    }
  );

  const imagery = vote<StyleImagery>(
    ['plain', 'light', 'rich'],
    ({ add }) => {
      add('light', 1);
      if (has('poetic') || has('romantic') || has('gloomy') || has('dramatic') || has('intuitive')) add('rich', 2);
      if (has('rational') || has('rational_thinking') || has('strict') || has('direct') || has('realistic')) add('plain', 2);
      if (has('light') || has('bright') || has('playful')) add('light', 1);
    }
  );

  const punctuation = vote<StylePunctuation>(
    ['light', 'balanced', 'marked'],
    ({ add }) => {
      add('balanced', 1);
      if (persona.expression === 'intimate') add('marked', 1);
      if (has('light') || has('calm') || has('steady') || has('restrained') || has('boundaried') || has('strict')) add('light', 2);
      if (has('playful') || has('bright') || has('dramatic') || has('clingy') || has('ignite')) add('marked', 2);
    }
  );

  const length = vote<StyleLength>(
    ['short', 'mixed', 'long'],
    ({ add }) => {
      add('mixed', 1);
      if (has('talkative') || has('poetic') || has('soft') || has('accompany') || has('question')) add('long', 2);
      if (has('taciturn') || has('direct') || has('pierce') || has('steady') || has('gather')) add('short', 2);
    }
  );

  return {
    distance,
    initiative,
    soothing,
    conflict,
    stance,
    responseGate,
    abstraction,
    closure,
    density,
    softness,
    imagery,
    punctuation,
    length,
    styleCanonId: resolveStyleCanonId({
      baseId: persona.baseId,
      humor: persona.humor,
      softness,
      density,
      imagery,
      length,
      punctuation,
      tags
    }),
    tags
  };
}

function hasTag(tags: PersonaTagSelection, tagId: string) {
  return flattenPersonaTags(tags).includes(tagId);
}

function addTag(tags: PersonaTagSelection, entries: Array<{ group: keyof PersonaTagSelection; id: string }>) {
  for (const entry of entries) {
    if (!tags[entry.group].includes(entry.id)) tags[entry.group].push(entry.id);
  }
}

function vote<T extends string>(candidates: T[], assign: (helpers: { add: (candidate: T, weight?: number) => void }) => void): T {
  const scores = new Map<T, number>(candidates.map((candidate) => [candidate, 0]));
  assign({
    add: (candidate, weight = 1) => {
      scores.set(candidate, (scores.get(candidate) ?? 0) + weight);
    }
  });

  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? candidates[0];
}

function resolveStyleCanonId(input: {
  baseId: Persona['baseId'];
  humor: Persona['humor'];
  softness: StyleSoftness;
  density: StyleDensity;
  imagery: StyleImagery;
  length: StyleLength;
  punctuation: StylePunctuation;
  tags: PersonaTagSelection;
}) {
  if (input.baseId === 'blank') return 'quiet_literary';
  if (input.baseId === 'guardian') return 'steady_guarded';
  if (input.baseId === 'monday' || input.humor === 'dry' || hasTag(input.tags, 'cool')) return 'cool_dry';
  if (input.softness === 'sharp' && input.imagery === 'plain') return 'restrained_precise';
  if (input.softness === 'soft' && input.density === 'dense') return 'soft_dense';
  if (input.length === 'short' && input.density === 'airy') return 'clean_concise';
  if (input.punctuation === 'marked' || input.humor === 'teasing' || hasTag(input.tags, 'playful')) return 'vivid_playful';
  return 'balanced_warm';
}

const STACK_TO_TAGS: Record<PersonaStackId, Array<{ group: keyof PersonaTagSelection; id: string }>> = {
  professional: [
    { group: 'expression', id: 'rational' },
    { group: 'interaction', id: 'reliable' }
  ],
  brief: [
    { group: 'expression', id: 'direct' },
    { group: 'expression', id: 'taciturn' }
  ],
  safe: [
    { group: 'interaction', id: 'boundaried' },
    { group: 'temperament', id: 'steady' }
  ],
  intimate: [
    { group: 'interaction', id: 'clingy' },
    { group: 'action', id: 'soothe' }
  ],
  humor: [
    { group: 'expression', id: 'playful' },
    { group: 'temperament', id: 'light' }
  ],
  delicate: [
    { group: 'interaction', id: 'considerate' },
    { group: 'temperament', id: 'soft' }
  ],
  decisive: [
    { group: 'action', id: 'push' },
    { group: 'expression', id: 'direct' }
  ]
};

const TEMPERAMENT_TO_TAGS: Record<PersonaTemperamentId, Array<{ group: keyof PersonaTagSelection; id: string }>> = {
  lively: [
    { group: 'temperament', id: 'bright' },
    { group: 'temperament', id: 'light' }
  ],
  steady: [{ group: 'temperament', id: 'steady' }],
  sensitive: [
    { group: 'temperament', id: 'soft' },
    { group: 'thinking', id: 'emotional' }
  ],
  brave: [
    { group: 'temperament', id: 'sharp' },
    { group: 'interaction', id: 'guiding' }
  ],
  gentle: [{ group: 'temperament', id: 'gentle' }]
};

const EMOTION_TO_TAGS: Record<PersonaEmotionId, Array<{ group: keyof PersonaTagSelection; id: string }>> = {
  auto: [],
  positive: [{ group: 'temperament', id: 'bright' }],
  restrained: [
    { group: 'expression', id: 'restrained' },
    { group: 'interaction', id: 'boundaried' }
  ],
  soothing: [
    { group: 'action', id: 'soothe' },
    { group: 'interaction', id: 'considerate' }
  ],
  calm: [{ group: 'temperament', id: 'calm' }]
};

const ACTION_MODE_TO_TAGS: Record<PersonaActionId, Array<{ group: keyof PersonaTagSelection; id: string }>> = {
  comfort_first: [
    { group: 'action', id: 'soothe' },
    { group: 'action', id: 'accompany' }
  ],
  conclusion_first: [
    { group: 'action', id: 'pierce' },
    { group: 'action', id: 'gather' }
  ],
  parallel: [{ group: 'action', id: 'receive' }]
};

const STABILITY_TO_TAGS: Record<PersonaStabilityId, Array<{ group: keyof PersonaTagSelection; id: string }>> = {
  cooler: [
    { group: 'temperament', id: 'cool' },
    { group: 'temperament', id: 'calm' }
  ],
  softer: [
    { group: 'temperament', id: 'gentle' },
    { group: 'temperament', id: 'soft' }
  ],
  direct: [
    { group: 'expression', id: 'direct' },
    { group: 'temperament', id: 'sharp' }
  ]
};

const WRITING_STYLE_TO_TAGS: Record<PersonaWritingStyleId, Array<{ group: keyof PersonaTagSelection; id: string }>> = {
  balanced: [{ group: 'expression', id: 'serious' }],
  concise: [
    { group: 'expression', id: 'direct' },
    { group: 'expression', id: 'taciturn' }
  ],
  literary: [{ group: 'expression', id: 'poetic' }],
  emotional: [
    { group: 'expression', id: 'talkative' },
    { group: 'thinking', id: 'emotional' }
  ]
};
