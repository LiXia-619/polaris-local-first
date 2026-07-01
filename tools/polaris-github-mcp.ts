import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';

const MCP_PROTOCOL_VERSION = '2025-03-26';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const GITHUB_API_ORIGIN = 'https://api.github.com';

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

const tools: McpTool[] = [
  {
    name: 'github_repo_summary',
    description: '读取 GitHub 仓库摘要、默认分支、语言、star、issue 数和最近更新时间。',
    inputSchema: objectSchema({
      owner: stringProp('仓库 owner，例如 openai。'),
      repo: stringProp('仓库名，例如 openai-node。')
    }, ['owner', 'repo'])
  },
  {
    name: 'github_list_files',
    description: '列出 GitHub 仓库某个目录下的文件和子目录。',
    inputSchema: objectSchema({
      owner: stringProp('仓库 owner。'),
      repo: stringProp('仓库名。'),
      path: stringProp('目录路径；不填表示仓库根目录。'),
      ref: stringProp('分支、tag 或 commit；不填使用默认分支。')
    }, ['owner', 'repo'])
  },
  {
    name: 'github_read_file',
    description: '读取 GitHub 仓库里的一个文本文件。',
    inputSchema: objectSchema({
      owner: stringProp('仓库 owner。'),
      repo: stringProp('仓库名。'),
      path: stringProp('文件路径。'),
      ref: stringProp('分支、tag 或 commit；不填使用默认分支。'),
      maxChars: numberProp('最多返回多少字符。')
    }, ['owner', 'repo', 'path'])
  },
  {
    name: 'github_list_issues',
    description: '列出 GitHub 仓库 issue 或 PR 条目。',
    inputSchema: objectSchema({
      owner: stringProp('仓库 owner。'),
      repo: stringProp('仓库名。'),
      state: stringProp('open、closed 或 all；默认 open。'),
      labels: stringProp('逗号分隔的 label。'),
      maxResults: numberProp('最多返回多少条。')
    }, ['owner', 'repo'])
  },
  {
    name: 'github_search_repositories',
    description: '搜索公开 GitHub 仓库。',
    inputSchema: objectSchema({
      query: stringProp('GitHub 搜索词。'),
      maxResults: numberProp('最多返回多少条。')
    }, ['query'])
  }
];

function objectSchema(properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false
  };
}

function stringProp(description: string) {
  return { type: 'string', description };
}

function numberProp(description: string) {
  return { type: 'number', description };
}

function getArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getNumberArg(args: Record<string, unknown>, key: string, fallback: number, max: number) {
  const value = Number(args[key]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(max, Math.floor(value));
}

function requireArg(args: Record<string, unknown>, key: string) {
  const value = getArg(args, key);
  if (!value) throw new Error(`${key} 不能为空。`);
  return value;
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Polaris-GitHub-MCP/0.1',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function buildGithubUrl(pathname: string, searchParams: Record<string, string | undefined> = {}) {
  const url = new URL(pathname, GITHUB_API_ORIGIN);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

async function githubFetch<T>(pathname: string, searchParams?: Record<string, string | undefined>): Promise<T> {
  const response = await fetch(buildGithubUrl(pathname, searchParams), {
    headers: githubHeaders()
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) as T & { message?: string } : null;
  if (!response.ok) {
    throw new Error(data?.message || `GitHub API 请求失败：HTTP ${response.status}`);
  }
  return data as T;
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}\n\n[已截断，原始长度 ${text.length} 字符]`,
    truncated: true
  };
}

function formatDate(value: unknown) {
  return typeof value === 'string' && value ? value : 'unknown';
}

async function runTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case 'github_repo_summary':
      return repoSummary(args);
    case 'github_list_files':
      return listFiles(args);
    case 'github_read_file':
      return readFile(args);
    case 'github_list_issues':
      return listIssues(args);
    case 'github_search_repositories':
      return searchRepositories(args);
    default:
      throw new Error(`未知 GitHub MCP 工具：${name}`);
  }
}

async function repoSummary(args: Record<string, unknown>): Promise<ToolResult> {
  const owner = requireArg(args, 'owner');
  const repo = requireArg(args, 'repo');
  const data = await githubFetch<{
    full_name: string;
    html_url: string;
    description: string | null;
    default_branch: string;
    language: string | null;
    stargazers_count: number;
    open_issues_count: number;
    updated_at: string;
    pushed_at: string;
  }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);

  const lines = [
    `${data.full_name}`,
    data.description || '无描述',
    data.html_url,
    `默认分支：${data.default_branch}`,
    `语言：${data.language || 'unknown'}`,
    `Stars：${data.stargazers_count}`,
    `Open issues/PRs：${data.open_issues_count}`,
    `Updated：${formatDate(data.updated_at)}`,
    `Pushed：${formatDate(data.pushed_at)}`
  ];
  return textResult(lines.join('\n'), {
    fullName: data.full_name,
    url: data.html_url,
    defaultBranch: data.default_branch,
    language: data.language,
    stars: data.stargazers_count,
    openIssues: data.open_issues_count,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at
  });
}

async function listFiles(args: Record<string, unknown>): Promise<ToolResult> {
  const owner = requireArg(args, 'owner');
  const repo = requireArg(args, 'repo');
  const path = getArg(args, 'path');
  const ref = getArg(args, 'ref');
  const data = await githubFetch<Array<{
    name: string;
    path: string;
    type: string;
    size?: number;
    html_url?: string;
  }> | {
    name: string;
    path: string;
    type: string;
    size?: number;
    html_url?: string;
  }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    ref: ref || undefined
  });
  const entries = Array.isArray(data) ? data : [data];
  const compactEntries = entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    type: entry.type,
    size: entry.size,
    url: entry.html_url
  }));
  const lines = compactEntries
    .sort((left, right) => `${left.type}:${left.path}`.localeCompare(`${right.type}:${right.path}`))
    .map((entry) => `${entry.type === 'dir' ? 'dir ' : 'file'} ${entry.path}${typeof entry.size === 'number' ? ` (${entry.size} bytes)` : ''}`);
  return textResult(lines.join('\n') || '目录为空。', compactEntries);
}

async function readFile(args: Record<string, unknown>): Promise<ToolResult> {
  const owner = requireArg(args, 'owner');
  const repo = requireArg(args, 'repo');
  const path = requireArg(args, 'path');
  const ref = getArg(args, 'ref');
  const maxChars = getNumberArg(args, 'maxChars', 12000, 100000);
  const data = await githubFetch<{
    name: string;
    path: string;
    type: string;
    encoding?: string;
    content?: string;
    html_url?: string;
    size?: number;
  }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    ref: ref || undefined
  });

  if (data.type !== 'file' || data.encoding !== 'base64' || !data.content) {
    throw new Error(`${path} 不是可读取的文本文件。`);
  }

  const decoded = Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8');
  const truncated = truncateText(decoded, maxChars);
  return textResult([
    `${owner}/${repo}/${data.path}`,
    data.html_url || '',
    '',
    truncated.text
  ].filter(Boolean).join('\n'), {
    path: data.path,
    size: data.size,
    truncated: truncated.truncated
  });
}

async function listIssues(args: Record<string, unknown>): Promise<ToolResult> {
  const owner = requireArg(args, 'owner');
  const repo = requireArg(args, 'repo');
  const state = getArg(args, 'state') || 'open';
  const labels = getArg(args, 'labels');
  const maxResults = getNumberArg(args, 'maxResults', 10, 50);
  const data = await githubFetch<Array<{
    number: number;
    title: string;
    state: string;
    html_url: string;
    pull_request?: unknown;
    user?: { login?: string };
    updated_at?: string;
  }>>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
    state,
    labels: labels || undefined,
    per_page: String(maxResults)
  });

  const compactIssues = data.slice(0, maxResults).map((issue) => ({
    number: issue.number,
    kind: issue.pull_request ? 'PR' : 'Issue',
    title: issue.title,
    state: issue.state,
    url: issue.html_url,
    author: issue.user?.login || 'unknown',
    updatedAt: issue.updated_at
  }));
  const lines = compactIssues.map((issue) => {
    return `#${issue.number} [${issue.kind}][${issue.state}] ${issue.title}\n${issue.url}\nby ${issue.author} · updated ${formatDate(issue.updatedAt)}`;
  });
  return textResult(lines.join('\n\n') || '没有找到 issue。', compactIssues);
}

