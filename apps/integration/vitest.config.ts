import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    isolate: false,
    environment: 'node',
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
  },
});
