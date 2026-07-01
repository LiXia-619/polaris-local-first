import { normalizeCodeLanguage } from './codeCardLanguage';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeForScriptTag(value: string): string {
  return value.replace(/<\/script/gi, '<\\/script');
}

export function buildCodeCardPreview(language: string, code: string): string | null {
  const normalized = normalizeCodeLanguage(language);

  if (normalized === 'html') {
    return code;
  }

  if (normalized === 'css') {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 20px;
        background: #ffffff;
        font-family: "DM Sans", sans-serif;
        color: #111111;
      }
      .stage {
        display: grid;
        gap: 14px;
      }
      .sample-card {
        padding: 16px;
        border-radius: 20px;
        border: 1px solid rgba(17, 17, 17, 0.12);
        background: #f5f5f5;
      }
      .sample-button {
        border: 1px solid rgba(17, 17, 17, 0.14);
        border-radius: 999px;
        padding: 10px 16px;
        background: #111111;
        color: #ffffff;
        font: inherit;
      }
      .sample-bubble {
        padding: 14px 16px;
        border-radius: 18px 18px 6px 18px;
        background: #fafafa;
        border: 1px solid rgba(17, 17, 17, 0.12);
      }
      ${code}
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="sample-card">
        <strong>Polaris Preview</strong>
        <p>这块区域会用来预览按钮、卡片和气泡。</p>
      </div>
      <button class="sample-button">Sample Button</button>
      <div class="sample-bubble">Sample Bubble</div>
    </div>
  </body>
</html>`;
  }

  if (normalized === 'javascript') {
    const safeCode = escapeForScriptTag(code);
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 20px;
        font-family: "DM Sans", sans-serif;
        background: #ffffff;
        color: #111111;
      }
      #app {
        min-height: 120px;
        border-radius: 18px;
        border: 1px solid rgba(17, 17, 17, 0.12);
        background: #f7f7f7;
        padding: 16px;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <div id="app">脚本已载入，可以在这里渲染结果。</div>
    <script>
      const mount = document.getElementById('app');
      try {
        ${safeCode}
      } catch (error) {
        mount.innerHTML = '<pre>' + String(error) + '</pre>';
      }
    </script>
  </body>
</html>`;
  }

  return null;
}

export function buildCodeCardFallback(code: string): string {
  return `<pre>${escapeHtml(code)}</pre>`;
}
