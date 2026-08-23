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
