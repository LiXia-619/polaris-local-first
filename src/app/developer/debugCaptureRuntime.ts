import { isDeveloperModeEnabled } from './developerModeRuntime';

function hasQueryFlag(name: string) {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get(name) === '1';
  } catch {
    return false;
  }
}

export function isRequestDebugCaptureEnabled() {
  return isDeveloperModeEnabled() || hasQueryFlag('debugRequest');
}

export function isChatQaAuditCaptureEnabled() {
  return isRequestDebugCaptureEnabled() || hasQueryFlag('debugQa');
}

export function isModelFlowTraceCaptureEnabled() {
  return isChatQaAuditCaptureEnabled() || hasQueryFlag('debugFlow');
}
