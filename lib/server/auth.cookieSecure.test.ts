/** Session cookies are Secure in production unless the deployment is plain http. */
import { describe, expect, it } from 'vitest';

import { cookieSecure } from './auth';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe('cookieSecure', () => {
  it('is on in production and off in development by default', () => {
    expect(cookieSecure(env({ NODE_ENV: 'production' }))).toBe(true);
    expect(cookieSecure(env({ NODE_ENV: 'development' }))).toBe(false);
  });

  it('can be turned off for a production build served over plain http', () => {
    expect(cookieSecure(env({ NODE_ENV: 'production', AUTH_COOKIE_SECURE: 'false' }))).toBe(false);
  });

  it('can be forced on, and ignores junk', () => {
    expect(cookieSecure(env({ NODE_ENV: 'development', AUTH_COOKIE_SECURE: 'TRUE' }))).toBe(true);
    expect(cookieSecure(env({ NODE_ENV: 'production', AUTH_COOKIE_SECURE: 'maybe' }))).toBe(true);
  });
});
