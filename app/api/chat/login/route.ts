import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy POST /api/chat/login -> backend /chat/login (reload slow prompts into cache). */
export async function POST(req: Request) {
  const product = req.headers.get('x-product');
  const upstream = await fetch(`${getBackendBase()}/chat/login`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, product, req),
  });

  const detail = await upstream.text().catch(() => '');
  return new Response(detail || '', {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
