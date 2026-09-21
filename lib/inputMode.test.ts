/**
 * These branches were specified with "verify with its own test" and, for want of
 * a runner, verified by hand in a browser instead. Now they are real.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MODE_STORAGE_KEY,
  isInputMode,
  readStoredMode,
  resolveOpeningMode,
  storeMode,
} from './inputMode';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('resolveOpeningMode', () => {
  it('opens a first-time conversation in live voice', () => {
    expect(resolveOpeningMode({ stored: null, voiceAvailable: true })).toBe('live');
  });

  it('honours what the user last chose over the default', () => {
    expect(resolveOpeningMode({ stored: 'text', voiceAvailable: true })).toBe('text');
    expect(resolveOpeningMode({ stored: 'ptt', voiceAvailable: true })).toBe('ptt');
  });

  it('never drops a user into live voice they cannot use', () => {
    expect(resolveOpeningMode({ stored: 'live', voiceAvailable: false })).toBe('text');
    expect(resolveOpeningMode({ stored: null, voiceAvailable: false })).toBe('text');
  });

  it('lets a deployment change the default without a deploy of code', () => {
    expect(
      resolveOpeningMode({ stored: null, configuredDefault: 'text', voiceAvailable: true }),
    ).toBe('text');
  });

  it('ignores a configured default that is not a mode', () => {
    expect(
      resolveOpeningMode({ stored: null, configuredDefault: 'telepathy', voiceAvailable: true }),
    ).toBe('live');
  });

  it('prefers the remembered choice over the configured default', () => {
    expect(
      resolveOpeningMode({ stored: 'ptt', configuredDefault: 'text', voiceAvailable: true }),
    ).toBe('ptt');
  });
});

describe('readStoredMode', () => {
  it('returns what was stored', () => {
    window.localStorage.setItem(MODE_STORAGE_KEY, 'ptt');
    expect(readStoredMode()).toBe('ptt');
  });

  it('treats a hand-edited junk value as no preference', () => {
    window.localStorage.setItem(MODE_STORAGE_KEY, 'shouting');
    expect(readStoredMode()).toBeNull();
  });

  it('treats storage that throws as no preference rather than crashing the app', () => {
    // Private-mode browsers throw on access. This branch was previously covered
    // by inspection only, because there was no way to run it.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });
    expect(readStoredMode()).toBeNull();
  });
});

describe('storeMode', () => {
  it('remembers the choice', () => {
    storeMode('live');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('live');
  });

  it('does not throw when storage refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => storeMode('live')).not.toThrow();
  });
});

describe('isInputMode', () => {
  it('accepts the three modes and nothing else', () => {
    expect(['text', 'ptt', 'live'].every(isInputMode)).toBe(true);
    expect([null, undefined, '', 'LIVE', 42].some(isInputMode)).toBe(false);
  });
});
