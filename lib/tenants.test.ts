/**
 * getTenants must tell a transient failure apart from "this user has no tenants".
 *
 * It used to return [] for every non-401 failure. The caller wrote that into state
 * once on mount and never asked again, so a single 500/503/429 or dropped connection
 * left the product selector permanently empty until the page was reloaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTenants, SessionExpiredError, TenantsUnavailableError } from './api';

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getTenants', () => {
  it('returns the tenants on success', async () => {
    respondWith(200, { tenants: [{ id: 'sales', display_name: 'Sales' }] });

    await expect(getTenants()).resolves.toEqual([{ id: 'sales', label: 'Sales' }]);
  });

  it('returns an empty list when the user genuinely has none', async () => {
    respondWith(200, { tenants: [] });

    await expect(getTenants()).resolves.toEqual([]);
  });

  it.each([500, 502, 503, 429, 400])('throws a retryable error on HTTP %i', async (status) => {
    respondWith(status, { error: 'nope' });

    await expect(getTenants()).rejects.toBeInstanceOf(TenantsUnavailableError);
  });

  it('throws a retryable error when the connection drops', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(getTenants()).rejects.toBeInstanceOf(TenantsUnavailableError);
  });

  it('still reports an expired session distinctly, so the banner keeps working', async () => {
    respondWith(401, { error: 'Not authenticated' });

    await expect(getTenants()).rejects.toBeInstanceOf(SessionExpiredError);
  });
});
