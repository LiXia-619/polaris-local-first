import type { relative as zhRelative } from '../zh-CN/relative';

export const relative = {
  'relative.justNow': 'Just now',
  'relative.minutesAgo': '{count} min ago',
  'relative.hoursAgo': '{count} hr ago',
  'relative.yesterday': 'Yesterday',
  'relative.daysAgo': '{count} days ago',
  'relative.lastWeek': 'Last week',
} satisfies Record<keyof typeof zhRelative, string>;
