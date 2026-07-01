import type { topbar as zhTopbar } from '../zh-CN/topbar';

export const topbar = {
  'topbar.switchRoom': 'Switch room',
  'topbar.switchCollaboratorSpace': 'Switch collaborator space',
  'topbar.previewActive': 'Previewing',
  'topbar.secretPromptExperimental': 'Experimental sandbox is enabled.\nEnter the passphrase to keep it enabled; leave blank to return to safe mode.',
  'topbar.secretPromptLocked': 'Enter the hidden passphrase.\nA correct passphrase enables the experimental sandbox.',
  'topbar.sandboxLocked': 'runCode sandbox returned to safe mode.',
  'topbar.sandboxUnlocked': 'Experimental sandbox enabled: runCode can now use network access, modal / popup, blob workers, and downloads; it still has no same-origin access, app storage, or filesystem access.',
  'topbar.secretWrong': 'Wrong passphrase. Sandbox stays closed.',
} satisfies Record<keyof typeof zhTopbar, string>;
