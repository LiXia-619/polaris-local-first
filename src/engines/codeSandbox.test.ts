import { describe, expect, it } from 'vitest';
import {
  RUN_CODE_SANDBOX_CSP,
  RUN_CODE_SANDBOX_EXPERIMENTAL_CSP
} from './codeSandbox';

describe('RUN_CODE_SANDBOX_CSP', () => {
  it('allows eval-based async execution while keeping network access blocked', () => {
    expect(RUN_CODE_SANDBOX_CSP).toContain("script-src 'unsafe-inline' 'unsafe-eval'");
    expect(RUN_CODE_SANDBOX_CSP).toContain("connect-src 'none'");
    expect(RUN_CODE_SANDBOX_CSP).toContain("default-src 'none'");
  });

  it('opens network and blob worker capabilities in the experimental sandbox profile', () => {
    expect(RUN_CODE_SANDBOX_EXPERIMENTAL_CSP).toContain("connect-src http: https:");
    expect(RUN_CODE_SANDBOX_EXPERIMENTAL_CSP).toContain("worker-src blob:");
    expect(RUN_CODE_SANDBOX_EXPERIMENTAL_CSP).toContain("script-src 'unsafe-inline' 'unsafe-eval' blob:");
  });

  it('does not grant same-origin access in the experimental sandbox profile', () => {
    expect(RUN_CODE_SANDBOX_EXPERIMENTAL_CSP).not.toContain(`allow${'-same-origin'}`);
  });
});
