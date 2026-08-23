'use client';

import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAssistant } from '@/context/AssistantContext';
import { IS_L1_SUPPORT_MODE } from '@/lib/flags';

// work email (subdomains allowed). Mirrors the backend guard so an
// invalid identity is rejected before it reaches the tool.
const SUPPORT_EMAIL_RE = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)*example\.com$/;
const NAME_RE = /^[\w .,'-]{1,128}$/u;

/**
 * L1 support-team operator identity gate (L1 variation).
 *
 * When the tool runs in L1 mode and no operator identity is set, this blocking
 * overlay collects the support member's name + work email (client-validated)
 * before the assistant can be used. The identity is stored in the context (and
 * localStorage) and sent to the backend as the support principal. Renders nothing
 * in standard mode or once an operator is set.
 */
export function OperatorIdentityGate() {
  const { operatorReady, setOperator } = useAssistant();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!IS_L1_SUPPORT_MODE || operatorReady) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const em = email.trim().toLowerCase();
    if (!NAME_RE.test(n)) {
      setError('Please enter your name.');
      return;
    }
    if (!SUPPORT_EMAIL_RE.test(em)) {
      setError('Please enter a valid work email (name@example.com).');
      return;
    }
    setError(null);
    setOperator(n, em);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="operator-gate-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <h2 id="operator-gate-title" className="text-lg font-semibold text-gray-900">
              Support agent sign-in
            </h2>
            <p className="text-sm text-gray-500">
              Identify yourself to use the L1 support assistant.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="op-name" className="mb-1 block text-sm font-medium text-gray-700">
              Your name
            </label>
            <input
              id="op-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label htmlFor="op-email" className="mb-1 block text-sm font-medium text-gray-700">
              work email
            </label>
            <input
              id="op-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="jane.doe@example.com"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
          >
            Continue
          </button>
          <p className="text-center text-xs text-gray-400">
            Tickets you open will be filed under your email; the affected end user is recorded
            separately.
          </p>
        </form>
      </div>
    </div>
  );
}
