'use client';

import { Bot } from 'lucide-react';
import { useAssistant } from '@/context/AssistantContext';

export function AssistantLauncher() {
  const { isOpen, open } = useAssistant();

  if (isOpen) return null;

  return (
    <button
      onClick={open}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-xl bg-navy-950 px-4 py-3 text-left text-white shadow-lg ring-1 ring-white/10 transition-transform hover:scale-[1.02] hover:bg-navy-900"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/20 text-accent-400">
        <Bot className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">AI Assist</span>
        <span className="block text-xs text-gray-400">Ask, summarize, create tasks</span>
      </span>
    </button>
  );
}
