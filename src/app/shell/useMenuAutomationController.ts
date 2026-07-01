import type { I18nTranslator } from '../../i18n';
import { useSpaceStore } from '../../stores/spaceStore';
import type {
  Persona,
  PolarisCompanionHostState,
  PolarisTriggerRule,
  PolarisTriggerSchedule
} from '../../types/domain';
import {
  copyAutomationTriggerUrl as copyAutomationTriggerUrlForRule,
  createAutomationRuleForCollaborator,
  deleteAutomationRuleWithConfirmation,
  updateAutomationRuleForCollaborator
} from './automationRuleActions';

type MenuAutomationUi = {
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
};

type MenuAutomationCopy = Pick<I18nTranslator, 't'>;

export type MenuAutomationRuleSeed = {
  collaboratorId: string;
  conversationMode?: PolarisTriggerRule['target']['conversationMode'];
  conversationId?: string | null;
  schedule: PolarisTriggerSchedule;
  prompt: string;
  name?: string;
};

type UseMenuAutomationControllerArgs = {
  personas: Persona[];
  triggerRules: PolarisTriggerRule[];
  companionHost: PolarisCompanionHostState;
  createTriggerRule: (seed: {
    name?: string;
    schedule: PolarisTriggerSchedule;
    target: PolarisTriggerRule['target'];
    action: PolarisTriggerRule['action'];
  }) => string;
  updateTriggerRule: (ruleId: string, patch: Partial<PolarisTriggerRule>) => void;
  deleteTriggerRule: (ruleId: string) => void;
  ui: MenuAutomationUi;
  copy: MenuAutomationCopy;
};

export function countEnabledAutomationRules(triggerRules: PolarisTriggerRule[]) {
  return triggerRules.filter((rule) => rule.enabled).length;
}

export function buildMenuAutomationTestPatch(now = Date.now()): Partial<PolarisTriggerRule> {
  return {
    enabled: true,
    nextRunAt: now
  };
}

export function useMenuAutomationController({
  personas,
  triggerRules,
  companionHost,
  createTriggerRule,
  updateTriggerRule,
  deleteTriggerRule,
  ui,
  copy
}: UseMenuAutomationControllerArgs) {
  const createAutomationRule = (seed: MenuAutomationRuleSeed) => createAutomationRuleForCollaborator({
    seed,
    personas,
    createTriggerRule,
    ui,
    copy
  });

  const updateAutomationRule = (ruleId: string, patch: Partial<PolarisTriggerRule>) => {
    updateAutomationRuleForCollaborator({
      ruleId,
      patch,
      triggerRules,
      personas,
      updateTriggerRule,
      ui,
      copy
    });
  };

  const deleteAutomationRule = (ruleId: string) => {
    deleteAutomationRuleWithConfirmation({
      ruleId,
      triggerRules,
      deleteTriggerRule,
      ui,
      copy
    });
  };

  const testAutomationRule = (ruleId: string) => {
    updateTriggerRule(ruleId, buildMenuAutomationTestPatch());
    useSpaceStore.getState().setWorld('chat');
  };

  const copyAutomationTriggerUrl = async (ruleId: string) => {
    await copyAutomationTriggerUrlForRule({
      ruleId,
      triggerRules,
      companionHost,
      ui,
      copy
    });
  };

  return {
    enabledTriggerRulesCount: countEnabledAutomationRules(triggerRules),
    onCreateAutomationRule: createAutomationRule,
    onUpdateAutomationRule: updateAutomationRule,
    onDeleteAutomationRule: deleteAutomationRule,
    onTestAutomationRule: testAutomationRule,
    onCopyAutomationTriggerUrl: copyAutomationTriggerUrl
  };
}
