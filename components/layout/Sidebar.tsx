'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileBox,
  Globe,
  Home,
  LayoutGrid,
  LineChart,
  Network,
  PanelLeftClose,
  Settings2,
  ShieldCheck,
  Sprout,
  Megaphone,
  RefreshCw,
  User,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  expandable?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Account', href: '/account', icon: User, expandable: true },
  { label: 'Prospecting', href: '/prospecting', icon: Sprout },
  { label: 'Exposure Management', href: '/exposure-management', icon: ShieldCheck },
  { label: 'Pre-Renewals', href: '/pre-renewals', icon: RefreshCw },
  { label: 'Marketing', href: '/marketing', icon: Megaphone },
  { label: 'Policy Management', href: '/policy-management', icon: FileBox, expandable: true },
  { label: 'Analytics', href: '/analytics', icon: LineChart },
  { label: 'Digital Applications', href: '/digital-applications', icon: LayoutGrid },
  { label: 'Schematic Builder', href: '/schematic-builder', icon: Network },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className={`flex h-full flex-col bg-navy-950 text-gray-300 transition-all ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Global selector */}
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-3">
        <button className="flex items-center gap-2 text-sm font-medium text-white">
          <Globe className="h-4 w-4 text-accent-400" />
          {!collapsed && <span>Global</span>}
        </button>
        {!collapsed && <ChevronDown className="h-4 w-4 text-gray-500" />}
      </div>

      {/* Top quick links */}
      <nav className="px-2 py-2">
        <SidebarLink href="/" label="Home" icon={Home} active={isActive('/')} collapsed={collapsed} />
        <SidebarLink
          href="/task-manager"
          label="Task Manager"
          icon={LayoutGrid}
          active={isActive('/task-manager')}
          collapsed={collapsed}
        />
      </nav>

      {/* Account selector */}
      <div className="mx-2 mb-2 flex items-center gap-2 rounded-md bg-accent-500/10 px-2 py-2 ring-1 ring-accent-500/30">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-amber-500 text-xs font-bold text-white">
          A
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-sm font-medium text-white">Acme Corporation</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 scroll-thin">
        {NAV_ITEMS.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(item.href)}
            collapsed={collapsed}
            expandable={item.expandable}
          />
        ))}
      </nav>

      {/* Settings link */}
      <div className="border-t border-white/5 px-2 pt-2">
        <SidebarLink
          href="/settings"
          label="Settings"
          icon={Settings2}
          active={isActive('/settings')}
          collapsed={collapsed}
        />
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-white/5 p-2">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
          aria-label="Toggle sidebar"
        >
          <PanelLeftClose
            className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

interface SidebarLinkProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  collapsed?: boolean;
  expandable?: boolean;
}

function SidebarLink({ href, label, icon: Icon, active, collapsed, expandable }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors ${
        active ? 'bg-accent-500/15 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-accent-400' : 'text-gray-400'}`} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && expandable && <ChevronRight className="h-4 w-4 text-gray-500" />}
    </Link>
  );
}

export { BarChart3 };
