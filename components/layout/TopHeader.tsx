'use client';

import { Bell, Search } from 'lucide-react';
import { CURRENT_USER } from '@/lib/mockData';

export function TopHeader() {
  return (
    <header className="flex h-14 items-center justify-between bg-navy-950 px-4 text-white">
      {/* Logo */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Platform
        </span>
        <span className="text-xl font-extrabold leading-none">
          <span className="text-white">Associate</span>
          <span className="text-accent-400"> Hub</span>
        </span>
      </div>

      {/* Search */}
      <div className="mx-4 hidden max-w-md flex-1 md:flex">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Account Search"
            className="w-full rounded-md bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-400 outline-none ring-1 ring-white/10 focus:ring-accent-400"
          />
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-4">
        <button className="relative text-gray-300 hover:text-white" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm font-medium sm:block">{CURRENT_USER.firstName}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
            {CURRENT_USER.initials}
          </span>
        </div>
      </div>
    </header>
  );
}
