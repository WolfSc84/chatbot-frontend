import type { Lang } from './i18n';
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
  // Knowledge Center is its own tenant (not a Sales workspace) and Task Manager's
  // subagent was removed (decision D1) — both intentionally omitted from the Sales menu.
];

// Advanced Healthcare demo (2026-11-17): one suggested prompt per demo scenario, in the
// UI language, so the presenter clicks rather than types live. The prompt fills the
// input; nothing is sent until the user presses send.
const ADVANCED_CARE: Record<Lang, Workspace[]> = {
  en: [
    { id: 'adv-infusion', title: 'Hospital discharge — home IV', description: 'Home infusion and how care starts.', icon: 'HeartPulse', prompt: 'My mom is being discharged tomorrow on IV antibiotics. Can you do that at home?' },
    { id: 'adv-referral', title: 'Refer a patient', description: 'Documents and channels for referrers.', icon: 'ClipboardList', prompt: "I'm a discharge planner. What do I need to refer a patient for home infusion?" },
    { id: 'adv-hospice', title: 'Hospice guidance', description: 'When hospice is considered, with a person to talk to.', icon: 'Heart', prompt: 'My father has advanced cancer and his doctor mentioned hospice. When should hospice be considered?' },
    { id: 'adv-coverage', title: 'Coverage & health plans', description: 'Towns served and how coverage is verified.', icon: 'MapPin', prompt: 'Do you serve Culebra, and do you accept my health plan?' },
  ],
  es: [
    { id: 'adv-infusion', title: 'Alta del hospital — terapia IV en casa', description: 'Infusión en el hogar y cómo comienza el cuidado.', icon: 'HeartPulse', prompt: 'A mi mamá le dan de alta mañana con antibiótico IV, ¿ustedes lo ponen en casa?' },
    { id: 'adv-referral', title: 'Referir un paciente', description: 'Documentos y canales para referidores.', icon: 'ClipboardList', prompt: 'Soy planificadora de alta. ¿Qué necesito para referir un paciente de infusión?' },
    { id: 'adv-hospice', title: 'Orientación sobre hospicio', description: 'Cuándo se considera, con una persona para hablar.', icon: 'Heart', prompt: 'Mi papá tiene cáncer avanzado y el médico mencionó hospicio. ¿Cuándo se considera hospicio?' },
    { id: 'adv-coverage', title: 'Cobertura y planes médicos', description: 'Pueblos que atendemos y cómo se verifica la cubierta.', icon: 'MapPin', prompt: '¿Llegan a Culebra y aceptan mi plan médico?' },
  ],
};

const ADVANCED_STAFF: Record<Lang, Workspace[]> = {
  en: [
    { id: 'adv-briefing', title: 'Brief me on my next patient', description: 'History, allergies, orders and today\'s plan.', icon: 'ClipboardList', prompt: "I'm driving to Maria Torres. What do I need to do on today's visit?" },
    { id: 'adv-schedule', title: "Today's visit schedule", description: 'Who, where and when.', icon: 'MapPin', prompt: "What is my visit schedule for today?" },
    { id: 'adv-picc', title: 'PICC dressing protocol', description: 'Step by step, with the manual section.', icon: 'Stethoscope', prompt: 'What is our protocol for changing a PICC dressing?' },
    { id: 'adv-escalation', title: 'When to call the supervisor', description: 'Escalation and on-call guidance.', icon: 'PhoneCall', prompt: 'When should I call the on-call clinical supervisor?' },
    { id: 'adv-mileage', title: 'Mileage reimbursement', description: 'How to submit mileage (HR).', icon: 'Car', prompt: 'How do I get reimbursed for mileage?' },
  ],
  es: [
    { id: 'adv-briefing', title: 'Resumen de mi próximo paciente', description: 'Historial, alergias, órdenes y plan de hoy.', icon: 'ClipboardList', prompt: 'Voy de camino a casa de María Torres, ¿qué tengo que hacer en la visita de hoy?' },
    { id: 'adv-schedule', title: 'Mi agenda de hoy', description: 'Quién, dónde y a qué hora.', icon: 'MapPin', prompt: '¿Cuál es mi agenda de visitas de hoy?' },
    { id: 'adv-picc', title: 'Protocolo de vendaje PICC', description: 'Paso a paso, con la sección del manual.', icon: 'Stethoscope', prompt: '¿Cuál es nuestro protocolo para cambiar el vendaje de un PICC?' },
    { id: 'adv-escalation', title: 'Cuándo llamar al supervisor', description: 'Escalamiento y supervisor de guardia.', icon: 'PhoneCall', prompt: '¿Cuándo debo llamar al supervisor clínico de guardia?' },
    { id: 'adv-mileage', title: 'Reembolso de millaje', description: 'Cómo someter el millaje (RR.HH.).', icon: 'Car', prompt: '¿Cómo solicito el reembolso de millaje?' },
  ],
};

/** Suggested prompts for a tenant in the UI language; empty when it has none. */
export function workspacesFor(product: string | null | undefined, lang: Lang): Workspace[] {
  if (product === 'sales') return WORKSPACES;
  if (product === 'advanced_care') return ADVANCED_CARE[lang];
  if (product === 'advanced_staff') return ADVANCED_STAFF[lang];
  return [];
}
