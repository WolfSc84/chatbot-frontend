import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy GET /api/tenants -> backend /tenants.
 *
 * Returns the tenants the authenticated caller may select (claim-scoped, or every
 * active tenant when the token carries no membership claim). Drives the frontend
 * tenant selector so onboarding a tenant needs no frontend change. This is a
 * tenant-agnostic discovery call, so no `x-platform-id` is forwarded.
 */
export async function GET(req: Request) {
  const upstream = await fetch(`${getBackendBase()}/tenants`, {
    headers: authHeaders(undefined, undefined, req),
    cache: 'no-store',
  });

  const data = await upstream.json().catch(() => ({ tenants: [] }));
  return Response.json(data, { status: upstream.status });
}
