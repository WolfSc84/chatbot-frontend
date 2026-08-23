import { NextResponse } from 'next/server';
import { getBackendOrigin } from '@/lib/server/backend';

/** Proxy /health to the FastAPI backend so the settings page can poll it
 *  without CORS issues. Used by SettingsPage.waitForBackend(). */
export async function GET() {
  const backendUrl = getBackendOrigin();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${backendUrl}/health`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) {
      return NextResponse.json({ status: 'unhealthy' }, { status: 503 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 503 });
  }
}
