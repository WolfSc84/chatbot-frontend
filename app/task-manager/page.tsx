'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  FileJson,
  RefreshCw,
  Search,
  Ticket as TicketIcon,
  UserRound,
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { RawTicketModal } from '@/components/assistant/RawTicketModal';
import { getRawTicket, getTicketBoard } from '@/lib/api';
import { DEMO_TICKET_BOARD } from '@/lib/mockTickets';
import type { StatCardData, TicketBoardResponse, TicketItem, TicketSort } from '@/lib/types';

const AUTO_REFRESH_MS = 30_000;

type StatusTab = 'all' | 'open' | 'in_progress' | 'done';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

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

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TaskManagerPage() {
  const [board, setBoard] = useState<TicketBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TicketSort>('newest');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [rawTicket, setRawTicket] = useState<unknown>(null);
  const [rawLoading, setRawLoading] = useState(false);

  const fetchBoard = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getTicketBoard(search.trim(), sort);
      // No real tickets yet (e.g. SysAid credentials not wired up, or nothing
      // filed for this demo tenant) — show sample data instead of an empty page.
      // This automatically stops the moment the live backend returns tickets.
      if (data.counts.total === 0 && !search.trim()) {
        setBoard(DEMO_TICKET_BOARD);
        setUsingDemoData(true);
      } else {
        setBoard(data);
        setUsingDemoData(false);
      }
      setLastUpdated(new Date());
    } catch (err) {
      // Backend/SysAid connection isn't available — fall back to sample data
      // rather than showing a broken dashboard.
      setBoard(DEMO_TICKET_BOARD);
      setUsingDemoData(true);
      setError(err instanceof Error ? err.message : 'Could not load tickets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, sort]);

  // Debounced (re)load when search/sort change.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBoard();
    }, 350);
    return () => clearTimeout(timer);
  }, [fetchBoard]);

  // Live auto-refresh so ticket status stays current without a manual reload.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBoard({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchBoard]);

  const stats: StatCardData[] = useMemo(() => {
    const counts = board?.counts;
    return [
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
      {
        id: 'total',
        label: 'Total',
        value: counts?.total ?? 0,
        sublabel: 'All tickets',
        icon: 'ListChecks',
        iconColor: 'text-navy-700',
      },
    ];
  }, [board]);

  const visibleTickets: TicketItem[] = useMemo(() => {
    if (!board) return [];
    if (statusTab === 'all') return board.tickets;
    return board.tickets.filter((t) => t.status_bucket === statusTab);
  }, [board, statusTab]);

  const openRaw = useCallback(async (ticketId: string) => {
    setRawLoading(true);
    try {
      const data = await getRawTicket(ticketId);
      setRawTicket(data);
    } catch {
      setRawTicket({ error: 'Could not load raw ticket data.' });
    } finally {
      setRawLoading(false);
    }
  }, []);

  const showRawModal = rawLoading || rawTicket !== null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Task Manager</h1>
            {usingDemoData && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Demo Data
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {usingDemoData
              ? 'Showing sample tickets — live SysAid ticket status will appear here automatically once credentials are configured.'
              : 'Live view of support tickets filed through the AI assistant.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchBoard({ silent: true })}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.id} data={stat} />
        ))}
      </div>

      {/* Ticket table panel */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusTab === tab.key
                    ? 'bg-navy-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tickets…"
                className="w-56 rounded-md border border-gray-300 py-1.5 pl-9 pr-3 text-sm text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as TicketSort)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="id">ID</option>
            </select>
          </div>
        </div>

        {loading && (
          <p className="py-16 text-center text-sm text-gray-400">Loading tickets…</p>
        )}

        {usingDemoData && !loading && (
          <div className="mx-5 my-4 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error
              ? `Could not reach the live ticket service (${error}). Showing sample tickets instead.`
              : 'No live tickets yet — showing sample tickets so you can preview the dashboard.'}
          </div>
        )}

        {!loading && visibleTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <TicketIcon className="mb-2 h-6 w-6" />
            <p className="text-sm">No tickets to show</p>
          </div>
        )}

        {!loading && visibleTickets.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-medium">Ticket</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Affected User</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleTickets.map((ticket) => {
                  const isSelected = ticket.local_id === selectedId;
                  return (
                    <Fragment key={ticket.local_id}>
                      <tr
                        onClick={() => setSelectedId(isSelected ? null : ticket.local_id)}
                        className={`cursor-pointer border-b border-gray-50 transition-colors hover:bg-accent-50/40 ${
                          isSelected ? 'bg-accent-50/40' : ''
                        }`}
                      >
                        <td className="max-w-xs px-5 py-3">
                          <div className="truncate font-medium text-gray-800">
                            {ticket.title || ticket.local_id}
                          </div>
                          <div className="truncate text-xs text-gray-400">{ticket.local_id}</div>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
                              ticket.status_bucket,
                            )}`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {ticket.category ?? '—'}
                          {ticket.intent_type && (
                            <div className="text-xs text-gray-400">{ticket.intent_type}</div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {ticket.affected_user ? (
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="h-3.5 w-3.5 text-amber-500" />
                              {ticket.affected_user}
                            </span>
                          ) : (
                            ticket.reported_by ?? '—'
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {formatDateTime(ticket.created_at)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRaw(ticket.local_id);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <FileJson className="h-3.5 w-3.5" />
                            Raw
                          </button>
                        </td>
                      </tr>
                      {isSelected && ticket.description && (
                        <tr className="border-b border-gray-50 bg-accent-50/20">
                          <td colSpan={6} className="px-5 py-3 text-sm text-gray-700">
                            {ticket.description}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showRawModal && (
        <RawTicketModal
          data={rawTicket}
          loading={rawLoading}
          onClose={() => setRawTicket(null)}
        />
      )}
    </div>
  );
}
