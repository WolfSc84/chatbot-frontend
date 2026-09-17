'use client';

import { useState } from 'react';
import {
  Bot,
  ClipboardList,
  Download,
  History,
  LogOut,
  MessageSquarePlus,
  Share2,
  UserRound,
  X,
} from 'lucide-react';
import { useAssistant } from '@/context/AssistantContext';
import { t } from '@/lib/i18n';
import { IS_L1_SUPPORT_MODE, IS_LOGIN_ENABLED } from '@/lib/flags';
import type { Workspace } from '@/lib/types';
import { WorkspaceList } from './WorkspaceList';
import { ChatView } from './ChatView';
import { ChatInput } from './ChatInput';
import { ChatHistory } from './ChatHistory';
import { ExportMenu } from './ExportMenu';
import { TicketBoard } from './TicketBoard';

export function AssistantPanel() {
  const {
    isOpen,
    close,
    view,
    setView,
    uiLang,
    setUiLang,
    product,
    availableTenants,
    messages,
    status,
    setDraft,
    newChat,
    sessions,
    historyLoading,
    historyError,
    loadHistory,
    openSession,
    removeSession,
    isSharing,
    shareError,
    shareConversation,
    operatorName,
    operatorEmail,
    clearOperator,
  } = useAssistant();

  const [exportOpen, setExportOpen] = useState(false);

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // Full navigation so middleware re-evaluates the (now cleared) session.
      window.location.href = '/login';
    }
  };

  const streaming = status === 'streaming';
  const showInput = view !== 'history' && view !== 'tickets';

  const handleWorkspace = (ws: Workspace) => {
    setDraft(ws.prompt);
  };

  const handleHistoryBack = () => {
    setView(messages.length > 0 ? 'chat' : 'home');
  };

  return (
    <>
      {/* Backdrop on small screens */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={close}
      />

      <aside
        className={`fixed inset-0 z-50 flex h-[100dvh] w-full max-w-none flex-col bg-gray-50 shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="bg-navy-950 text-white">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Bot className="h-5 w-5 shrink-0 text-accent-400" />
              <span className="truncate text-sm font-semibold">{t(uiLang, 'panel.title')}</span>
              {product && messages.length > 0 && (
                <span className="ml-1 shrink-0 whitespace-nowrap rounded-full bg-accent-500/20 px-2 py-0.5 text-xs font-medium text-accent-200 ring-1 ring-inset ring-accent-400/40">
                  {availableTenants.find((tnt) => tnt.id === product)?.label ?? product}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Single language control (EN/ES) — sets the UI language and the
                  forced reply language; voice-input language follows it. */}
              <button
                onClick={() => setUiLang(uiLang === 'en' ? 'es' : 'en')}
                className="rounded-md px-2 py-1 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white"
                title={t(uiLang, 'input.uiLang')}
                aria-label={t(uiLang, 'input.uiLang')}
              >
                {uiLang === 'en' ? 'EN' : 'ES'}
              </button>
              {IS_L1_SUPPORT_MODE && operatorEmail && (
                <button
                  onClick={clearOperator}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                  title={`Signed in as ${operatorName || operatorEmail} — click to change operator`}
                  aria-label="Change operator"
                >
                  <UserRound className="h-4 w-4" />
                  <span className="hidden max-w-[10rem] truncate sm:inline">
                    {operatorName || operatorEmail}
                  </span>
                </button>
              )}
              {messages.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setExportOpen((v) => !v)}
                    className="rounded-md p-2 text-gray-300 hover:bg-white/10 hover:text-white"
                    aria-label={t(uiLang, 'panel.export')}
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  {exportOpen && <ExportMenu onClose={() => setExportOpen(false)} />}
                </div>
              )}
              {messages.length > 0 && (
                <button
                  onClick={shareConversation}
                  disabled={isSharing}
                  className="rounded-md p-2 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-60"
                  aria-label={t(uiLang, 'panel.share')}
                >
                  <Share2 className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => setView('tickets')}
                className="flex items-center gap-1.5 rounded-md px-2 py-2 text-gray-300 hover:bg-white/10 hover:text-white"
                title={t(uiLang, 'panel.dashboardTitle')}
                aria-label={t(uiLang, 'panel.dashboard')}
              >
                <ClipboardList className="h-5 w-5" />
                <span className="hidden text-sm font-medium sm:inline">{t(uiLang, 'panel.dashboard')}</span>
              </button>
              <button
                onClick={loadHistory}
                className="rounded-md p-2 text-gray-300 hover:bg-white/10 hover:text-white"
                aria-label={t(uiLang, 'panel.history')}
              >
                <History className="h-5 w-5" />
              </button>
              {IS_LOGIN_ENABLED && (
                <button
                  onClick={signOut}
                  className="rounded-md p-2 text-gray-300 hover:bg-white/10 hover:text-white"
                  title={t(uiLang, 'panel.signOut')}
                  aria-label={t(uiLang, 'panel.signOut')}
                >
                  <LogOut className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 scroll-thin sm:px-6">
          {view === 'history' ? (
            <ChatHistory
              sessions={sessions}
              loading={historyLoading}
              error={historyError}
              onBack={handleHistoryBack}
              onOpen={openSession}
              onDelete={removeSession}
            />
          ) : view === 'tickets' ? (
            <TicketBoard onBack={() => setView(messages.length > 0 ? 'chat' : 'home')} />
          ) : view === 'chat' ? (
            <ChatView messages={messages} streaming={streaming} />
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900">{t(uiLang, 'panel.homeTitle')}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {t(uiLang, 'panel.homeSubtitle')}
              </p>

              <div className="my-4 flex items-center gap-2">
                <button
                  onClick={newChat}
                  className="inline-flex items-center gap-1.5 rounded-md bg-navy-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  {t(uiLang, 'panel.newChat')}
                </button>
                <button
                  onClick={loadHistory}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <History className="h-3.5 w-3.5" />
                  {t(uiLang, 'panel.chatHistory')}
                </button>
              </div>

              {/* Suggested workspaces are Sales-only; Knowledge Center starts empty. */}
              {product === 'sales' && <WorkspaceList onSelect={handleWorkspace} />}
            </>
          )}
        </div>

        {/* Status + input */}
        {showInput && (
          <div className="mx-auto w-full max-w-3xl bg-white sm:px-2">
            {shareError && (
              <p className="mx-4 mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {shareError}
              </p>
            )}
            <div className="flex items-center justify-between px-4 pt-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-gray-500">
                <span
                  className={`h-2 w-2 rounded-full ${
                    streaming ? 'animate-pulse bg-accent-500' : 'bg-emerald-500'
                  }`}
                />
                {streaming ? t(uiLang, 'panel.responding') : t(uiLang, 'panel.ready')}
              </span>
              {view === 'chat' && (
                <button
                  onClick={newChat}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  {t(uiLang, 'panel.newChat')}
                </button>
              )}
            </div>
            <ChatInput />
            <p className="px-4 pb-2 text-center text-[11px] text-gray-400">
              {t(uiLang, 'panel.disclaimer')}
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
