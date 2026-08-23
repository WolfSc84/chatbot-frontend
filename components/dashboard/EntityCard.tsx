'use client';

import { Phone, Mail, Star } from 'lucide-react';
import type { EntityItem } from '@/lib/types';

export function EntityCard({ item }: { item: EntityItem }) {
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-accent-400 hover:bg-accent-50/40">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-600">
        {item.initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-800">{item.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-accent-600">
          {item.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {item.phone}
            </span>
          )}
          {item.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {item.email}
            </span>
          )}
        </div>
      </div>
      <button
        className="text-gray-300 transition-colors hover:text-amber-400"
        aria-label="Toggle favorite"
      >
        <Star className={`h-4 w-4 ${item.favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
      </button>
    </div>
  );
}
