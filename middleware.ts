import { NextResponse, type NextRequest } from 'next/server';
import { IS_LOGIN_ENABLED } from '@/lib/flags';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  authApiBase,
  clearSessionCookies,
  setSessionCookies,
} from '@/lib/server/auth';

/**
 * Session gate for the IdP-behind-the-core login flow. When login is enabled it is
 * the single choke point that (a) transparently refreshes an expired access token
 * from the refresh token and (b) sends unauthenticated visitors to `/login`.
 *
 * Excludes the login page, the auth API, and Next internals so they stay reachable
 * while unauthenticated.
 */
export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req: NextRequest) {
  if (!IS_LOGIN_ENABLED) return NextResponse.next();

  if (req.cookies.get(ACCESS_COOKIE)?.value) return NextResponse.next();

  const isApi = req.nextUrl.pathname.startsWith('/api');
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  // ponytail: no cross-request refresh dedup. With refresh-token *rotation* on
  // (Keycloak "Revoke Refresh Token" — off by default), concurrent tabs can race
  // and the losers fail refresh → land on /login. Acceptable for the local MVP;
  // upgrade path is a short-lived refresh lock/cache if rotation is enabled.
  if (refresh) {
    try {
      const upstream = await fetch(`${authApiBase()}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (upstream.ok) {
        const tokens = await upstream.json();
        // Trust the core's response as untrusted input: a 200 with a missing/empty
        // access_token would otherwise write the literal cookie "undefined" (truthy),
        // wedging the session forever since refresh never runs again. Fail closed.
        if (tokens?.access_token && Number(tokens.expires_in) > 0) {
          // Inject the fresh token into THIS request so the route handler sees it,
          // and set the new cookies on the response for subsequent requests.
          const headers = new Headers(req.headers);
          const cookie = headers.get('cookie') ?? '';
          headers.set(
            'cookie',
            `${cookie}${cookie ? '; ' : ''}${ACCESS_COOKIE}=${encodeURIComponent(tokens.access_token)}`,
          );
          const res = NextResponse.next({ request: { headers } });
          setSessionCookies(res, tokens);
          return res;
        }
      }
    } catch {
      // Fall through to re-login below.
    }
  }

  // No valid session: reject API calls, redirect page loads to /login.
  const res = isApi
    ? NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    : NextResponse.redirect(new URL('/login', req.url));
  clearSessionCookies(res);
  return res;
}
