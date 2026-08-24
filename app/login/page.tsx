'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Sign-in page for the IdP-behind-the-core flow. Credentials go to the BFF
 * (`/api/auth/login`), which relays them to the core; the browser never talks to
 * the identity provider directly. On success the session cookies are set and we
 * navigate to the app (a full reload so middleware re-evaluates the session).
 */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.replace('/');
        router.refresh();
        return;
      }
      setError(res.status === 404 ? 'Login is not enabled.' : 'Invalid username or password.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg ring-1 ring-gray-200"
      >
        <h1 className="text-xl font-bold text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">Enter your credentials to continue.</p>

        <label className="mt-6 block text-sm font-medium text-gray-700" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
        />

        <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
        />

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
