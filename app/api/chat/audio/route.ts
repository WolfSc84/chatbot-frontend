import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy POST /api/chat/audio -> backend /chat/audio.
 * Injects the bearer token server-side and streams back the MP3 audio so the
 * token is never exposed to the browser.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const product = req.headers.get('x-product');

  const upstream = await fetch(`${getBackendBase()}/chat/audio`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, product, req),
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return Response.json(
      { error: detail || 'Audio synthesis failed.' },
      { status: upstream.status },
    );
  }

  const audio = await upstream.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
