import type { ProviderProtocol } from '../types/domain';
import { getProviderProtocolLabelKey, type ProviderProtocolLabelKey } from '../engines/providerProtocol';
import type { ProviderRouteLabelKey } from '../engines/provider-runtime';
import type { I18nTranslator } from './translator';

export function getLocalizedProviderProtocolLabel(protocol: ProviderProtocol, t: I18nTranslator['t']) {
  return t(getProviderProtocolLabelKey(protocol));
}

export function localizeProviderRouteLabel(
  routeLabelKey: ProviderRouteLabelKey,
  protocolLabelKey: ProviderProtocolLabelKey,
  t: I18nTranslator['t']
): string {
  return `${t(routeLabelKey)} · ${t(protocolLabelKey)}`;
}
