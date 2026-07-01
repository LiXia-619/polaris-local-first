import type { Persona } from '../../types/domain';

export type PersonaUpdatePatch = Partial<Omit<Persona, 'id' | 'version' | 'deepDefinition' | 'memory' | 'advanced' | 'mcp'>> & {
  deepDefinition?: Partial<Persona['deepDefinition']>;
  memory?: Partial<Persona['memory']>;
  advanced?: Partial<Persona['advanced']>;
  mcp?: Partial<Persona['mcp']>;
};
