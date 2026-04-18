import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.tsx', 'src/App.tsx', 'src/socket.ts', 'src/views/**', 'src/components/**', 'src/hooks/**'],
    },
  },
  resolve: {
    alias: {
      '@jeopardy/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
