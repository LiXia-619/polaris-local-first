import type { PersonaAdvancedSettings, ProviderProfile } from '../../../types/domain';
import type {
  AssistantContextSegment,
  AssistantContextMessage,
  AssistantRequestContext
} from '../../request/requestContext';

export type BuildApiRequestParams = {
  api: ProviderProfile;
  context: AssistantRequestContext;
  advanced?: PersonaAdvancedSettings;
  bodyOverrides?: Record<string, unknown>;
};

export type OrderedContextMessage = AssistantContextMessage & {
  contextSegmentKind?: AssistantContextSegment['kind'];
};
