import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy POST /api/chat/transcribe/correct -> backend /chat/transcribe/correct. */
export async function POST(req: Request) {
  const body = await req.json();
  const product = req.headers.get('x-product');

  const upstream = await fetch(`${getBackendBase()}/chat/transcribe/correct`, {
    method: 'POST',
    headers: { ...authHeaders(undefined, product, req), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    // Gracefully fall back — return original text so the user is never blocked
    const original = (body as { text?: string }).text ?? '';
    return Response.json({ text: original }, { status: 200 });
  }

  const payload = await upstream.json();
  return Response.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
