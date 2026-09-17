import { authHeaders, getBackendBase } from '@/lib/server/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy POST /api/chat/report -> backend /chat/report.
 * Injects the bearer token server-side and streams back the rendered report file
 * (PDF/Excel/Word), preserving the download filename. Sales-gated server-side
 * (403 for tenants without the `reporting` capability).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const product = req.headers.get('x-product');

  const upstream = await fetch(`${getBackendBase()}/chat/report`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }, product, req),
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return Response.json(
      { error: detail || 'Report generation failed.' },
      { status: upstream.status },
    );
  }

  const file = await upstream.arrayBuffer();
  return new Response(file, {
    status: 200,
    headers: {
      'Content-Type':
        upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition':
        upstream.headers.get('content-disposition') ?? 'attachment; filename="report"',
      'Cache-Control': 'no-store',
    },
  });
}
