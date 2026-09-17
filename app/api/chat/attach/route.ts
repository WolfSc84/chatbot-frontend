import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy POST /api/chat/attach -> backend /chat/attach.
 * Forwards the multipart file upload and injects the bearer token server-side.
 * The backend fail-closes to a 403 for any tenant lacking the file_context capability.
 */
export async function POST(req: Request) {
  const formData = await req.formData();
  const product = req.headers.get('x-product');

  const upstream = await fetch(`${getBackendBase()}/chat/attach`, {
    method: 'POST',
    headers: authHeaders(undefined, product, req),
    body: formData,
  });

  if (!upstream.ok) {
    let detail = '';
    try {
      const data = (await upstream.json()) as { detail?: string; error?: string };
      detail = data.detail ?? data.error ?? '';
    } catch {
      detail = await upstream.text().catch(() => '');
    }

    return Response.json(
      { error: detail || 'File attachment failed.' },
      { status: upstream.status },
    );
  }

  const payload = await upstream.json();
  return Response.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
