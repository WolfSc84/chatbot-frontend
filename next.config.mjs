import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Load environment variables from the repo-root `.env` into `process.env` so
 * server-side code has a single source of truth regardless of where Next.js is
 * started from.
 *
 * Resolution order (first match wins per key):
 *   1. an existing value already in the environment (shell / CI overrides)
 *   2. the `.env` one directory up (repo root, sibling of this app folder)
 *   3. a local `.env` inside this app folder (if present)
 */
const appDir = dirname(fileURLToPath(import.meta.url));

for (const envPath of [join(appDir, '..', '.env'), join(appDir, '.env')]) {
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      if (process.env[key] !== undefined) continue;
      const value = trimmed
        .slice(idx + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  } catch {
    // No `.env` at this location — ignore and try the next candidate.
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

export default nextConfig;
