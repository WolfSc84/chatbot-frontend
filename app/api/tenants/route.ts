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
  // Guarded: ca-ai-core's lifespan waits for the agent tier before it serves, so a
  // login right after the stack starts can hit a socket that refuses. Unguarded this
  // threw and Next returned an opaque 500; 503 is the honest status and the one the
  // client's retry keys on.
  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendBase()}/tenants`, {
      headers: authHeaders(undefined, undefined, req),
      cache: 'no-store',
    });
  } catch {
    return Response.json({ error: 'Tenant discovery unavailable' }, { status: 503 });
  }

  // An unreadable body is a failure, not an empty tenant list — returning
  // `{tenants: []}` with the upstream's 200 made a broken response look like a user
  // who is entitled to nothing, which is exactly the bug this route fed.
  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return Response.json({ error: 'Tenant discovery returned an unreadable body' }, { status: 502 });
  }
  return Response.json(data, { status: upstream.status });
}
