import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy GET /api/sessions/{id}/messages -> backend /sessions/{id}/messages. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const product = req.headers.get('x-product');
  const upstream = await fetch(
    `${getBackendBase()}/sessions/${encodeURIComponent((await params).sessionId)}/messages`,
    {
      headers: authHeaders(undefined, product, req),
    },
  );

  const data = await upstream.json().catch(() => ({ messages: [] }));
  return Response.json(data, { status: upstream.status });
}
