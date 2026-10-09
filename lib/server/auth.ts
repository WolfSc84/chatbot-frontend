import { NextResponse } from 'next/server';

/**
 * Server-side session plumbing for the IdP-behind-the-core login flow.
 *
 * The browser never sees the identity provider. It posts credentials to the BFF
 * (`/api/auth/login`), which relays them to the core's `/auth` API; the returned
 * tokens are stored as httpOnly cookies here and injected into downstream backend
 * calls server-side. Swapping Keycloak for another IdP is a core-adapter change —
 * this layer only moves opaque tokens, so it stays vendor-agnostic.
 *
 * Edge-safe (no `fs`) so Next.js middleware can import it for transparent refresh.
 */

export const ACCESS_COOKIE = 'ca_access';
export const REFRESH_COOKIE = 'ca_refresh';

export type TokenSet = {
  access_token: string;
  refresh_token?: string | null;
  expires_in: number;
  token_type?: string;
};

/**
 * Base URL of the core's auth API, derived from the agent base so no new env var
 * is introduced: `.../api/v1/agent` → `.../api/v1/auth` (the core mounts `/auth`
 * alongside `/agent`).
 */
export function authApiBase(): string {
  const base =
    process.env.BACKEND_API_BASE ??
    process.env.NEXT_PUBLIC_API_BASE ??
    'http://localhost:5600/api/v1/agent';
  return base.replace(/\/agent\/?$/, '/auth');
}

/** Read a single cookie value from an incoming request (Node or Edge runtime). */
export function readCookie(req: Request | undefined, name: string): string {
  const header = req?.headers.get('cookie');
  if (!header) return '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return '';
}

// httpOnly keeps tokens out of JS; sameSite=lax survives top-level nav. The refresh
// cookie is a session cookie (no maxAge) so it lives until the browser closes; the
// access cookie expires with the token so middleware knows when to refresh.
//
// secure: on in production, off in dev. AUTH_COOKIE_SECURE overrides it — set it to
// "false" for a production build served over plain http (the local container stack):
// Safari drops Secure cookies on http://localhost, so login "succeeded" and bounced
// straight back to the login page (Chromium treats localhost as secure, hiding it).
export function cookieSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  const override = (env.AUTH_COOKIE_SECURE ?? '').trim().toLowerCase();
  if (override === 'false') return false;
  if (override === 'true') return true;
  return env.NODE_ENV === 'production';
}
const secure = cookieSecure();
const BASE_COOKIE = { httpOnly: true, sameSite: 'lax', secure, path: '/' } as const;

/** Persist a token set as httpOnly cookies on a response. */
export function setSessionCookies(res: NextResponse, tokens: TokenSet): void {
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, { ...BASE_COOKIE, maxAge: tokens.expires_in });
  if (tokens.refresh_token) {
    res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, BASE_COOKIE);
  }
}

/** Expire both session cookies (logout / failed refresh). */
export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, '', { ...BASE_COOKIE, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...BASE_COOKIE, maxAge: 0 });
}
