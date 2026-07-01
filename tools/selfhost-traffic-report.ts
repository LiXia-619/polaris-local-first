import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export type AccessLogEntry = {
  at: Date;
  ip: string;
  method: string;
  path: string;
  status: number;
  userAgent: string;
};

export type TrafficWindowSummary = {
  label: string;
  totalRequests: number;
  uniqueIps: number;
  browserLikeRequests: number;
  browserLikeUniqueIps: number;
  appRootPageViews: number;
  appRootUniqueIps: number;
  appLoadSessions: number;
  apiChatCompletions: number;
  healthChecks: number;
  botOrCliRequests: number;
  suspicious4xxScans: number;
  topPaths: [string, number][];
  browserCategories: [string, number][];
  pageViewsByHour: [string, number][];
};

type TrafficReport = {
  generatedAt: string;
  source: string;
  dailyTotals: [string, number][];
  dailyRootPageViews: [string, number][];
  windows: TrafficWindowSummary[];
};

const ACCESS_LOG_PATTERN =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) ([^" ]+)(?: HTTP\/[^" ]+)?" (\d{3}) \S+ "([^"]*)" "([^"]*)" "([^"]*)"$/;

const BOT_USER_AGENT_PATTERN =
  /bot|spider|crawl|curl|wget|python|go-http-client|okhttp|zgrab|nmap|masscan|censys|internetmeasurement|expanse|semrush|scanner|monitor|headless|uptime|petalbot|bytespider|facebookexternalhit|twitterbot|slurp|bingpreview/i;

const BROWSER_USER_AGENT_PATTERN =
  /Mozilla|Chrome|Safari|Firefox|Edg|Mobile|Quark|MicroMessenger|CriOS|Version\//i;

const APP_RESOURCE_PATH_PATTERN =
  /^\/(?:assets\/|icons\/|manifest\.webmanifest$|favicon\.ico$|sw\.js$|assets\/icons\/|downloads\/)/;

const SCAN_ALLOWLIST_PATHS = new Set(['/health', '/api/health', '/ops']);

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }
    const separatorIndex = arg.indexOf('=');
    if (separatorIndex === -1) {
      args.set(arg.slice(2), true);
    } else {
      args.set(arg.slice(2, separatorIndex), arg.slice(separatorIndex + 1));
    }
  }
  return args;
}

function parseNginxTimestamp(value: string) {
  const match = value.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{2})(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, day, monthName, year, hour, minute, second, offsetHour, offsetMinute] = match;
  const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    .indexOf(monthName);
  if (monthIndex < 0) {
    return null;
  }

  const utcMs = Date.UTC(
    Number(year),
    monthIndex,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  const offsetSign = offsetHour.startsWith('-') ? -1 : 1;
  const offsetMs = offsetSign * (
    Math.abs(Number(offsetHour)) * 60 + Number(offsetMinute)
  ) * 60 * 1000;

  return new Date(utcMs - offsetMs);
}

function localDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function localHourKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')} ${values.get('hour')}:00`;
}

function addCount(counter: Map<string, number>, key: string) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function sortedCounts(counter: Map<string, number>, limit?: number): [string, number][] {
  const rows = [...counter.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });
  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

export function parseAccessLogLine(line: string): AccessLogEntry | null {
  const match = ACCESS_LOG_PATTERN.exec(line);
  if (!match) {
    return null;
  }

  const [, ip, timestamp, method, rawPath, rawStatus, , userAgent] = match;
  const at = parseNginxTimestamp(timestamp);
  if (!at) {
    return null;
  }

  return {
    at,
    ip,
    method,
    path: rawPath.split('?', 1)[0] || '/',
    status: Number(rawStatus),
    userAgent
  };
}

