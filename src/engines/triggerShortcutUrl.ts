const POLARIS_TRIGGER_SCHEME = 'polaris:';
const POLARIS_TRIGGER_HOST = 'trigger';

export type ParsedTriggerShortcutUrl = {
  ruleId: string;
  prompt: string | null;
};

export function buildTriggerShortcutUrl(ruleId: string) {
  return `polaris://trigger?id=${encodeURIComponent(ruleId)}`;
}

function readTriggerId(url: URL) {
  const queryId =
    url.searchParams.get('id')
    ?? url.searchParams.get('rule')
    ?? url.searchParams.get('trigger')
    ?? url.searchParams.get('polarisTrigger');
  if (queryId?.trim()) return queryId.trim();

  const pathId = url.pathname.split('/').filter(Boolean)[0];
  return pathId?.trim() || null;
}

function readTriggerPrompt(url: URL) {
  const prompt =
    url.searchParams.get('text')
    ?? url.searchParams.get('prompt')
    ?? url.searchParams.get('message')
    ?? url.searchParams.get('body');
  return prompt?.trim() || null;
}

export function parseTriggerShortcutUrl(rawUrl: string): ParsedTriggerShortcutUrl | null {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return null;
  }

  if (parsed.protocol === POLARIS_TRIGGER_SCHEME && parsed.hostname === POLARIS_TRIGGER_HOST) {
    const ruleId = readTriggerId(parsed);
    return ruleId ? { ruleId, prompt: readTriggerPrompt(parsed) } : null;
  }

  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.searchParams.has('polarisTrigger')) {
    const ruleId = readTriggerId(parsed);
    return ruleId ? { ruleId, prompt: readTriggerPrompt(parsed) } : null;
  }

  return null;
}
