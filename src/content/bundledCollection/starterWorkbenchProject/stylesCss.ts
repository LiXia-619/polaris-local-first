export const STARTER_WORKBENCH_PROJECT_STYLES_CSS = `:root {
  color-scheme: light;
  --bg: #f4f5f7;
  --card: rgba(255, 255, 255, 0.86);
  --card-strong: rgba(255, 255, 255, 0.96);
  --text: #1d232c;
  --muted: rgba(29, 35, 44, 0.56);
  --line: rgba(91, 108, 128, 0.16);
  --accent: #5d7ee8;
  --accent-soft: rgba(93, 126, 232, 0.14);
  --green: #4f9c70;
  --shadow: 0 22px 70px rgba(38, 48, 64, 0.14);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
}

body {
  background:
    radial-gradient(circle at 12% 0%, rgba(135, 166, 255, 0.24), transparent 30%),
    radial-gradient(circle at 90% 10%, rgba(255, 210, 154, 0.28), transparent 28%),
    var(--bg);
  color: var(--text);
}

button,
input,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.workbench-shell {
  width: min(1120px, 100%);
  min-height: 100vh;
  margin: 0 auto;
  padding: clamp(22px, 4vw, 48px);
}

:root[data-theme="ink"] {
  color-scheme: dark;
  --bg: #15171c;
  --card: rgba(28, 31, 38, 0.82);
  --card-strong: rgba(35, 38, 46, 0.96);
  --text: #f4f6fa;
  --muted: rgba(244, 246, 250, 0.58);
  --line: rgba(222, 229, 242, 0.14);
  --accent: #9db4ff;
  --accent-soft: rgba(157, 180, 255, 0.16);
  --green: #91d3a8;
  --shadow: 0 24px 80px rgba(0, 0, 0, 0.26);
}

.hero {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
  align-items: start;
  margin-bottom: 24px;
}

.eyebrow {
  grid-column: 1 / -1;
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(34px, 6vw, 58px);
  line-height: 0.98;
  letter-spacing: 0;
}

p {
  max-width: 620px;
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.72;
}

.icon-button {
  width: 48px;
  height: 48px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--text);
  box-shadow: 0 12px 30px rgba(38, 48, 64, 0.1);
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 16px;
}

.panel {
  min-height: 230px;
  border: 1px solid var(--line);
  border-radius: 28px;
  background: var(--card);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  padding: 18px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-head span {
  font-size: 18px;
  font-weight: 800;
}

.panel-head small {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.note-panel {
  grid-row: span 2;
  display: grid;
  grid-template-rows: auto 1fr;
}

.output-panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
}

textarea {
  width: 100%;
  min-height: 420px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 22px;
  padding: 16px;
  background: var(--card-strong);
  color: var(--text);
  outline: none;
  line-height: 1.7;
}

input {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px 13px;
  background: var(--card-strong);
  color: var(--text);
  outline: none;
}

textarea:focus,
input:focus {
  border-color: rgba(93, 126, 232, 0.5);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.inline-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-bottom: 14px;
}

.inline-form button,
.wide-button {
  border: 0;
  border-radius: 16px;
  padding: 0 16px;
  background: var(--text);
  color: var(--bg);
  font-weight: 760;
}

.task-list,
.source-list {
  display: grid;
  gap: 10px;
}

.task-item,
.source-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 11px 12px;
  background: rgba(255, 255, 255, 0.46);
}

:root[data-theme="ink"] .task-item,
:root[data-theme="ink"] .source-item {
  background: rgba(255, 255, 255, 0.04);
}

.task-item.done {
  color: var(--muted);
}

.task-item.done .task-text {
  text-decoration: line-through;
}

.mark {
  width: 22px;
  height: 22px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--green);
}

.delete-button {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 18px;
}

.source-item {
  grid-template-columns: 1fr auto;
  color: rgba(29, 35, 44, 0.76);
}

:root[data-theme="ink"] .source-item {
  color: rgba(244, 246, 250, 0.76);
}

pre {
  min-height: 244px;
  max-height: 360px;
  overflow: auto;
  margin: 0 0 14px;
  border: 1px solid var(--line);
  border-radius: 22px;
  padding: 16px;
  background: var(--card-strong);
  color: var(--text);
  white-space: pre-wrap;
  line-height: 1.58;
}

.wide-button {
  width: 100%;
  min-height: 48px;
}

@media (max-width: 760px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .note-panel {
    grid-row: auto;
  }

  textarea {
    min-height: 240px;
  }
}
`;
