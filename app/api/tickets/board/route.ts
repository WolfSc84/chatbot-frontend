import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy GET /api/tickets/board -> backend /tickets/board (forwards q & sort). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const sort = url.searchParams.get('sort') ?? 'newest';

  const params = new URLSearchParams({ sort });
  if (q) params.set('q', q);
  const product = req.headers.get('x-product');

  const upstream = await fetch(
    `${getBackendBase()}/tickets/board?${params.toString()}`,
    { headers: authHeaders(undefined, product, req), cache: 'no-store' },
  );

  const data = await upstream
    .json()
    .catch(() => ({ tickets: [], board: { open: [], in_progress: [], done: [] }, counts: { open: 0, in_progress: 0, done: 0, total: 0 } }));
  return Response.json(data, { status: upstream.status });
}
