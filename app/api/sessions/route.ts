import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy GET /api/sessions -> backend /sessions. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get('limit') ?? '50';
  const product = req.headers.get('x-product');

  const upstream = await fetch(`${getBackendBase()}/sessions?limit=${encodeURIComponent(limit)}`, {
    headers: authHeaders(undefined, product, req),
  });

  const data = await upstream.json().catch(() => ({ sessions: [] }));
  return Response.json(data, { status: upstream.status });
}
