/**
 * Client/runtime feature flags for the simulator.
 *
 * Flags are sourced from `NEXT_PUBLIC_*` env vars so they are inlined at build
 * time and readable in the browser. Only an explicit truthy value enables a
 * flag; anything else (including unset) is the secure default (off).
 */

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

function isEnvTruthy(value: string | undefined): boolean {
  return TRUTHY.has((value ?? '').trim().toLowerCase());
}

/**
 * L1 support-team tool mode (see the variation plan). When true the simulator
 * requires an operator identity (name + work email) on open, forwards the
 * support identity to the proxy, and hides live-data feature entry points while
 * keeping troubleshooting + ticketing. Mirrors the backend `L1_SUPPORT_MODE`.
 */
export const IS_L1_SUPPORT_MODE = isEnvTruthy(process.env.NEXT_PUBLIC_L1_SUPPORT_MODE);

/**
 * Real end-user login (IdP behind the core). When true the app requires a signed-in
 * session — middleware redirects unauthenticated visitors to `/login` and refreshes
 * expiring tokens — and the assistant shows a sign-out control. When false the app
 * uses the static dev bearer token (back-compat), so login is strictly opt-in.
 * Mirrors the core's `AUTH_LOGIN_ENABLED`.
 */
export const IS_LOGIN_ENABLED = isEnvTruthy(process.env.NEXT_PUBLIC_AUTH_LOGIN_ENABLED);
