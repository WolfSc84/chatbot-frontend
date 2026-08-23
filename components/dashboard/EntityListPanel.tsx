'use client';

import { useMemo, useState } from 'react';
import { Building2, Handshake, Search, type LucideIcon } from 'lucide-react';
import type { EntityItem } from '@/lib/types';
import { EntityCard } from './EntityCard';

type TabKey = 'all' | 'favorites' | 'recent';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'recent', label: 'Recent' },
];

const ICONS: Record<string, LucideIcon> = {
  Building2,
  Handshake,
  Search,
};

interface EntityListPanelProps {
  title: string;
  icon: string;
  iconClassName?: string;
  items: EntityItem[];
  placeholder: string;
}

export function EntityListPanel({
  title,
  icon,
  iconClassName = 'text-accent-500',
  items,
  placeholder,
}: EntityListPanelProps) {
  const Icon = ICONS[icon] ?? Building2;
  const [tab, setTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let list = items;
    if (tab === 'favorites') list = list.filter((i) => i.favorite);
    if (tab === 'recent') list = list.slice(0, 3);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q));
    return list;
  }, [items, tab, query]);

  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${iconClassName}`} />
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </header>

      {/* Tabs */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="text-gray-400">View:</span>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              tab === t.key
                ? 'bg-navy-900 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-400"
        />
      </div>

      {/* List */}
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1 scroll-thin">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Nothing to display</p>
        ) : (
          filtered.map((item) => <EntityCard key={item.id} item={item} />)
        )}
      </div>
    </section>
  );
}
