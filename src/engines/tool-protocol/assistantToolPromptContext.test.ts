import { describe, expect, it } from 'vitest';
import { buildCardContextPrompt } from './assistantToolPromptContext';
import { buildWorkspaceContextPrompt } from './assistantToolPromptWorkspace';
import type { AssistantToolContext } from './assistantToolProtocolTypes';

function createContext(
  mode: AssistantToolContext['roomContextMode'],
  activeCardReferenceMode: AssistantToolContext['activeCardReferenceMode'] = 'ambient'
): AssistantToolContext {
  return {
    activeCard: {
      id: 'card-1',
      title: 'Landing Hero',
      cardNote: '像留给自己的一句边注。',
      language: 'tsx',
      code: 'export function Hero() { return <section>hello</section>; }',
      cardFaceCss: '& { background: linear-gradient(180deg, #eef6ff, #ffffff); }',
      tags: [],
      createdAt: 1,
      updatedAt: 1,
      kind: 'card',
      source: 'chat-generated'
    },
    activeCardReferenceMode,
    roomContextMode: mode,
    visibleCards: [],
    retrievedCards: []
  };
}

describe('assistantToolPromptContext', () => {
  it('keeps room content out of prompt when room context is only available', () => {
    const prompt = buildCardContextPrompt(createContext('available'));
    expect(prompt).toContain('当前屏幕选中的房间：Landing Hero（tsx） id=card-1');
    expect(prompt).toContain('selector=.app-shell.collection .world-collection [data-polaris-card-id="card-1"]');
    expect(prompt).toContain('当前屏幕选中只表示界面上下文，不代表本轮必须修改它');
    expect(prompt).toContain('readCodeCard 返回卡片正文和卡面 CSS');
    expect(prompt).toContain('默认卡面已经存在');
    expect(prompt).toContain('`cardFaceCss` 是新建或改单张卡时的卡面外观字段');
    expect(prompt).toContain('默认给 `&` 写一个看得见的自由边框');
    expect(prompt).toContain('`cardFaceCss` 只写这张卡自己的局部规则');
    expect(prompt).toContain('`& .code-card-main`');
    expect(prompt).toContain('卡面底部那句轻写小字走 `cardNote`');
    expect(prompt).toContain('不要再写 `--code-card-face-*`');
    expect(prompt).toContain('房间运行时直接用 `window.PolarisRoom`');
    expect(prompt).toContain('简单 `input / textarea / select` 会自动持久化');
    expect(prompt).toContain('不要让 checkbox DOM 和你自己的 JS 数组各记一份');
    expect(prompt).not.toContain('当前活动房间正文：');
    expect(prompt).not.toContain('return <section>hello</section>;');
  });

  it('keeps continue-card content out of the tool prompt because card references already materialize it', () => {
    const prompt = buildCardContextPrompt(createContext('active', 'continue'));
    expect(prompt).toContain('本轮明确继续修改的房间：Landing Hero（tsx） id=card-1');
    expect(prompt).toContain('target 可以写 active，也可以直接写这个 id');
    expect(prompt).toContain('完整正文、卡面小字和卡面 CSS 已作为本轮卡片引用进入对话上下文');
    expect(prompt).not.toContain('当前活动房间正文：');
    expect(prompt).not.toContain('像留给自己的一句边注。');
    expect(prompt).not.toContain('return <section>hello</section>;');
    expect(prompt).not.toContain('& { background: linear-gradient(180deg, #eef6ff, #ffffff); }');
    expect(prompt).toContain('`& h3`');
    expect(prompt).toContain('`& .code-card-time`');
    expect(prompt).toContain('`window.PolarisRoom.getState()`');
    expect(prompt).toContain('`window.PolarisRoom.patchState({ ... })`');
  });

  it('nudges complex room cards toward workspace promotion without inventing a workspace', () => {
    const prompt = buildCardContextPrompt({
      ...createContext('active', 'continue'),
      activeCard: {
        id: 'card-complex',
        title: 'Puzzle Room',
        cardNote: '一张已经长成小项目的卡。',
        language: 'html',
        code: [
          '<!doctype html>',
          '<main class="app">',
          '  <button id="save">Save</button>',
          '</main>',
          '<style>',
          '.app { min-height: 100vh; }',
          '</style>',
          '<script>',
          'window.PolarisRoom.whenReady().then(() => {',
          '  document.getElementById("save").addEventListener("click", () => window.PolarisRoom.patchState({ saved: true }));',
          '});',
          '</script>'
        ].join('\n'),
        tags: [],
        createdAt: 1,
        updatedAt: 1,
        kind: 'card',
        source: 'chat-generated'
      }
    });

    expect(prompt).toContain('当前房间有项目化信号：');
    expect(prompt).toContain('HTML、样式和脚本已经混在同一张卡里');
    expect(prompt).toContain('卡内已经有交互状态或事件逻辑');
    expect(prompt).toContain('主动建议把这张房间升为工作区');
    expect(prompt).toContain('不要在普通房间对话里偷偷拆文件或新建无关工作区');
  });

  it('lists every visible card in the lightweight directory', () => {
    const prompt = buildCardContextPrompt({
      ...createContext('available'),
      visibleCards: Array.from({ length: 6 }, (_, index) => ({
        id: `card-${index + 1}`,
        title: `房间 ${index + 1}`,
        language: 'html',
        code: `<div>${index + 1}</div>`,
        tags: [],
        createdAt: index + 1,
        updatedAt: index + 1,
        kind: 'card',
        source: 'chat-generated'
      }))
    });

    expect(prompt).toContain('1. 房间 1（html）');
    expect(prompt).toContain('6. 房间 6（html）');
  });

  it('shows retrieved cards as directory entries instead of snippets', () => {
    const prompt = buildCardContextPrompt({
      ...createContext('active'),
      retrievedCards: [{
        id: 'card-2',
        title: 'Footer',
        language: 'tsx',
        tags: ['布局', '页脚'],
        originLabel: '测试对话'
      }]
    });

    expect(prompt).toContain('收藏检索结果目录：');
    expect(prompt).toContain('1. Footer（tsx） id=card-2');
    expect(prompt).toContain('标签：布局、页脚');
    expect(prompt).not.toContain('当前内容：');
  });

  it('shows active project tree and file semantics when cards belong to a project', () => {
    const base = createContext('active');
    const prompt = buildCardContextPrompt({
      ...base,
      activeProject: {
        id: 'landing-refresh',
        title: 'Landing Refresh',
        slug: 'landing-refresh',
        entryFileId: 'card-1',
        entryFilePath: 'app/page.tsx',
        tags: ['首页'],
        source: 'chat-generated',
        fileCount: 2,
        files: [
          {
            fileId: 'card-1',
            title: 'Landing Hero',
            language: 'tsx',
            path: 'app/page.tsx',
            role: 'entry',
            isEntry: true
          },
          {
            fileId: 'card-2',
            title: 'Landing Theme',
            language: 'css',
            path: 'styles/page.css',
            role: 'style',
            isEntry: false
          }
        ]
      },
      visibleProjects: [{
        id: 'landing-refresh',
        title: 'Landing Refresh',
        slug: 'landing-refresh',
        entryFileId: 'card-1',
        entryFilePath: 'app/page.tsx',
        tags: ['首页'],
        source: 'chat-generated',
        fileCount: 2,
        files: []
      }]
    });

    expect(prompt).toContain('当前活动工作区：Landing Refresh · slug=landing-refresh · 文件数=2');
    expect(prompt).toContain('当前活动工作区入口：app/page.tsx');
    expect(prompt).toContain('这轮默认继续复用这个工作区。');
    expect(prompt).toContain('房间卡工具和 Polaris 界面换肤工具在这里不可用');
    expect(prompt).toContain('工作区里的 CSS 属于项目文件内容');
    expect(prompt).toContain('不要用界面换肤工具改 Polaris 外观');
    expect(prompt).toContain('工作区文件目录：');
    expect(prompt).toContain('1. app/page.tsx · tsx · entry · role=entry');
    expect(prompt).not.toContain('房间卡补充规则');
    expect(prompt).not.toContain('cardFaceCss');
    expect(prompt).not.toContain('window.PolarisRoom');
    expect(prompt).not.toContain('房间卡适合单张就能交付');
  });

  it('does not inject work-context cues into the static project directory prompt', () => {
    const base = createContext('active');
    const prompt = buildCardContextPrompt({
      ...base,
      activeProject: {
        id: 'landing-refresh',
        title: 'Landing Refresh',
        slug: 'landing-refresh',
        entryFileId: 'card-1',
        entryFilePath: 'app/page.tsx',
        tags: ['首页'],
        source: 'chat-generated',
        fileCount: 2,
        files: [
          {
            fileId: 'card-1',
            title: 'Landing Hero',
            language: 'tsx',
            path: 'app/page.tsx',
            role: 'entry',
            isEntry: true
          },
          {
            fileId: 'card-2',
            title: 'Landing Theme',
            language: 'css',
            path: 'styles/page.css',
            role: 'style',
            isEntry: false
          }
        ]
      }
    });

    expect(prompt).not.toContain('工作区现场：');
    expect(prompt).not.toContain('最近刚改过：styles/page.css');
    expect(prompt).not.toContain('最近刚看过：app/page.tsx');
  });

  it('builds workspace projection independently from room card context', () => {
    const prompt = buildWorkspaceContextPrompt({
      activeCard: null,
      visibleCards: [],
      activeProject: {
        id: 'landing-refresh',
        title: 'Landing Refresh',
        slug: 'landing-refresh',
        entryFileId: 'card-1',
        entryFilePath: 'app/page.tsx',
        tags: ['首页'],
        source: 'chat-generated',
        fileCount: 1,
        files: [
          {
            fileId: 'card-1',
            title: 'Landing Hero',
            language: 'tsx',
            path: 'app/page.tsx',
            role: 'entry',
            isEntry: true
          }
        ]
      },
      visibleProjectFiles: [{
        id: 'card-1',
        projectId: 'landing-refresh',
        filePath: 'app/page.tsx',
        fileRole: 'entry',
        language: 'tsx',
        content: 'export function Page() { return <main />; }',
        source: 'chat-generated',
        createdAt: 1,
        updatedAt: 1
      }]
    });

    expect(prompt).toContain('当前活动工作区：Landing Refresh · slug=landing-refresh · 文件数=1');
    expect(prompt).toContain('当前工作区有文件内容投影在对话上下文里');
    expect(prompt).toContain('不等于每个文件全文');
    expect(prompt).toContain('1. app/page.tsx · tsx · entry · role=entry');
    expect(prompt).not.toContain('工作区现场：');
    expect(prompt).not.toContain('最近刚写过：app/page.tsx');
    expect(prompt).not.toContain('当前活动房间');
    expect(prompt).not.toContain('cardFaceCss');
  });
});
