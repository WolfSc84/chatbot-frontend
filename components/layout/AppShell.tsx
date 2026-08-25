'use client';

import { usePathname } from 'next/navigation';
import { AssistantProvider } from '@/context/AssistantContext';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import { OperatorIdentityGate } from '@/components/assistant/OperatorIdentityGate';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The login route renders its own form (children). The assistant must NOT mount
  // there: it's unauthenticated, so tenant discovery 401s and the panel is dead.
  // Every other route is the assistant product (mock dashboards are not rendered).
  if (pathname === '/login') return <>{children}</>;
  return (
    <AssistantProvider>
      <OperatorIdentityGate />
      <AssistantPanel />
    </AssistantProvider>
  );
}
