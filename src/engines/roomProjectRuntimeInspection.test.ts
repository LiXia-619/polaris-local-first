import { describe, expect, it } from 'vitest';
import { injectProjectRuntimeInspector } from './roomProjectRuntimeInspection';

describe('injectProjectRuntimeInspector', () => {
  it('injects the runtime inspector before page scripts inside head', () => {
    const srcDoc = '<!doctype html><html><head><script>boot()</script></head><body></body></html>';
    const inspected = injectProjectRuntimeInspector(srcDoc, 'run-1', 250);

    expect(inspected.indexOf('polaris-project-runtime-inspector')).toBeGreaterThan(-1);
    expect(inspected.indexOf('polaris-project-runtime-inspector')).toBeLessThan(inspected.indexOf('boot()'));
    expect(inspected).toContain('var settleMs = 250;');
    expect(inspected).toContain('Resource failed:');
    expect(inspected).toContain('visibleElementCount');
    expect(inspected).toContain('documentWidth');
    expect(inspected).toContain('interactiveElementCount');
    expect(inspected).toContain('decodeProjectSourceUrl');
    expect(inspected).toContain('__polarisRuntimeScriptProbe');
    expect(inspected).toContain('lineNumber');
    expect(inspected).toContain('stack');
  });

  it('prepends the runtime inspector when the document has no html shell', () => {
    const inspected = injectProjectRuntimeInspector('<main>Hi</main>', 'run-2');

    expect(inspected.startsWith('<script>')).toBe(true);
    expect(inspected).toContain('<main>Hi</main>');
  });
});
