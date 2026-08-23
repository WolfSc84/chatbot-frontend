'use client';

import { useEffect, useMemo } from 'react';
import { ChevronLeft, FileJson, Ticket, UserRound } from 'lucide-react';
import { useAssistant } from '@/context/AssistantContext';
import type { StatCardData, TicketItem } from '@/lib/types';
import { DEMO_TICKET_BOARD } from '@/lib/mockTickets';
import { StatCard } from '@/components/dashboard/StatCard';
import { RawTicketModal } from './RawTicketModal';

function statusBadgeClass(bucket: string): string {
  switch (bucket) {
    case 'done':
      return 'bg-emerald-50 text-emerald-600';
    case 'in_progress':
      return 'bg-amber-50 text-amber-600';
    default:
      return 'bg-accent-50 text-accent-600';
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TicketBoard({ onBack }: { onBack: () => void }) {
  const {
    ticketBoard,
    ticketsLoading,
    ticketsError,
    ticketSearch,
    setTicketSearch,
    ticketSort,
    setTicketSort,
    selectedTicketId,
    setSelectedTicketId,
    loadTickets,
    rawTicket,
    rawTicketLoading,
    loadRawTicket,
    clearRawTicket,
  } = useAssistant();

  // Debounced (re)load when search/sort change, plus initial load.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadTickets();
    }, 400);
    return () => clearTimeout(timer);
  }, [loadTickets]);

  // No live tickets yet (SysAid credentials not wired up, or nothing filed for
  // this demo tenant) — show sample data instead of an empty panel. Switches
  // back to live data automatically the moment the backend returns tickets.
  const usingDemoData = !ticketsLoading && (ticketBoard?.counts.total ?? 0) === 0;
  const effectiveBoard = usingDemoData ? DEMO_TICKET_BOARD : ticketBoard;

  const openTickets: TicketItem[] = effectiveBoard?.board.open ?? [];
  const counts = effectiveBoard?.counts;
  const selected =
    effectiveBoard?.tickets.find((t) => t.local_id === selectedTicketId) ?? null;
  const showRaw = rawTicketLoading || rawTicket !== null;

  const stats: StatCardData[] = useMemo(
    () => [
      {
        id: 'open',
        label: 'Open',
        value: counts?.open ?? 0,
        sublabel: 'Awaiting action',
        icon: 'Ticket',
        iconColor: 'text-accent-500',
      },
      {
        id: 'in_progress',
        label: 'In Progress',
        value: counts?.in_progress ?? 0,
        sublabel: 'Being worked',
        icon: 'Clock3',
        iconColor: 'text-amber-500',
      },
      {
        id: 'done',
        label: 'Done',
        value: counts?.done ?? 0,
        sublabel: 'Resolved',
        icon: 'CheckCircle2',
        iconColor: 'text-emerald-500',
      },
    ],
    [counts],
  );

  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:text-accent-500"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <h2 className="text-lg font-semibold text-gray-800">Ticket Dashboard</h2>

      <div className="flex items-center gap-2">
        <input
          value={ticketSearch}
          onChange={(e) => setTicketSearch(e.target.value)}
          placeholder="Search tickets…"
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
        />
        <select
          value={ticketSort}
          onChange={(e) => setTicketSort(e.target.value as 'newest' | 'oldest' | 'id')}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="id">ID</option>
        </select>
      </div>

      {usingDemoData && (
        <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Demo Data
        </span>
      )}

      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <StatCard key={stat.id} data={stat} />
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className={`rounded px-2 py-0.5 font-medium ${statusBadgeClass('open')}`}>
          Open {counts?.open ?? 0}
        </span>
        <span className="text-gray-400">of {counts?.total ?? 0} total</span>
      </div>

      {ticketsLoading && (
        <p className="py-10 text-center text-sm text-gray-400">Loading tickets…</p>
      )}

      {usingDemoData && !ticketsLoading && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {ticketsError
            ? `Could not reach the live ticket service (${ticketsError}). Showing sample tickets instead.`
            : 'No live tickets yet — showing sample tickets so you can preview the dashboard.'}
        </p>
      )}

      {!ticketsLoading && openTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <Ticket className="mb-2 h-6 w-6" />
          <p className="text-sm">No open tickets</p>
        </div>
      )}

      {!ticketsLoading &&
        openTickets.map((ticket) => {
          const isSelected = ticket.local_id === selectedTicketId;
          return (
            <div key={ticket.local_id}>
              <button
                onClick={() => setSelectedTicketId(isSelected ? null : ticket.local_id)}
                className={`group flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-3 text-left transition-colors ${
                  isSelected
                    ? 'border-accent-400 bg-accent-50/40'
                    : 'border-gray-200 hover:border-accent-400 hover:bg-accent-50/40'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                  <Ticket className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800">
                    {ticket.title || ticket.local_id}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs text-gray-400">
                      {ticket.local_id}
                      {ticket.category ? ` · ${ticket.category}` : ''}
                    </span>
                    {ticket.affected_user ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                        title={`Affected user: ${ticket.affected_user}`}
                      >
                        <UserRound className="h-2.5 w-2.5" />
                        <span className="max-w-[140px] truncate">{ticket.affected_user}</span>
                      </span>
                    ) : null}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
                    ticket.status_bucket,
                  )}`}
                >
                  {ticket.status}
                </span>
              </button>

              {isSelected && (
                <div className="mt-1 rounded-xl border border-gray-200 bg-white px-3 py-3">
                  {ticket.description && (
                    <p className="mb-3 whitespace-pre-wrap text-sm text-gray-700">
                      {ticket.description}
                    </p>
                  )}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-gray-400">Category</dt>
                    <dd className="text-gray-700">{ticket.category ?? '—'}</dd>
                    <dt className="text-gray-400">Intent</dt>
                    <dd className="text-gray-700">{ticket.intent_type ?? '—'}</dd>
                    <dt className="text-gray-400">Reported by</dt>
                    <dd className="truncate text-gray-700">{ticket.reported_by ?? '—'}</dd>
                    <dt className="text-gray-400">Affected user</dt>
                    <dd className="truncate text-gray-700">{ticket.affected_user ?? '—'}</dd>
                    <dt className="text-gray-400">Created</dt>
                    <dd className="text-gray-700">{formatDate(ticket.created_at) || '—'}</dd>
                  </dl>
                  <button
                    onClick={() => (usingDemoData ? undefined : loadRawTicket(ticket.local_id))}
                    disabled={usingDemoData}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title={usingDemoData ? 'Raw JSON is unavailable for sample tickets' : undefined}
                  >
                    <FileJson className="h-3.5 w-3.5" />
                    View Raw JSON
                  </button>
                </div>
              )}
            </div>
          );
        })}

      {showRaw && (
        <RawTicketModal data={rawTicket} loading={rawTicketLoading} onClose={clearRawTicket} />
      )}
    </div>
  );
}
