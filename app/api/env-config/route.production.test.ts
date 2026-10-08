/** The .env editor does not exist in a production build (phase 10). */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('/api/env-config in production', () => {
  it('is not found, for reads and writes', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const route = await import('./route');
    expect((await route.GET()).status).toBe(404);
    const post = new Request('http://bff.local/api/env-config', {
      method: 'POST',
      body: JSON.stringify({ key: 'PERSISTENCE_PRIMARY', value: 'postgres' }),
    });
    expect((await route.POST(post as unknown as Parameters<typeof route.POST>[0])).status).toBe(404);
  });
});
