import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy POST /api/chat/warmup -> backend /chat/warmup (pre-cache welcome prompts). */
export async function POST(req: Request) {
  const body = await req.text();
  const product = req.headers.get('x-product');

  const upstream = await fetch(`${getBackendBase()}/chat/warmup`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, product, req),
    body,
  });

  const detail = await upstream.text().catch(() => '');
  return new Response(detail || '', {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
