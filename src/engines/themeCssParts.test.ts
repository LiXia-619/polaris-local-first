import { describe, expect, it } from 'vitest';
import { parsePolarisCssParts, upsertPolarisCssParts } from './themeCssParts';

describe('parsePolarisCssParts', () => {
  it('reads target and name from a marked css part', () => {
    const parts = parsePolarisCssParts(`
/* @polaris-part target="chat-bubble-user" name="黑色胶囊" */
.app-shell.chat .bubble.user { color: white; }
/* @end-polaris-part */
`);

    expect(parts).toEqual([expect.objectContaining({
      target: 'chat-bubble-user',
      name: '黑色胶囊',
      css: '.app-shell.chat .bubble.user { color: white; }'
    })]);
  });
});

describe('upsertPolarisCssParts', () => {
  it('replaces only the matching target and keeps other css', () => {
    const result = upsertPolarisCssParts(`
.app-shell.chat { color: black; }

/* @polaris-part target="chat-bubble-user" name="旧气泡" */
.app-shell.chat .bubble.user { color: blue; }
/* @end-polaris-part */

/* @polaris-part target="chat-composer" name="输入框" */
.chat-box { border-radius: 20px; }
/* @end-polaris-part */
`, `
/* @polaris-part target="chat-bubble-user" name="新气泡" */
.app-shell.chat .bubble.user { color: white; }
/* @end-polaris-part */
`);

    expect(result.changed).toBe(true);
    expect(result.nextCss).toContain('.app-shell.chat { color: black; }');
    expect(result.nextCss).toContain('target="chat-composer"');
    expect(result.nextCss).toContain('color: white;');
    expect(result.nextCss).not.toContain('color: blue;');
  });

  it('appends a new target when the base has no matching part', () => {
    const result = upsertPolarisCssParts('.app-shell.chat { color: black; }', `
/* @polaris-part target="chat-bubble-user" */
.app-shell.chat .bubble.user { color: white; }
/* @end-polaris-part */
`);

    expect(result.changed).toBe(true);
    expect(result.nextCss).toContain('.app-shell.chat { color: black; }');
    expect(result.nextCss).toContain('target="chat-bubble-user"');
  });

  it('leaves ordinary css alone', () => {
    const result = upsertPolarisCssParts('.old { color: red; }', '.new { color: blue; }');

    expect(result.changed).toBe(false);
    expect(result.nextCss).toBe('.new { color: blue; }');
  });
});
