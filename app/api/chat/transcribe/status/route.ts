import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy GET /api/chat/transcribe/status -> backend /chat/transcribe/status. */
export async function GET(req: Request) {
  try {
    const upstream = await fetch(`${getBackendBase()}/chat/transcribe/status`, {
      method: 'GET',
      headers: authHeaders(undefined, undefined, req),
    });

    if (!upstream.ok) {
      return Response.json({ available: false, reason: 'backend_error' }, { status: 200 });
    }

    const payload = await upstream.json();
    return Response.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ available: false, reason: 'unreachable' }, { status: 200 });
  }
}
