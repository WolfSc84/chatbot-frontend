/**
 * Unit tests for the frontend.
 *
 * The Playwright scripts in `e2e/` verify whole flows against a running stack and
 * remain the right tool for that. This runner exists for the other half: pure
 * logic and the renderer's safety properties, which should fail in milliseconds
 * next to the code rather than as a puzzling end-to-end failure.
 */
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror the `@/` alias from tsconfig.json so a test imports a module the
    // same way the app does.
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    // jsdom only exposes localStorage for a document with a real origin; with the
    // default about:blank it is undefined and every storage test fails obscurely.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
  },
});
