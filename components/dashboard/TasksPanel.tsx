'use client';

import { ChevronDown, ListFilter } from 'lucide-react';

export function TasksPanel() {
  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 text-purple-600">
          <ListFilter className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-semibold text-gray-800">Tasks</h2>
      </header>

      <button className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 text-sm font-medium text-gray-600">
        <span className="inline-flex items-center gap-2">
          <ListFilter className="h-4 w-4 text-gray-400" />
          Filters
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      <div className="flex flex-1 items-center justify-center py-10 text-sm text-gray-400">
        No tasks to display
      </div>
    </section>
  );
}
