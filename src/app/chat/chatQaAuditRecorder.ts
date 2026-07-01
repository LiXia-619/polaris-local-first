import { isChatQaAuditCaptureEnabled } from '../developer/debugCaptureRuntime';
import type { ChatQaAuditRecordArgs } from './chatQaAuditRuntime';

export function recordChatQaAudit(args: ChatQaAuditRecordArgs) {
  if (!isChatQaAuditCaptureEnabled()) return;

  void import('./chatQaAuditRuntime')
    .then(({ recordChatQaAuditEntry }) => {
      recordChatQaAuditEntry(args);
    })
    .catch((error) => {
      console.warn('[polaris-chat-qa] failed to load audit runtime', error);
    });
}
