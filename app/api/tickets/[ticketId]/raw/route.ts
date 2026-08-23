import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy GET /api/tickets/{id}/raw -> backend /tickets/{id}/raw. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const product = req.headers.get('x-product');
  const upstream = await fetch(
    `${getBackendBase()}/tickets/${encodeURIComponent((await params).ticketId)}/raw`,
    { headers: authHeaders(undefined, product, req), cache: 'no-store' },
  );

  const data = await upstream.json().catch(() => ({}));
  return Response.json(data, { status: upstream.status });
}
