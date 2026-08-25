import { NextResponse } from 'next/server';
import { authApiBase, setSessionCookies } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login — relay credentials to the core's IdP-behind-the-core seam
 * and store the returned tokens as httpOnly cookies. The browser gets no token and
 * never learns which IdP is used; failures are mapped to a generic message.
 */
export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  const upstream = await fetch(`${authApiBase()}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!upstream.ok) {
    // 404 = login disabled on the core; anything else = bad credentials. Never echo
    // the IdP's response body to the browser.
    return NextResponse.json(
      { error: upstream.status === 404 ? 'Login is not enabled' : 'Invalid credentials' },
      { status: upstream.status === 404 ? 404 : 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  setSessionCookies(res, await upstream.json());
  return res;
}
