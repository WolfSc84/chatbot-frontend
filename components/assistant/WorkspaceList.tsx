'use client';

import { LineChart, Search, type LucideIcon } from 'lucide-react';
import { WORKSPACES } from '@/lib/mockData';
import type { Workspace } from '@/lib/types';

const ICONS: Record<string, LucideIcon> = {
  Search,
  LineChart,
};

const ICON_STYLES: Record<string, string> = {
  'client-insights': 'bg-sky-100 text-sky-600',
  'market-insights': 'bg-emerald-100 text-emerald-600',
};

export function WorkspaceList({ onSelect }: { onSelect: (workspace: Workspace) => void }) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-gray-400">Workspaces</p>
      {WORKSPACES.map((ws) => {
        const Icon = ICONS[ws.icon] ?? Search;
        return (
          <button
            key={ws.id}
            onClick={() => onSelect(ws)}
            className="group flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-accent-400 hover:bg-accent-50/40"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                ICON_STYLES[ws.id] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-800">{ws.title}</span>
              <span className="block truncate text-xs text-gray-500">{ws.description}</span>
            </span>
            <span className="text-gray-300 transition-colors group-hover:text-accent-500">&rarr;</span>
          </button>
        );
      })}
    </div>
  );
}
