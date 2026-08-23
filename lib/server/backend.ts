import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Server-only helpers for talking to the platform backend.
 *
 * The bearer token is never exposed to the browser. It is resolved on the
 * server from (in priority order):
 *   1. PLATFORM_BEARER_TOKEN / NEXT_PUBLIC_DEV_TOKEN env var, or
 *   2. the repo-root `.env` file one directory up (single source of truth).
 */

export function getBackendBase(): string {
  return (
    process.env.BACKEND_API_BASE ??
    process.env.NEXT_PUBLIC_API_BASE ??
    'http://localhost:5600/api/v1/agent'
  );
}

/**
 * Origin (scheme + host + port) of the backend, e.g. `http://localhost:5600`.
 * Used by endpoints that live at the server root (`/health`, `/admin/restart`).
 */
export function getBackendOrigin(): string {
  const explicit = process.env.BACKEND_URL;
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/+$/, '');
  try {
    return new URL(getBackendBase()).origin;
  } catch {
    return 'http://localhost:5600';
  }
}

function readTokenFromBackendEnv(): string {
  // Try the repo-root .env (sibling of the web_interface folder) and the
  // current working directory, so it works regardless of where Next.js starts.
  const candidates = [join(process.cwd(), '..', '.env'), join(process.cwd(), '.env')];

  for (const path of candidates) {
    try {
      const content = readFileSync(path, 'utf8');
      const match = content.match(
        /^\s*(?:PLATFORM_BEARER_TOKEN|NEXT_PUBLIC_DEV_TOKEN)\s*=\s*(.+)\s*$/m,
      );
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      // file not found / unreadable -- try next candidate
    }
  }
  return '';
}

export function getBearerToken(): string {
  const fromEnv = process.env.PLATFORM_BEARER_TOKEN ?? process.env.NEXT_PUBLIC_DEV_TOKEN;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return readTokenFromBackendEnv();
}

/**
 * Multi-tenant routing.
 *
 * The browser sends the selected product as an `x-product` request header to the
 * Next.js proxy. The proxy is the single trust boundary: it validates that value
 * here and translates it into the backend's canonical `x-platform-id` header.
 * A raw client value is never forwarded downstream — an unknown/malformed tenant
 * fails closed to a safe default so strict backend enforcement is never bypassed.
 */
export const ALLOWED_TENANTS = ['sales', 'knowledge_center'] as const;
export const TENANT_ID_RE = /^[a-z0-9_]{1,64}$/;

/**
 * Resolve a client-supplied product into a validated tenant id.
 * Trims + lowercases, then requires both the `^[a-z0-9_]{1,64}$` shape and
 * membership in {@link ALLOWED_TENANTS}. Anything else falls back to
 * `NEXT_PUBLIC_DEFAULT_TENANT` (default `sales`) — fail closed, degrade safe.
 */
export function resolveTenant(product?: string | null): string {
  const fallback = process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? 'sales';
  const candidate = (product ?? '').trim().toLowerCase();
  if (
    TENANT_ID_RE.test(candidate) &&
    (ALLOWED_TENANTS as readonly string[]).includes(candidate)
  ) {
    return candidate;
  }
  return fallback;
}

/** Build the backend tenant header from a (validated) product value. */
export function tenantHeaders(product?: string | null): Record<string, string> {
  return { 'x-platform-id': resolveTenant(product) };
}

/**
 * L1 support-team operator identity forwarding (L1 variation).
 *
 * The browser sends the operator's identity as `x-support-name` / `x-support-email`.
 * The proxy validates them (same shape the backend enforces) and translates them
 * into the backend `x-support-name` / `x-support-email` headers. A value that
 * fails validation is dropped (never forwarded), so the backend still fails closed.
 */
export const SUPPORT_NAME_RE = /^[\w .,'\-]{1,128}$/u;
export const SUPPORT_EMAIL_RE = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)*example\.com$/;

export function supportHeaders(
  name?: string | null,
  email?: string | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const n = (name ?? '').trim();
  const e = (email ?? '').trim().toLowerCase();
  if (n && SUPPORT_NAME_RE.test(n)) out['x-support-name'] = n;
  if (e && SUPPORT_EMAIL_RE.test(e)) out['x-support-email'] = e;
  return out;
}

/**
 * Server-side headers for a backend call.
 *
 * - Always injects the bearer token (never exposed to the browser). In L1 mode a
 *   token may be absent; the backend authenticates via the support-identity
 *   headers instead, so a missing token is fine.
 * - When a `product` argument is supplied (a string or explicit `null`), a
 *   validated `x-platform-id` tenant header is added. Passing `null` yields
 *   the default tenant, which is what pre-product calls (warmup/login/logout)
 *   rely on. Omitting the argument entirely adds no tenant header (back-compat).
 * - When the incoming proxy `req` is supplied, the validated support-identity
 *   headers are forwarded (L1 variation); ignored in standard mode by the backend.
 */
export function authHeaders(
  extra?: Record<string, string>,
  product?: string | null,
  req?: Request,
): Record<string, string> {
  const token = getBearerToken();
  const support = req
    ? supportHeaders(req.headers.get('x-support-name'), req.headers.get('x-support-email'))
    : {};
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(product !== undefined ? tenantHeaders(product) : {}),
    ...support,
    ...extra,
  };
}
