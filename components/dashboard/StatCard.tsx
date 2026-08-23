'use client';

import {
  CheckCircle2,
  Clock3,
  FileCheck,
  FileText,
  ListChecks,
  Megaphone,
  Sprout,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import type { StatCardData } from '@/lib/types';

const ICONS: Record<string, LucideIcon> = {
  FileText,
  FileCheck,
  Sprout,
  Megaphone,
  Ticket,
  Clock3,
  CheckCircle2,
  ListChecks,
};

export function StatCard({ data }: { data: StatCardData }) {
  const Icon = ICONS[data.icon] ?? FileText;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
      <div className="mb-1 flex items-center justify-center gap-2">
        <Icon className={`h-5 w-5 ${data.iconColor}`} />
        <span className="text-sm font-semibold text-gray-700">{data.label}</span>
      </div>
      <div className="my-1 text-4xl font-bold text-gray-900">{data.value}</div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {data.sublabel}
      </div>
    </div>
  );
}
