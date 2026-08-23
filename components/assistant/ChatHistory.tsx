'use client';

import { MessageSquare, Trash2, ChevronLeft, History, UserRound } from 'lucide-react';
import type { SessionInfo } from '@/lib/types';

function formatRelative(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const time = date
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
    .replace(' ', '');

  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );

  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Yesterday ${time}`;
  if (dayDiff < 7) return `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

interface ChatHistoryProps {
  sessions: SessionInfo[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onOpen: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

/** Presentation for a tenant tag pill (label + colors). */
const TENANT_TAG: Record<string, { label: string; className: string }> = {
  sales: { label: 'Sales', className: 'bg-accent-100 text-accent-700' },
  knowledge_center: { label: 'Knowledge Center', className: 'bg-indigo-100 text-indigo-700' },
};

function tenantOf(session: SessionInfo): string | null {
  if (session.application_id) return session.application_id;
  const i = session.session_id.indexOf('::');
  return i > 0 ? session.session_id.slice(0, i) : null;
}

export function ChatHistory({
  sessions,
  loading,
  error,
  onBack,
  onOpen,
  onDelete,
}: ChatHistoryProps) {
  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:text-accent-500"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      {loading && <p className="py-10 text-center text-sm text-gray-400">Loading history…</p>}

      {error && !loading && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <History className="mb-2 h-6 w-6" />
          <p className="text-sm">No previous conversations yet</p>
        </div>
      )}

      {!loading &&
        sessions.map((session) => (
          <div
            key={session.session_id}
            className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 transition-colors hover:border-accent-400 hover:bg-accent-50/40"
          >
            <button
              onClick={() => onOpen(session.session_id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <MessageSquare className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-800">
                  {session.title || session.last_message || 'Conversation'}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2">
                  {(() => {
                    const tenant = tenantOf(session);
                    const tag = tenant ? TENANT_TAG[tenant] : null;
                    return tag ? (
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tag.className}`}
                      >
                        {tag.label}
                      </span>
                    ) : null;
                  })()}
                  {session.user_affected ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                      title={`Affected user: ${session.user_affected}`}
                    >
                      <UserRound className="h-2.5 w-2.5" />
                      <span className="max-w-[140px] truncate">{session.user_affected}</span>
                    </span>
                  ) : null}
                  <span className="block text-xs text-gray-400">
                    {formatRelative(session.updated_at || session.created_at)}
                  </span>
                </span>
              </span>
            </button>
            <button
              onClick={() => onDelete(session.session_id)}
              aria-label="Delete conversation"
              className="shrink-0 rounded p-1.5 text-gray-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
    </div>
  );
}
