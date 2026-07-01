import type { companion as zhCompanion } from '../zh-CN/companion';

export const companion = {
  'companion.pushTokenRegistrationFailed': '{platform} push token registration failed.',
  'companion.pushRegistrationFailed': '{platform} push registration failed.',
  'companion.hostSyncFailed': 'Companion host sync failed.',
  'companion.snapshotSyncFailed': 'Companion snapshot sync failed.',
} satisfies Record<keyof typeof zhCompanion, string>;
