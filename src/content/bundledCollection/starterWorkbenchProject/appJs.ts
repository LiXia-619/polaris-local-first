export const STARTER_WORKBENCH_PROJECT_APP_JS = `const STORAGE_KEY = 'polaris-starter-workbench-state';
const ROOM_STATE_KEY = 'starterWorkbench';
const STATE_VERSION = 2;

const defaultState = {
  version: STATE_VERSION,
  theme: 'paper',
  note: '这是一份可以边写边预览的工作区文档。\\n\\n你可以在这里整理正文，在右侧补任务和资料摘录；下方会自动拼成 Markdown，点“复制文档”就能带走。\\n\\n工作区和卡片的区别很简单：卡片适合保存单页小东西，工作区适合长期维护一组文件。',
  tasks: [
    { id: 'task-read', text: '写下这份文档要解决的问题', done: true },
    { id: 'task-theme', text: '补一条资料摘录，让预览自动更新', done: false },
    { id: 'task-edit', text: '复制文档，带去对话里继续改', done: false }
  ],
  sources: [
    { id: 'source-1', text: '工作区适合长期维护一组文件；卡片适合保存单页小东西。' },
    { id: 'source-2', text: '这里写下的内容会保存在这个工作区里，下次打开还能继续。' }
  ]
};

const nodes = {
  shell: document.querySelector('.workbench-shell'),
  note: document.querySelector('[data-note]'),
  taskForm: document.querySelector('[data-task-form]'),
  taskList: document.querySelector('[data-task-list]'),
  taskCount: document.querySelector('[data-task-count]'),
  sourceForm: document.querySelector('[data-source-form]'),
  sourceList: document.querySelector('[data-source-list]'),
  output: document.querySelector('[data-output]'),
  copyOutput: document.querySelector('[data-copy-output]'),
  themeToggle: document.querySelector('[data-theme-toggle]')
};

let state = loadState();

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the selection path for WebView clipboard quirks.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-999px';
  textarea.style.left = '-999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('copy failed');
}

function getPreferredTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'ink' : 'paper';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultState() {
  return {
    ...clone(defaultState),
    theme: getPreferredTheme()
  };
}

function mergeDefaults(defaultValue, source) {
  if (Array.isArray(defaultValue)) return Array.isArray(source) ? source : clone(defaultValue);
  if (!defaultValue || typeof defaultValue !== 'object') return source ?? defaultValue;
  const next = {};
  Object.keys(defaultValue).forEach((key) => {
    next[key] = mergeDefaults(defaultValue[key], source?.[key]);
  });
  Object.keys(source || {}).forEach((key) => {
    if (!(key in next)) next[key] = source[key];
  });
  return next;
}

function getRoomState() {
  const room = window.PolarisRoom;
  if (!room || typeof room.getState !== 'function') return null;
  return room.getState()?.[ROOM_STATE_KEY] ?? null;
}

function loadState() {
  const roomState = getRoomState();
  if (roomState?.version === STATE_VERSION) return mergeDefaults(defaultState, roomState);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return saved?.version === STATE_VERSION ? mergeDefaults(defaultState, saved) : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  const snapshot = clone(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
  const room = window.PolarisRoom;
  if (room && typeof room.patchState === 'function') {
    room.patchState({ [ROOM_STATE_KEY]: snapshot });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createId(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function buildMarkdown() {
  const openTasks = state.tasks.filter((task) => !task.done);
  const doneTasks = state.tasks.filter((task) => task.done);
  return [
    '# Polaris 小工作台文档',
    '',
    '## 正文',
    state.note.trim() || '暂无正文。',
    '',
    '## 待办',
    ...state.tasks.map((task) => (task.done ? '- [x] ' : '- [ ] ') + task.text),
    '',
    '## 资料摘录',
    ...state.sources.map((source) => '- ' + source.text),
    '',
    '## 小结',
    '未完成 ' + openTasks.length + ' 项，已完成 ' + doneTasks.length + ' 项。'
  ].join('\\n');
}

function renderTasks() {
  nodes.taskCount.textContent = state.tasks.length + ' 项';
  nodes.taskList.innerHTML = state.tasks.map((task) => [
    '<div class="task-item' + (task.done ? ' done' : '') + '" data-task-id="' + task.id + '">',
    '<button class="mark" type="button" data-toggle-task aria-label="切换任务状态">' + (task.done ? '✓' : '') + '</button>',
    '<span class="task-text">' + escapeHtml(task.text) + '</span>',
    '<button class="delete-button" type="button" data-delete-task aria-label="删除任务">×</button>',
    '</div>'
  ].join('')).join('');
}

function renderSources() {
  nodes.sourceList.innerHTML = state.sources.map((source) => [
    '<div class="source-item" data-source-id="' + source.id + '">',
    '<span>' + escapeHtml(source.text) + '</span>',
    '<button class="delete-button" type="button" data-delete-source aria-label="删除摘录">×</button>',
    '</div>'
  ].join('')).join('');
}

function render() {
  nodes.shell.dataset.theme = state.theme;
  document.documentElement.dataset.theme = state.theme;
  if (nodes.note.value !== state.note) nodes.note.value = state.note;
  renderTasks();
  renderSources();
  nodes.output.textContent = buildMarkdown();
}

nodes.note.addEventListener('input', () => {
  state.note = nodes.note.value;
  saveState();
  render();
});

nodes.taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = new FormData(nodes.taskForm).get('task')?.toString().trim();
  if (!input) return;
  state.tasks = [{ id: createId('task'), text: input, done: false }, ...state.tasks];
  nodes.taskForm.reset();
  saveState();
  render();
});

nodes.sourceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = new FormData(nodes.sourceForm).get('source')?.toString().trim();
  if (!input) return;
  state.sources = [{ id: createId('source'), text: input }, ...state.sources];
  nodes.sourceForm.reset();
  saveState();
  render();
});

document.addEventListener('click', async (event) => {
  const target = event.target;
  const taskItem = target.closest?.('[data-task-id]');
  const sourceItem = target.closest?.('[data-source-id]');

  if (target.matches?.('[data-theme-toggle]')) {
    state.theme = state.theme === 'paper' ? 'ink' : 'paper';
    saveState();
    render();
  }

  if (target.matches?.('[data-toggle-task]') && taskItem) {
    state.tasks = state.tasks.map((task) =>
      task.id === taskItem.dataset.taskId ? { ...task, done: !task.done } : task
    );
    saveState();
    render();
  }

  if (target.matches?.('[data-delete-task]') && taskItem) {
    state.tasks = state.tasks.filter((task) => task.id !== taskItem.dataset.taskId);
    saveState();
    render();
  }

  if (target.matches?.('[data-delete-source]') && sourceItem) {
    state.sources = state.sources.filter((source) => source.id !== sourceItem.dataset.sourceId);
    saveState();
    render();
  }

  if (target.matches?.('[data-copy-output]')) {
    const text = buildMarkdown();
    try {
      await copyText(text);
      target.textContent = '已复制';
      setTimeout(() => { target.textContent = '复制文档'; }, 1200);
    } catch {
      target.textContent = '复制失败';
      setTimeout(() => { target.textContent = '复制文档'; }, 1200);
    }
  }
});

render();
`;