async function searchRepositories(args: Record<string, unknown>): Promise<ToolResult> {
  const query = requireArg(args, 'query');
  const maxResults = getNumberArg(args, 'maxResults', 10, 30);
  const data = await githubFetch<{
    total_count: number;
    items: Array<{
      full_name: string;
      html_url: string;
      description: string | null;
      stargazers_count: number;
      language: string | null;
      updated_at: string;
    }>;
  }>('/search/repositories', {
    q: query,
    per_page: String(maxResults)
  });

  const compactRepos = data.items.slice(0, maxResults).map((repo) => ({
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    stars: repo.stargazers_count,
    language: repo.language,
    updatedAt: repo.updated_at
  }));
  const lines = compactRepos.map((repo, index) => [
    `${index + 1}. ${repo.fullName}`,
    repo.description || '无描述',
    repo.url,
    `Stars：${repo.stars} · ${repo.language || 'unknown'} · updated ${formatDate(repo.updatedAt)}`
  ].join('\n'));
  return textResult(lines.join('\n\n') || '没有找到仓库。', compactRepos);
}

function textResult(text: string, structuredContent?: unknown): ToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent
  };
}

function errorToolResult(error: unknown): ToolResult {
  return {
    content: [{
      type: 'text',
      text: error instanceof Error ? error.message : 'GitHub MCP 工具调用失败。'
    }],
    isError: true
  };
}

function sendCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, DELETE, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, MCP-Protocol-Version, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, MCP-Protocol-Version');
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  sendCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function sendRpcResult(res: ServerResponse, id: JsonRpcId | undefined, result: unknown) {
  sendJson(res, 200, {
    jsonrpc: '2.0',
    id,
    result
  });
}

function sendRpcError(res: ServerResponse, id: JsonRpcId | undefined, message: string, code = -32000) {
  sendJson(res, 200, {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message
    }
  });
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) as JsonRpcRequest : {};
}

async function handleRpc(req: IncomingMessage, res: ServerResponse) {
  const payload = await readBody(req);

  if (payload.method === 'initialize') {
    res.setHeader('Mcp-Session-Id', `polaris-github-${Date.now().toString(36)}`);
    sendRpcResult(res, payload.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'Polaris GitHub MCP',
        version: '0.1.0'
      }
    });
    return;
  }

  if (payload.method === 'notifications/initialized') {
    sendCors(res);
    res.statusCode = 202;
    res.end();
    return;
  }

  if (payload.method === 'tools/list') {
    sendRpcResult(res, payload.id, { tools });
    return;
  }

  if (payload.method === 'tools/call') {
    const params = payload.params ?? {};
    const name = typeof params.name === 'string' ? params.name : '';
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
      ? params.arguments as Record<string, unknown>
      : {};
    const result = await runTool(name, args).catch(errorToolResult);
    sendRpcResult(res, payload.id, result);
    return;
  }

  sendRpcError(res, payload.id, `Unsupported MCP method: ${payload.method || 'unknown'}`, -32601);
}

const host = process.env.HOST?.trim() || DEFAULT_HOST;
const port = Number(process.env.PORT || DEFAULT_PORT);

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      name: 'Polaris GitHub MCP',
      transport: 'streamable-http',
      tools: tools.map(tool => tool.name),
      token: Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN)
    });
    return;
  }

  if (req.method === 'DELETE') {
    sendCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  void handleRpc(req, res).catch((error) => {
    sendRpcError(res, undefined, error instanceof Error ? error.message : 'MCP request failed');
  });
});

server.listen(port, host, () => {
  const tokenLabel = process.env.GITHUB_TOKEN || process.env.GH_TOKEN ? 'with GitHub token' : 'without GitHub token';
  console.log(`Polaris GitHub MCP ready at http://${host}:${port}/ (${tokenLabel})`);
});
