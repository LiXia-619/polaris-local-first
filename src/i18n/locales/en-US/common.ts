import type { common as zhCommon } from '../zh-CN/common';

export const common = {
  'common.back': 'Back',
  'common.settings': 'Settings',
  'common.search': 'Search',
  'common.editOrSearch': 'Edit / Search',
  'common.newConversation': 'New conversation',
  'common.collaborator': 'Collaborator',
  'common.allCollaborators': 'All collaborators',
  'common.workspace': 'Workspace',
  'common.room': 'Rooms',
  'common.conversation': 'Chat',
  'common.untitledWorkspace': 'Untitled workspace',
  'common.pinned': 'Pinned',
  'common.progress': 'Progress {progress}%',
  'common.toggleAria': '{label} {status}',
  'common.toggleOn': 'on',
  'common.toggleOff': 'off',
  'common.closeCreatePanel': 'Close create panel',
} satisfies Record<keyof typeof zhCommon, string>;
