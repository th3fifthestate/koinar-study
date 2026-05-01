import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    // .next/standalone copies stale source (and stale tests) on every build —
    // ignore it so vitest runs the live source tree only.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
