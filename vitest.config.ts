import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          globals: true,
          environment: 'node',
          include: ['src/server/**/*.spec.{ts,tsx}', 'tests/**/*.spec.{ts,tsx}'],
          setupFiles: ['./tests/setup-server.ts'],
        },
      },
      {
        test: {
          name: 'client',
          globals: true,
          environment: 'happy-dom',
          include: ['src/client/**/*.spec.{ts,tsx}'],
          setupFiles: ['./tests/setup-client.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'example/', '*.config.ts', '*.config.js', 'tests/', '**/*.spec.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
