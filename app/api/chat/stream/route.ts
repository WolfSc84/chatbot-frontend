import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy POST /api/chat/stream -> backend /chat/stream, piping the SSE stream. */
export async function POST(req: Request) {
  const body = await req.text();
  const product = req.headers.get('x-product');

  const upstream = await fetch(`${getBackendBase()}/chat/stream`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, product, req),
    body,
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return new Response(detail || 'Upstream chat request failed', {
      status: upstream.status || 502,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
