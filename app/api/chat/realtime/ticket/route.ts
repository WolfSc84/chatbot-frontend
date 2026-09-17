import { authHeaders, getBackendBase, getBackendOrigin } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy POST /api/chat/realtime/ticket -> backend /chat/realtime/ticket.
 *
 * Live voice is the one path the browser opens directly against `ca-ai-core`: a
 * Next.js Route Handler cannot proxy a WebSocket (the installed Next docs say so
 * outright — `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`).
 * So the bearer stays here, on the server, and the browser is handed a single-use
 * ticket plus the socket URL instead. Nothing bearer-shaped crosses this boundary.
 */
export async function POST(req: Request) {
  const product = req.headers.get('x-product');

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { thread_id, reply_language, current_page } = (body ?? {}) as Record<string, unknown>;

  const upstream = await fetch(`${getBackendBase()}/chat/realtime/ticket`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, product, req),
    body: JSON.stringify({ thread_id, reply_language, current_page }),
  });

  if (!upstream.ok) {
    let detail = '';
    try {
      const data = (await upstream.json()) as { detail?: string; error?: string };
      detail = data.detail ?? data.error ?? '';
    } catch {
      detail = await upstream.text().catch(() => '');
    }
    // 404 is the flag-off answer: core hides the endpoint entirely when
    // REALTIME_VOICE_ENABLED is false. The client degrades to push-to-talk.
    return Response.json(
      { error: detail || 'Live voice is unavailable.' },
      { status: upstream.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const data = (await upstream.json()) as {
    ticket: string;
    expires_in: number;
    thread_id: string;
    socket_path: string;
  };

  return Response.json(
    {
      ticket: data.ticket,
      expires_in: data.expires_in,
      thread_id: data.thread_id,
      // Core answers with the path it was called on; the origin is server-side
      // config the browser never sees otherwise.
      socket_url: `${getBackendOrigin().replace(/^http/, 'ws')}${data.socket_path}`,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
