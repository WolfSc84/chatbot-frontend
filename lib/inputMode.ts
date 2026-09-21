/**
 * Which way the user is talking to the assistant: typed, push-to-talk, or live voice.
 *
 * Before this existed the mode was implicit — live voice was a pair of imperative
 * calls, push-to-talk was a button, and text was whatever was left. Nothing was
 * remembered, so "reopen in the mode I was using" could not work at all.
 *
 * The resolution rules live here as pure functions so each branch can be reasoned
 * about (and exercised) without standing up the whole React context.
 */

export type InputMode = 'text' | 'ptt' | 'live';

const MODES: readonly InputMode[] = ['text', 'ptt', 'live'];

/** localStorage key for the remembered input mode. */
export const MODE_STORAGE_KEY = 'assistant:inputMode';

export function isInputMode(value: unknown): value is InputMode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

/**
 * The remembered mode, or null when nothing usable is stored.
 *
 * Storage throws outright in some privacy modes, and a stored value can be
 * anything if it was hand-edited — both are treated as "no preference recorded"
 * rather than as errors, because neither is worth failing an app open over.
 */
export function readStoredMode(): InputMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    return isInputMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Remember the chosen mode. A refusal to store is not worth surfacing. */
export function storeMode(mode: InputMode): void {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable — the choice still holds for this session */
  }
}

/**
 * The mode a conversation should open in.
 *
 * Order: what the user last chose, then the deployment's configured default,
 * then live voice. Whatever that lands on, live voice is only honored if it can
 * actually run — a user who cannot use it must never be dropped into it, which
 * is the one way a default this opinionated could become a dead end.
 *
 * `voiceAvailable` is deliberately NOT a stored value: permission can be granted
 * or a flag enabled later, so it is re-derived every open and a user who was
 * once unable to use live voice is offered it again once they can.
 */
export function resolveOpeningMode(options: {
  stored: InputMode | null;
  configuredDefault?: string | null;
  voiceAvailable: boolean;
}): InputMode {
  const { stored, configuredDefault, voiceAvailable } = options;
  const preferred: InputMode = stored
    ?? (isInputMode(configuredDefault) ? configuredDefault : null)
    ?? 'live';
  return preferred === 'live' && !voiceAvailable ? 'text' : preferred;
}
