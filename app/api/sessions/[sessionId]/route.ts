import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy DELETE /api/sessions/{id} -> backend /sessions/{id}. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const product = req.headers.get('x-product');
  const upstream = await fetch(
    `${getBackendBase()}/sessions/${encodeURIComponent((await params).sessionId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(undefined, product, req),
    },
  );

  const data = await upstream.json().catch(() => ({}));
  return Response.json(data, { status: upstream.status });
}
