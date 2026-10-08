/**
 * In production with login on, a request without a session never rides the shared
 * platform token (production-readiness phase 10).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const req = () => new Request('http://bff.local/api/tenants');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.resetModules();
  return import('./backend');
}

describe('getBearerToken without a session', () => {
  it('gives nothing in production when login is on', async () => {
    const { getBearerToken } = await load({
      NODE_ENV: 'production',
      NEXT_PUBLIC_AUTH_LOGIN_ENABLED: 'true',
      PLATFORM_BEARER_TOKEN: 'service-account-token',
    });
    expect(getBearerToken(req())).toBe('');
  });

  it('still uses the platform token in local development', async () => {
    const { getBearerToken } = await load({
      NODE_ENV: 'development',
      NEXT_PUBLIC_AUTH_LOGIN_ENABLED: 'true',
      PLATFORM_BEARER_TOKEN: 'service-account-token',
    });
    expect(getBearerToken(req())).toBe('service-account-token');
  });
});
