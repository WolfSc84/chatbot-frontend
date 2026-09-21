import '@testing-library/jest-dom/vitest';

/**
 * jsdom exposes `localStorage`, but it does not survive the way the test runner
 * populates globals: `'localStorage' in window` is true while reading it yields
 * undefined. Rather than skip every storage branch — which is exactly the code
 * that shipped unverified and is the reason this runner exists — install a real
 * Map-backed Storage.
 *
 * The methods go on `Storage.prototype` deliberately, so a test can still
 * `vi.spyOn(Storage.prototype, 'getItem')` to simulate a browser that refuses
 * storage access.
 */
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>();

  Storage.prototype.getItem = function getItem(key: string): string | null {
    return store.has(key) ? (store.get(key) as string) : null;
  };
  Storage.prototype.setItem = function setItem(key: string, value: string): void {
    store.set(key, String(value));
  };
  Storage.prototype.removeItem = function removeItem(key: string): void {
    store.delete(key);
  };
  Storage.prototype.clear = function clear(): void {
    store.clear();
  };

  Object.defineProperty(window, 'localStorage', {
    value: Object.create(Storage.prototype) as Storage,
    configurable: true,
  });
}