export function parseAccessLog(content: string) {
  const entries: AccessLogEntry[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const entry = parseAccessLogLine(line);
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
}

function isBotOrCli(entry: AccessLogEntry) {
  return BOT_USER_AGENT_PATTERN.test(entry.userAgent);
}

function isBrowserLike(entry: AccessLogEntry) {
  return BROWSER_USER_AGENT_PATTERN.test(entry.userAgent) && !isBotOrCli(entry);
}

function isAppRootPageView(entry: AccessLogEntry) {
  return entry.method === 'GET'
    && entry.status < 400
    && entry.path === '/'
    && isBrowserLike(entry);
}

function browserCategory(entry: AccessLogEntry) {
  const userAgent = entry.userAgent;
  if (userAgent.includes('MicroMessenger')) return 'WeChat browser';
  if (userAgent.includes('Quark')) return 'Quark mobile browser';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS browser';
  if (userAgent.includes('Android')) return 'Android browser';
  if (userAgent.includes('Macintosh')) return 'Mac browser';
  if (userAgent.includes('Windows')) return 'Windows browser';
  return 'Other browser-like UA';
}

export function summarizeTrafficWindow(
  entries: AccessLogEntry[],
  label: string,
  timeZone = 'Asia/Shanghai'
): TrafficWindowSummary {
  const uniqueIps = new Set<string>();
  const browserLikeUniqueIps = new Set<string>();
  const rootUniqueIps = new Set<string>();
  const appLoadGroups = new Map<string, Set<string>>();
  const topPathCounts = new Map<string, number>();
  const browserCategoryCounts = new Map<string, number>();
  const pageViewsByHourCounts = new Map<string, number>();

  let browserLikeRequests = 0;
  let appRootPageViews = 0;
  let apiChatCompletions = 0;
  let healthChecks = 0;
  let botOrCliRequests = 0;
  let suspicious4xxScans = 0;

  for (const entry of entries) {
    uniqueIps.add(entry.ip);
    addCount(topPathCounts, entry.path);

    if (isBotOrCli(entry)) {
      botOrCliRequests += 1;
    }

    if (isBrowserLike(entry)) {
      browserLikeRequests += 1;
      browserLikeUniqueIps.add(entry.ip);
      addCount(browserCategoryCounts, browserCategory(entry));
    }

    if (isAppRootPageView(entry)) {
      appRootPageViews += 1;
      rootUniqueIps.add(entry.ip);
      addCount(pageViewsByHourCounts, localHourKey(entry.at, timeZone));
    }

    if (isBrowserLike(entry) && entry.method === 'GET' && entry.status < 400) {
      const groupKey = `${entry.ip}\n${entry.userAgent}`;
      const paths = appLoadGroups.get(groupKey) ?? new Set<string>();
      paths.add(entry.path);
      appLoadGroups.set(groupKey, paths);
    }

    if (entry.path === '/api/chat/completions') {
      apiChatCompletions += 1;
    }

    if (entry.path === '/health' || entry.path === '/api/health') {
      healthChecks += 1;
    }

    if (
      entry.status >= 400
      && !entry.path.startsWith('/api/')
      && !SCAN_ALLOWLIST_PATHS.has(entry.path)
    ) {
      suspicious4xxScans += 1;
    }
  }

  let appLoadSessions = 0;
  for (const paths of appLoadGroups.values()) {
    if (paths.has('/') && [...paths].some((path) => APP_RESOURCE_PATH_PATTERN.test(path))) {
      appLoadSessions += 1;
    }
  }

  return {
    label,
    totalRequests: entries.length,
    uniqueIps: uniqueIps.size,
    browserLikeRequests,
    browserLikeUniqueIps: browserLikeUniqueIps.size,
    appRootPageViews,
    appRootUniqueIps: rootUniqueIps.size,
    appLoadSessions,
    apiChatCompletions,
    healthChecks,
    botOrCliRequests,
    suspicious4xxScans,
    topPaths: sortedCounts(topPathCounts, 12),
    browserCategories: sortedCounts(browserCategoryCounts),
    pageViewsByHour: sortedCounts(pageViewsByHourCounts).sort((a, b) => a[0].localeCompare(b[0]))
  };
}

export function buildTrafficReport(entries: AccessLogEntry[], source: string, now = new Date(), timeZone = 'Asia/Shanghai'): TrafficReport {
  const dayCounts = new Map<string, number>();
  const rootDayCounts = new Map<string, number>();
  for (const entry of entries) {
    const day = localDateKey(entry.at, timeZone);
    addCount(dayCounts, day);
    if (isAppRootPageView(entry)) {
      addCount(rootDayCounts, day);
    }
  }

  const todayKey = localDateKey(now, timeZone);
  const last24hCutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const last7dCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const today = entries.filter((entry) => localDateKey(entry.at, timeZone) === todayKey);
  const last24h = entries.filter((entry) => entry.at.getTime() >= last24hCutoff);
  const last7d = entries.filter((entry) => entry.at.getTime() >= last7dCutoff);

  return {
    generatedAt: now.toISOString(),
    source,
    dailyTotals: [...dayCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    dailyRootPageViews: [...rootDayCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    windows: [
      summarizeTrafficWindow(today, 'today', timeZone),
      summarizeTrafficWindow(last24h, 'last_24h', timeZone),
      summarizeTrafficWindow(last7d, 'last_7d', timeZone)
    ]
  };
}

function renderReport(report: TrafficReport) {
  const lines = [
    `Polaris selfhost traffic report`,
    `generated: ${report.generatedAt}`,
    `source: ${report.source}`,
    '',
    `daily requests: ${report.dailyTotals.map(([day, count]) => `${day} ${count}`).join(', ') || 'none'}`,
    `daily root page views: ${report.dailyRootPageViews.map(([day, count]) => `${day} ${count}`).join(', ') || 'none'}`
  ];

  for (const window of report.windows) {
    lines.push(
      '',
      `## ${window.label}`,
      `requests: ${window.totalRequests}`,
      `unique IPs: ${window.uniqueIps}`,
      `browser-like requests: ${window.browserLikeRequests} from ${window.browserLikeUniqueIps} IPs`,
      `root page views: ${window.appRootPageViews} from ${window.appRootUniqueIps} IPs`,
      `app load sessions: ${window.appLoadSessions}`,
      `chat completions: ${window.apiChatCompletions}`,
      `health checks: ${window.healthChecks}`,
      `bot/cli requests: ${window.botOrCliRequests}`,
      `suspicious 4xx scans: ${window.suspicious4xxScans}`,
      `top paths: ${window.topPaths.map(([path, count]) => `${path} ${count}`).join(', ') || 'none'}`,
      `browsers: ${window.browserCategories.map(([category, count]) => `${category} ${count}`).join(', ') || 'none'}`
    );
    if (window.label === 'today') {
      lines.push(`page views by hour: ${window.pageViewsByHour.map(([hour, count]) => `${hour} ${count}`).join(', ') || 'none'}`);
    }
  }

  lines.push('', 'privacy: raw IPs are used only for aggregate counts and are never printed.');
  return lines.join('\n');
}

function buildRemoteSummaryScript(logPattern: string, timeZone: string) {
  return String.raw`
import gzip, glob, json, re
from collections import Counter, defaultdict
from datetime import datetime, timedelta

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

LOG_PATTERN = ${JSON.stringify(logPattern)}
TIME_ZONE = ${JSON.stringify(timeZone)}
line_re = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) ([^" ]+)(?: HTTP/[^" ]+)?" (\d{3}) \S+ "([^"]*)" "([^"]*)" "([^"]*)"$')
bot_re = re.compile(r'bot|spider|crawl|curl|wget|python|go-http-client|okhttp|zgrab|nmap|masscan|censys|internetmeasurement|expanse|semrush|scanner|monitor|headless|uptime|petalbot|bytespider|facebookexternalhit|twitterbot|slurp|bingpreview', re.I)
browser_re = re.compile(r'Mozilla|Chrome|Safari|Firefox|Edg|Mobile|Quark|MicroMessenger|CriOS|Version/', re.I)
asset_re = re.compile(r'^/(?:assets/|icons/|manifest\.webmanifest$|favicon\.ico$|sw\.js$|assets/icons/|downloads/)')
scan_allowlist = {'/health', '/api/health', '/ops'}

tz = ZoneInfo(TIME_ZONE) if ZoneInfo else None
now = datetime.now(tz).astimezone() if tz else datetime.now().astimezone()
rows = []

for path in sorted(glob.glob(LOG_PATTERN)):
    opener = gzip.open if path.endswith('.gz') else open
    try:
        with opener(path, 'rt', errors='replace') as handle:
            for line in handle:
                match = line_re.match(line)
                if not match:
                    continue
                ip, raw_ts, method, raw_path, raw_status, ref, ua, xff = match.groups()
                try:
                    at = datetime.strptime(raw_ts, '%d/%b/%Y:%H:%M:%S %z')
                except Exception:
                    continue
                rows.append((at, ip, method, raw_path.split('?', 1)[0] or '/', int(raw_status), ua))
    except FileNotFoundError:
        pass

def local_date(at):
    return at.astimezone(tz).strftime('%Y-%m-%d') if tz else at.strftime('%Y-%m-%d')

def local_hour(at):
    return at.astimezone(tz).strftime('%Y-%m-%d %H:00') if tz else at.strftime('%Y-%m-%d %H:00')

def is_bot(ua):
    return bool(bot_re.search(ua or ''))

def is_browser(ua):
    return bool(browser_re.search(ua or '')) and not is_bot(ua)

def is_root_view(row):
    at, ip, method, path, status, ua = row
    return method == 'GET' and status < 400 and path == '/' and is_browser(ua)

def browser_category(ua):
    if 'MicroMessenger' in ua:
        return 'WeChat browser'
    if 'Quark' in ua:
        return 'Quark mobile browser'
    if 'iPhone' in ua or 'iPad' in ua:
        return 'iOS browser'
    if 'Android' in ua:
        return 'Android browser'
    if 'Macintosh' in ua:
        return 'Mac browser'
    if 'Windows' in ua:
        return 'Windows browser'
    return 'Other browser-like UA'

def top(counter, limit=None):
    rows = sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    return rows[:limit] if limit else rows

def summarize(sub, label):
    unique_ips = set()
    browser_ips = set()
    root_ips = set()
    app_groups = defaultdict(set)
    path_counts = Counter()
    browser_categories = Counter()
    page_hours = Counter()
    browser_like = root_views = api_chat = health = bots = scans = 0

    for row in sub:
        at, ip, method, path, status, ua = row
        unique_ips.add(ip)
        path_counts[path] += 1
        if is_bot(ua):
            bots += 1
        if is_browser(ua):
            browser_like += 1
            browser_ips.add(ip)
            browser_categories[browser_category(ua)] += 1
        if is_root_view(row):
            root_views += 1
            root_ips.add(ip)
            page_hours[local_hour(at)] += 1
        if is_browser(ua) and method == 'GET' and status < 400:
            app_groups[(ip, ua)].add(path)
        if path == '/api/chat/completions':
            api_chat += 1
        if path in ('/health', '/api/health'):
            health += 1
        if status >= 400 and not path.startswith('/api/') and path not in scan_allowlist:
            scans += 1

    app_load_sessions = sum(
        1 for paths in app_groups.values()
        if '/' in paths and any(asset_re.search(path) for path in paths)
    )
    return {
        'label': label,
        'totalRequests': len(sub),
        'uniqueIps': len(unique_ips),
        'browserLikeRequests': browser_like,
        'browserLikeUniqueIps': len(browser_ips),
        'appRootPageViews': root_views,
        'appRootUniqueIps': len(root_ips),
        'appLoadSessions': app_load_sessions,
        'apiChatCompletions': api_chat,
        'healthChecks': health,
        'botOrCliRequests': bots,
        'suspicious4xxScans': scans,
        'topPaths': top(path_counts, 12),
        'browserCategories': top(browser_categories),
        'pageViewsByHour': sorted(page_hours.items()),
    }

today_key = local_date(now)
cut24 = now - timedelta(hours=24)
cut7 = now - timedelta(days=7)
daily_totals = Counter(local_date(row[0]) for row in rows)
daily_roots = Counter(local_date(row[0]) for row in rows if is_root_view(row))
report = {
    'generatedAt': now.isoformat(),
    'source': 'remote nginx access logs',
    'dailyTotals': sorted(daily_totals.items()),
    'dailyRootPageViews': sorted(daily_roots.items()),
    'windows': [
        summarize([row for row in rows if local_date(row[0]) == today_key], 'today'),
        summarize([row for row in rows if row[0] >= cut24], 'last_24h'),
        summarize([row for row in rows if row[0] >= cut7], 'last_7d'),
    ],
}
print(json.dumps(report, ensure_ascii=False))
`;
}

async function readRemoteReport(sshTarget: string, keyPath: string | undefined, logPattern: string, timeZone: string) {
  const args = [
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=8',
    '-o',
    'StrictHostKeyChecking=accept-new'
  ];
  if (keyPath) {
    args.push('-i', keyPath);
  }
  args.push(sshTarget, 'sudo -n python3 -');

  return new Promise<string>((resolve, reject) => {
    const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString('utf8'));
        return;
      }
      reject(new Error(Buffer.concat(errors).toString('utf8').trim() || `ssh exited with ${code}`));
    });
    child.stdin.end(buildRemoteSummaryScript(logPattern, timeZone));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const json = args.get('json') === true;
  const timeZone = String(args.get('timezone') || process.env.TZ || 'Asia/Shanghai');
  const localPath = typeof args.get('file') === 'string' ? String(args.get('file')) : undefined;
  const logPattern = String(args.get('remote-log') || process.env.POLARIS_TRAFFIC_REMOTE_LOG || '/var/log/nginx/access.log*');
  const sshTarget = String(args.get('ssh') || process.env.POLARIS_TRAFFIC_SSH || '');
  const keyPath = typeof args.get('key') === 'string'
    ? String(args.get('key'))
    : process.env.POLARIS_TRAFFIC_KEY;

  let report: TrafficReport;
  if (localPath) {
    const content = await readFile(localPath, 'utf8');
    report = buildTrafficReport(parseAccessLog(content), localPath, new Date(), timeZone);
  } else {
    if (!sshTarget) {
      throw new Error('Set POLARIS_TRAFFIC_SSH=user@host or pass --ssh=user@host. Optional: POLARIS_TRAFFIC_KEY=/path/to/key.');
    }
    report = JSON.parse(await readRemoteReport(sshTarget, keyPath, logPattern, timeZone)) as TrafficReport;
  }

  console.log(json ? JSON.stringify(report, null, 2) : renderReport(report));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
