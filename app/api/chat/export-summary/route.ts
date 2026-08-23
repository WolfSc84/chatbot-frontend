import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy POST /api/chat/export-summary -> backend /chat/export-summary.
 * Injects the bearer token server-side and returns the professional summary JSON.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const product = req.headers.get('x-product');

  const upstream = await fetch(`${getBackendBase()}/chat/export-summary`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, product, req),
    body: JSON.stringify(body),
  });

  const data = await upstream.json().catch(() => ({ content: '' }));
  return Response.json(data, { status: upstream.status });
}
