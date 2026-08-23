import { LayoutGrid } from 'lucide-react';
import { STATS, CLIENTS, PROSPECTS, CURRENT_USER } from '@/lib/mockData';
import { StatCard } from '@/components/dashboard/StatCard';
import { TasksPanel } from '@/components/dashboard/TasksPanel';
import { EntityListPanel } from '@/components/dashboard/EntityListPanel';
import { WelcomePolicyOffers } from '@/components/dashboard/WelcomePolicyOffers';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {/* Welcome header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome Back, {CURRENT_USER.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Here&apos;s what&apos;s happening today</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
          <LayoutGrid className="h-4 w-4" />
          Customize
        </button>
      </div>

      <WelcomePolicyOffers />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <StatCard key={stat.id} data={stat} />
        ))}
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TasksPanel />
        <EntityListPanel
          title="Clients"
          icon="Building2"
          iconClassName="text-emerald-500"
          items={CLIENTS}
          placeholder="Type to search..."
        />
        <EntityListPanel
          title="Prospects"
          icon="Handshake"
          iconClassName="text-orange-500"
          items={PROSPECTS}
          placeholder="Type to search..."
        />
      </div>
    </div>
  );
}
