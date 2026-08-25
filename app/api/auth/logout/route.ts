import { NextResponse } from 'next/server';
import { authApiBase, clearSessionCookies, readCookie, REFRESH_COOKIE } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout — best-effort server-side token revocation, then clear the
 * session cookies. The browser session ends regardless of whether revocation
 * succeeds. (Distinct from `/api/chat/logout`, which only evicts the prompt cache.)
 */
export async function POST(req: Request) {
  const refresh = readCookie(req, REFRESH_COOKIE);
  if (refresh) {
    try {
      await fetch(`${authApiBase()}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch {
      // Revocation is best-effort; the local session ends either way.
    }
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}
