import { buildCompanionAutomationTriggerUrl } from '../../engines/companionApi';
import { buildTriggerShortcutUrl } from '../../engines/triggerShortcutUrl';
import { writeTextToClipboard } from '../../infrastructure/clipboard';
import type { I18nTranslator } from '../../i18n';
import type {
  Persona,
  PolarisCompanionHostState,
  PolarisTriggerRule,
  PolarisTriggerSchedule
} from '../../types/domain';

type AutomationRuleUiPort = {
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
};

type AutomationRuleActionCopy = Pick<I18nTranslator, 't'>;

type CreateAutomationRuleArgs = {
  seed: {
    collaboratorId: string;
    conversationMode?: PolarisTriggerRule['target']['conversationMode'];
    conversationId?: string | null;
    schedule: PolarisTriggerSchedule;
    prompt: string;
    name?: string;
  };
  personas: Persona[];
  createTriggerRule: (seed: {
    name?: string;
    schedule: PolarisTriggerSchedule;
    target: PolarisTriggerRule['target'];
    action: PolarisTriggerRule['action'];
  }) => string;
  ui: Pick<AutomationRuleUiPort, 'alert'>;
  copy: AutomationRuleActionCopy;
};

export function createAutomationRuleForCollaborator({
  seed,
  personas,
  createTriggerRule,
  ui,
  copy
}: CreateAutomationRuleArgs) {
  const targetCollaboratorId = seed.collaboratorId.trim();
  const collaborator = personas.find((persona) => persona.id === targetCollaboratorId) ?? null;
  if (!targetCollaboratorId || !collaborator) {
    ui.alert(copy.t('settings.automation.missingPersonaWake'));
    return null;
  }
  const trimmedPrompt = seed.prompt.trim();
  if (!trimmedPrompt) {
    ui.alert(copy.t('settings.automation.emptyTrigger'));
    return null;
  }
  const defaultName = seed.schedule.kind === 'daily'
    ? copy.t('settings.automation.defaultNameDaily', { name: collaborator.name, time: seed.schedule.time })
    : copy.t('settings.automation.defaultNameInterval', { name: collaborator.name, minutes: seed.schedule.everyMinutes });
  const conversationMode = seed.conversationMode === 'fixed' ? 'fixed' : 'follow-latest';
  const conversationId = conversationMode === 'fixed' ? seed.conversationId?.trim() || null : null;
  if (conversationMode === 'fixed' && !conversationId) {
    ui.alert(copy.t('settings.automation.missingConversation'));
    return null;
  }
  return createTriggerRule({
    name: seed.name?.trim() || defaultName,
    schedule: seed.schedule,
    target: {
      collaboratorId: targetCollaboratorId,
      conversationMode,
      conversationId
    },
    action: {
      prompt: trimmedPrompt
    }
  });
}

export function updateAutomationRuleForCollaborator(args: {
  ruleId: string;
  patch: Partial<PolarisTriggerRule>;
  triggerRules: PolarisTriggerRule[];
  personas: Persona[];
  updateTriggerRule: (ruleId: string, patch: Partial<PolarisTriggerRule>) => void;
  ui: Pick<AutomationRuleUiPort, 'alert'>;
  copy: AutomationRuleActionCopy;
}) {
  const rule = args.triggerRules.find((entry) => entry.id === args.ruleId) ?? null;
  if (!rule) return;
  const targetCollaboratorId = args.patch.target?.collaboratorId ?? rule.target.collaboratorId;
  if (!args.personas.some((persona) => persona.id === targetCollaboratorId)) {
    args.ui.alert(args.copy.t('settings.automation.missingPersonaWake'));
    return;
  }
  args.updateTriggerRule(args.ruleId, {
    ...args.patch,
    target: args.patch.target
      ? {
          ...rule.target,
          ...args.patch.target,
          collaboratorId: targetCollaboratorId
        }
      : undefined
  });
}

export function deleteAutomationRuleWithConfirmation(args: {
  ruleId: string;
  triggerRules: PolarisTriggerRule[];
  deleteTriggerRule: (ruleId: string) => void;
  ui: Pick<AutomationRuleUiPort, 'confirm'>;
  copy: AutomationRuleActionCopy;
}) {
  const rule = args.triggerRules.find((entry) => entry.id === args.ruleId) ?? null;
  if (rule && !args.ui.confirm(args.copy.t('settings.automation.deleteConfirm', { name: rule.name }))) return;
  args.deleteTriggerRule(args.ruleId);
}

export async function copyAutomationTriggerUrl(args: {
  ruleId: string;
  triggerRules: PolarisTriggerRule[];
  companionHost: PolarisCompanionHostState;
  ui: Pick<AutomationRuleUiPort, 'alert'>;
  copy: AutomationRuleActionCopy;
}) {
  const rule = args.triggerRules.find((entry) => entry.id === args.ruleId) ?? null;
  if (!rule) {
    args.ui.alert(args.copy.t('settings.automation.ruleMissing'));
    return;
  }
  const relayReady = args.companionHost.enabled
    && args.companionHost.relayUrl.trim()
    && args.companionHost.hostId
    && rule.webhookSecret;
  const triggerUrl = relayReady
    ? buildCompanionAutomationTriggerUrl({
        relayUrl: args.companionHost.relayUrl,
        hostId: args.companionHost.hostId!,
        ruleId: rule.id,
        secret: rule.webhookSecret
      })
    : buildTriggerShortcutUrl(rule.id);
  try {
    await writeTextToClipboard(triggerUrl);
    args.ui.alert(relayReady
      ? args.copy.t('settings.automation.copiedRelayLink')
      : args.copy.t('settings.automation.copiedShortcutLink'));
  } catch {
    args.ui.alert(args.copy.t('settings.automation.copyFallback', {
      label: relayReady
        ? args.copy.t('settings.automation.relayLinkLabel')
        : args.copy.t('settings.automation.shortcutLinkLabel'),
      url: triggerUrl
    }));
  }
}
