'use client';

import { AssistantProvider } from '@/context/AssistantContext';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import { OperatorIdentityGate } from '@/components/assistant/OperatorIdentityGate';

export function AppShell({ children: _children }: { children: React.ReactNode }) {
  return (
    <AssistantProvider>
      <OperatorIdentityGate />
      <AssistantPanel />
    </AssistantProvider>
  );
}
