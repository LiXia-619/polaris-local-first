import { common } from './common';
import { chat } from './chat';
import { language } from './language';
import { topbar } from './topbar';
import { desktop } from './desktop';
import { collaborator } from './collaborator';
import { companion } from './companion';
import { room } from './room';
import { theme } from './theme';
import { request } from './request';
import { memory } from './memory';
import { settings } from './settings';
import { provider } from './provider';
import { apiProvider } from './apiProvider';
import { collection } from './collection';
import { relative } from './relative';
import { group } from './group';
import { app } from './app';

export const zhCNMessages = {
  ...app,
  ...common,
  ...chat,
  ...language,
  ...topbar,
  ...desktop,
  ...collaborator,
  ...companion,
  ...room,
  ...theme,
  ...request,
  ...memory,
  ...settings,
  ...provider,
  ...apiProvider,
  ...collection,
  ...relative,
  ...group,
} as const;
