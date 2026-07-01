import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10_000,
  },
});
