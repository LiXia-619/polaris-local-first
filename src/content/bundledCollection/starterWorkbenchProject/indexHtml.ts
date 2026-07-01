export const STARTER_WORKBENCH_PROJECT_INDEX_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Polaris 小工作台</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="workbench-shell" data-theme="paper">
      <header class="hero">
        <span class="eyebrow">Polaris Starter Workspace</span>
        <div>
          <h1>Polaris 小工作台</h1>
          <p>这是一份可编辑的工作区文档。左侧写正文，右侧补任务和资料，下面会自动拼成 Markdown。</p>
        </div>
        <button class="icon-button" type="button" data-theme-toggle aria-label="切换主题">◐</button>
      </header>

      <section class="grid">
        <article class="panel note-panel">
          <div class="panel-head">
            <span>文档正文</span>
            <small>可编辑</small>
          </div>
          <textarea data-note placeholder="写下这份文档的正文。"></textarea>
        </article>

        <article class="panel task-panel">
          <div class="panel-head">
            <span>任务清单</span>
            <small data-task-count>0 项</small>
          </div>
          <form data-task-form class="inline-form">
            <input name="task" autocomplete="off" placeholder="新增一个小任务" />
            <button type="submit">添加</button>
          </form>
          <div class="task-list" data-task-list></div>
        </article>

        <article class="panel source-panel">
          <div class="panel-head">
            <span>资料摘录</span>
            <small>可补充</small>
          </div>
          <form data-source-form class="inline-form">
            <input name="source" autocomplete="off" placeholder="收一条资料或灵感" />
            <button type="submit">收下</button>
          </form>
          <div class="source-list" data-source-list></div>
        </article>

        <article class="panel output-panel">
          <div class="panel-head">
            <span>文档预览</span>
            <small>Markdown</small>
          </div>
          <pre data-output></pre>
          <button class="wide-button" type="button" data-copy-output>复制文档</button>
        </article>
      </section>
    </main>
    <script src="./app.js"></script>
  </body>
</html>
`;
