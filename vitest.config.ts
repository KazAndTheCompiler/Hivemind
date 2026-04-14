import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/*.test.ts', '**/dist/**', '**/node_modules/**']
    }
  }
});
