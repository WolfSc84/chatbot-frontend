import type { EntityItem, StatCardData, Workspace } from './types';

export const CURRENT_USER = {
  name: 'Wolfgang Santamaria',
  firstName: 'Wolfgang',
  initials: 'WS',
};

export const STATS: StatCardData[] = [
  {
    id: 'tasks',
    label: 'Tasks',
    value: 0,
    sublabel: 'OPEN TASKS',
    icon: 'FileText',
    iconColor: 'text-purple-500',
  },
  {
    id: 'documents',
    label: 'Documents',
    value: 0,
    sublabel: 'NEED VERIFICATION',
    icon: 'FileCheck',
    iconColor: 'text-green-500',
  },
  {
    id: 'prospecting',
    label: 'Prospecting',
    value: 22,
    sublabel: 'ACTIVE EFFORTS',
    icon: 'Sprout',
    iconColor: 'text-emerald-500',
  },
  {
    id: 'marketing',
    label: 'Marketing Efforts',
    value: 136,
    sublabel: 'ACTIVE EFFORTS',
    icon: 'Megaphone',
    iconColor: 'text-orange-500',
  },
];

export const CLIENTS: EntityItem[] = [
  {
    id: 'acme',
    name: 'Acme Corporation',
    phone: '203-422-7700',
    email: 'fred@fred.com',
    initial: 'A',
  },
  {
    id: 'cjm',
    name: 'CJM Construction Company, LLC',
    phone: '702-655-9842',
    initial: 'C',
  },
  {
    id: 'digital-bridge',
    name: 'Digital Bridge Holdings, LLC',
    phone: '480-422-9775',
    initial: 'D',
  },
  {
    id: 'northwind',
    name: 'Northwind Traders, Inc.',
    phone: '312-555-0148',
    email: 'ap@northwind.com',
    initial: 'N',
  },
];

export const PROSPECTS: EntityItem[] = [
  {
    id: 'afena',
    name: 'Afena Federal Credit Union',
    phone: '215-438-9976',
    email: 'szurek@afena.com',
    initial: 'A',
  },
  {
    id: 'affinity',
    name: 'Affinity Plus Federal Credit Union',
    phone: '203-765-4567',
    email: 'a.turner@affinity.com',
    initial: 'A',
  },
  {
    id: 'gridiron',
    name: 'Gridiron Capital, LLC',
    phone: '475-655-1200',
    initial: 'G',
  },
  {
    id: 'beacon',
    name: 'Beacon Mutual Insurance',
    phone: '401-825-2667',
    email: 'info@beacon.com',
    initial: 'B',
  },
];

export const WORKSPACES: Workspace[] = [
  {
    id: 'client-insights',
    title: 'Client Insights',
    description: 'Account profiles, renewals, claims history & service status.',
    icon: 'Search',
    prompt: 'Give me an overview of my client Acme Corporation, including renewals and claims history.',
  },
  {
    id: 'market-insights',
    title: 'Market Insights',
    description: 'Carrier appetite, pricing trends, capacity & conditions.',
    icon: 'LineChart',
    prompt: 'What are the current market conditions and carrier appetite for the credit union segment?',
  },
  {
    id: 'knowledge-center',
    title: 'Knowledge Center',
    description: 'Coverage definitions, policy language & agency guidelines.',
    icon: 'BookOpen',
    prompt: 'Explain the difference between occurrence and claims-made coverage.',
  },
  {
    id: 'task-manager',
    title: 'Task Manager',
    description: 'Create follow-ups, reminders, checklists & tracked items.',
    icon: 'ClipboardList',
    prompt: 'Create a follow-up task to call Acme Corporation about their upcoming renewal.',
  },
];
