/**
 * Host-page actions emitted by the graph.
 *
 * The graph returns an `actions` array on both paths — the `complete` SSE event
 * for a typed turn, and the `actions` envelope for a live-voice turn. Both call
 * `applyHostActions`, so a spoken request performs exactly what the typed
 * equivalent performs; there is no second, voice-only behaviour to drift.
 *
 * `report` actions are not applied here: they are attached to the message bubble
 * by the caller (see `extractReport` in `lib/api.ts`).
 */

/** Navigate only within this app. The URL comes from the model, so an absolute
 *  or protocol-relative one is dropped rather than followed — a spoken sentence
 *  must not be able to send the user off-origin. */
export function safeInternalPath(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  return trimmed;
}

/**
 * Apply the graph's host-page actions. Returns the paths actually navigated to
 * (at most one — the first valid navigation wins; later ones would only cancel it).
 */
export function applyHostActions(actions: unknown, navigate: (path: string) => void): string[] {
  if (!Array.isArray(actions)) return [];
  const applied: string[] = [];
  for (const action of actions) {
    if (!action || typeof action !== 'object') continue;
    const record = action as Record<string, unknown>;
    if (record.type !== 'navigate' || applied.length > 0) continue;
    const path = safeInternalPath(record.url);
    if (!path) continue;
    applied.push(path);
    navigate(path);
  }
  return applied;
}
