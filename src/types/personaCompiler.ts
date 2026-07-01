import type { PersonaBaseId } from './domain';

export type RelationshipDistance = 'clingy' | 'close' | 'balanced' | 'spacious';
export type RelationshipInitiative = 'responsive' | 'balanced' | 'leading';
export type RelationshipSoothing = 'verbal' | 'practical' | 'quiet' | 'structured';
export type RelationshipConflict = 'direct' | 'gentle' | 'detoured' | 'deferred';
export type RelationshipStance = 'guarding' | 'parallel' | 'guiding' | 'following';
export type CoreEnergy = 'inward' | 'outward';
export type CoreResponseGate = 'feeling-first' | 'structure-first';
export type CognitiveAbstraction = 'abstract' | 'concrete';
export type CognitiveClosure = 'open' | 'structured';
export type StyleDensity = 'airy' | 'balanced' | 'dense';
export type StyleSoftness = 'soft' | 'clean' | 'sharp';
export type StyleImagery = 'plain' | 'light' | 'rich';
export type StylePunctuation = 'light' | 'balanced' | 'marked';
export type StyleLength = 'short' | 'mixed' | 'long';

export interface RelationshipSkeleton {
  distance: RelationshipDistance;
  initiative: RelationshipInitiative;
  soothing: RelationshipSoothing;
  conflict: RelationshipConflict;
  stance: RelationshipStance;
}

export interface CoreIdentity {
  archetypeId: PersonaBaseId;
  energy: CoreEnergy;
  responseGate: CoreResponseGate;
  selfImage: string;
  blindSpot: string;
}

export interface CognitiveFlavor {
  abstraction: CognitiveAbstraction;
  closure: CognitiveClosure;
}

export interface DeepMotive {
  canon: string;
  fear: string;
  desire: string;
  defense: string;
  rupture: string;
  repair: string;
  notes: string[];
}

export interface StylePolish {
  density: StyleDensity;
  softness: StyleSoftness;
  imagery: StyleImagery;
  punctuation: StylePunctuation;
  length: StyleLength;
  canonId: string;
}

export interface HardBoundaries {
  intro: string;
  system: string[];
  user: string[];
}

export interface PersonaCompilerProfile {
  relationship: RelationshipSkeleton;
  identity: CoreIdentity;
  cognition: CognitiveFlavor;
  motive: DeepMotive;
  style: StylePolish;
  boundaries: HardBoundaries;
}

export interface PersonaCompilerSections {
  coreIdentity: string;
  relationshipSkeleton: string;
  cognitiveFlavor: string;
  deepMotive: string;
  stylePolish: string;
  hardBoundaries: string;
}
