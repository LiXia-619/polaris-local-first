export interface TemplateContext {
  cur_date: string;
  cur_time: string;
  cur_datetime: string;
  model_id: string;
  model_name: string;
  locale: string;
  timezone: string;
  system_version: string;
  device_info: string;
  battery_level: string;
  nickname: string;
  user_name: string;
  assistant_name: string;
}

export interface MessageTemplateVars {
  role: string;
  message: string;
  time: string;
  date: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateParts(date: Date): { date: string; time: string; datetime: string } {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    datetime: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  };
}

export function buildTemplateContext(params: {
  modelId: string;
  modelName?: string;
  assistantName: string;
  nickname?: string;
  now?: Date;
}): TemplateContext {
  const formatted = formatDateParts(params.now ?? new Date());
  const locale = typeof navigator !== 'undefined' ? navigator.language || 'zh-CN' : 'zh-CN';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const systemVersion = typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown';
  const deviceInfo =
    typeof navigator !== 'undefined' ? (navigator.userAgent || 'unknown').slice(0, 80) : 'unknown';

  const userName = params.nickname?.trim() || '用户';

  return {
    cur_date: formatted.date,
    cur_time: formatted.time,
    cur_datetime: formatted.datetime,
    model_id: params.modelId,
    model_name: params.modelName || params.modelId,
    locale,
    timezone,
    system_version: systemVersion,
    device_info: deviceInfo,
    battery_level: 'N/A',
    nickname: userName,
    user_name: userName,
    assistant_name: params.assistantName
  };
}

export function buildMessageTemplateVars(timestamp: number): Pick<MessageTemplateVars, 'date' | 'time'> {
  const formatted = formatDateParts(new Date(timestamp));
  return {
    date: formatted.date,
    time: formatted.time
  };
}

export function resolveSystemPromptVars(prompt: string, context: TemplateContext): string {
  const resolveValue = (match: string, key: string) => {
    if (key === 'user') return context.user_name;
    if (key === 'char' || key === 'char_name') return context.assistant_name;
    if (!(key in context)) return match;
    return context[key as keyof TemplateContext];
  };

  return prompt
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, resolveValue)
    .replace(/\{([a-zA-Z0-9_]+)\}/g, resolveValue);
}

export function resolveMessageTemplate(template: string | undefined, vars: MessageTemplateVars): string {
  const source = template?.trim() || '{{ message }}';

  return source
    .replace(/\{\{\s*role\s*\}\}/g, vars.role)
    .replace(/\{\{\s*message\s*\}\}/g, vars.message)
    .replace(/\{\{\s*time\s*\}\}/g, vars.time)
    .replace(/\{\{\s*date\s*\}\}/g, vars.date);
}
