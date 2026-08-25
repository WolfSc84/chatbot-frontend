'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteSession,
  generateExportSummary,
  getRawTicket,
  getSessionMessages,
  getTenants,
  SessionExpiredError,
  getTicketBoard,
  listAllTenantSessions,
  streamChat,
  synthesizeAudio,
  tenantOfSessionId,
  type TenantOption,
} from '@/lib/api';
import type {
  AgentProgressStep,
  ChatMessage,
  ExportFormat,
  SessionInfo,
  TicketBoardResponse,
  TicketSort,
} from '@/lib/types';
import { IS_L1_SUPPORT_MODE } from '@/lib/flags';

type AssistantStatus = 'ready' | 'streaming' | 'error';
export type AssistantView = 'home' | 'chat' | 'history' | 'tickets';

/**
 * Mandatory tenant context the user must pick before sending a message. A tenant
 * id (`^[a-z0-9_]{1,64}$`); the selectable set is discovered dynamically from the
 * backend (`availableTenants`), so onboarding a tenant needs no frontend change.
 */
export type ProductSelection = string;

interface AssistantContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  view: AssistantView;
  setView: (view: AssistantView) => void;

  product: ProductSelection | null;
  setProduct: (product: ProductSelection | null) => void;
  /** Tenants the current user may select (dynamic, backend-driven). */
  availableTenants: TenantOption[];
  /** True when tenant discovery got a 401 — the session died; prompt a re-login. */
  sessionExpired: boolean;

  // L1 support-team operator identity (L1 variation). In standard mode
  // operatorReady is always true and the other fields are unused.
  operatorName: string | null;
  operatorEmail: string | null;
  operatorReady: boolean;
  setOperator: (name: string, email: string) => void;
  clearOperator: () => void;

  messages: ChatMessage[];
  status: AssistantStatus;
  activeNode: string | null;
  agentProgress: AgentProgressStep[];
  draft: string;
  setDraft: (value: string) => void;

  sessions: SessionInfo[];
  historyLoading: boolean;
  historyError: string | null;
  loadHistory: () => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;

  sendMessage: (text: string) => Promise<void>;
  newChat: () => void;

  // Audio playback
  playingMessageId: string | null;
  audioLoadingId: string | null;
  audioError: string | null;
  playMessageAudio: (messageId: string, text: string) => Promise<void>;
  stopAudio: () => void;

  // Export conversation
  isExporting: boolean;
  exportError: string | null;
  exportFormat: ExportFormat;
  setExportFormat: (format: ExportFormat) => void;
  selectionMode: boolean;
  toggleSelectionMode: () => void;
  selectedExportIds: Set<string>;
  toggleExportSelection: (messageId: string) => void;
  exportConversation: () => Promise<void>;

  // Share conversation by email
  isSharing: boolean;
  shareError: string | null;
  shareConversation: () => Promise<void>;

  // Tickets
  ticketBoard: TicketBoardResponse | null;
  ticketsLoading: boolean;
  ticketsError: string | null;
  ticketSearch: string;
  setTicketSearch: (value: string) => void;
  ticketSort: TicketSort;
  setTicketSort: (value: TicketSort) => void;
  selectedTicketId: string | null;
  setSelectedTicketId: (id: string | null) => void;
  loadTickets: () => Promise<void>;
  rawTicket: unknown;
  rawTicketLoading: boolean;
  loadRawTicket: (ticketId: string) => Promise<void>;
  clearRawTicket: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

let idCounter = 0;
const nextId = () => `m_${Date.now()}_${idCounter++}`;

/**
 * Per-thread product persistence. The selected product (Sales / People
 * Solution) is a session-level parameter: it is sent with every chat request
 * for a thread and must survive reloads and session resumes. We key it by
 * thread id in localStorage so reopening a conversation restores its product.
 */
const THREAD_PRODUCT_KEY = 'assistant:threadProduct';

function loadThreadProduct(threadId: string | null): ProductSelection | null {
  if (typeof window === 'undefined' || !threadId) return null;
  try {
    const raw = window.localStorage.getItem(THREAD_PRODUCT_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, ProductSelection>;
    return map[threadId] ?? null;
  } catch {
    return null;
  }
}

function saveThreadProduct(threadId: string | null, product: ProductSelection | null): void {
  if (typeof window === 'undefined' || !threadId || !product) return;
  try {
    const raw = window.localStorage.getItem(THREAD_PRODUCT_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, ProductSelection>;
    map[threadId] = product;
    window.localStorage.setItem(THREAD_PRODUCT_KEY, JSON.stringify(map));
  } catch {
    // Non-fatal: persistence is best-effort.
  }
}

/** Max length for a mailto: URL before we condense / fall back to clipboard. */
const MAX_MAILTO_URL_LENGTH = 1800;

/**
 * Text-to-speech options sent with a read-aloud request. Voice + model are owned
 * by the backend env config (``TTS_MODEL`` / ``TTS_VOICE``, provider-agnostic),
 * so the client sends an empty profile and lets the backend pick the configured
 * voice. (The legacy edge-tts ``rate``/``pitch``/``volume`` fields are ignored by
 * the gateway TTS model and are intentionally omitted.)
 */
const ADVANCED_TTS_PROFILE = {} as const;

function openComposeLink(url: string): boolean {
  try {
    window.location.href = url;
    return true;
  } catch {
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch {
      return false;
    }
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [view, setView] = useState<AssistantView>('home');
  const [product, setProduct] = useState<ProductSelection | null>(null);
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Discover the tenants this user may select (dynamic, backend-driven). Fetched
  // once on mount so onboarding a tenant needs no frontend change. A 401 here means
  // the session expired on an already-open tab — surface it instead of a dead dropdown.
  useEffect(() => {
    let cancelled = false;
    getTenants()
      .then((tenants) => {
        if (!cancelled) setAvailableTenants(tenants);
      })
      .catch((err) => {
        if (!cancelled && err instanceof SessionExpiredError) setSessionExpired(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // L1 support-team operator identity (L1 variation), persisted in localStorage.
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [operatorEmail, setOperatorEmail] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AssistantStatus>('ready');
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [agentProgress, setAgentProgress] = useState<AgentProgressStep[]>([]);
  const [draft, setDraft] = useState('');

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<Set<string>>(new Set());

  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const [ticketBoard, setTicketBoard] = useState<TicketBoardResponse | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketSort, setTicketSort] = useState<TicketSort>('newest');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [rawTicket, setRawTicket] = useState<unknown>(null);
  const [rawTicketLoading, setRawTicketLoading] = useState(false);

  const threadIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setPlayingMessageId(null);
    setAudioLoadingId(null);
  }, []);

  // L1 operator identity: hydrate from localStorage on mount (client only).
  // Only accept a *complete + valid* saved identity; otherwise clear it so the
  // sign-in gate stays open instead of flickering shut on partial/stale data.
  useEffect(() => {
    if (!IS_L1_SUPPORT_MODE || typeof window === 'undefined') return;
    try {
      const savedName = (window.localStorage.getItem('l1SupportName') ?? '').trim();
      const savedEmail = (window.localStorage.getItem('l1SupportEmail') ?? '').trim();
      const emailOk = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)*example\.com$/.test(savedEmail.toLowerCase());
      if (savedName && emailOk) {
        setOperatorName(savedName);
        setOperatorEmail(savedEmail.toLowerCase());
      } else if (savedName || savedEmail) {
        // Partial/invalid leftover — drop it so the gate is shown cleanly.
        window.localStorage.removeItem('l1SupportName');
        window.localStorage.removeItem('l1SupportEmail');
      }
    } catch {
      /* storage unavailable — operator will re-enter identity */
    }
  }, []);

  const setOperator = useCallback((name: string, email: string) => {
    const nextName = name.trim();
    const nextEmail = email.trim();
    setOperatorName(nextName);
    setOperatorEmail(nextEmail);
    try {
      window.localStorage.setItem('l1SupportName', nextName);
      window.localStorage.setItem('l1SupportEmail', nextEmail);
    } catch {
      /* storage unavailable — identity is still held in memory for this session */
    }
  }, []);

  const clearOperator = useCallback(() => {
    setOperatorName(null);
    setOperatorEmail(null);
    try {
      window.localStorage.removeItem('l1SupportName');
      window.localStorage.removeItem('l1SupportEmail');
    } catch {
      /* ignore */
    }
  }, []);

  const operatorReady = !IS_L1_SUPPORT_MODE || Boolean(operatorName && operatorEmail);

  const playMessageAudio = useCallback(
    async (messageId: string, text: string) => {
      // Toggle off if this message is already playing.
      if (playingMessageId === messageId) {
        stopAudio();
        return;
      }

      stopAudio();
      setAudioError(null);
      const speakable = text.trim();
      if (!speakable) return;

      setAudioLoadingId(messageId);
      try {
        const blob = await synthesizeAudio(speakable, ADVANCED_TTS_PROFILE, product);
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => stopAudio();
        audio.onerror = () => {
          setAudioError('Could not play audio.');
          stopAudio();
        };
        await audio.play();
        setAudioLoadingId(null);
        setPlayingMessageId(messageId);
      } catch (err) {
        setAudioError(err instanceof Error ? err.message : 'Could not play audio.');
        stopAudio();
      }
    },
    [playingMessageId, stopAudio, product],
  );

  useEffect(() => stopAudio, [stopAudio]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedExportIds(new Set());
      return !prev;
    });
  }, []);

  const toggleExportSelection = useCallback((messageId: string) => {
    setSelectedExportIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  /** Build a plain-text transcript from the selected (or all) usable messages. */
  const buildTranscript = useCallback((): string => {
    const source =
      selectionMode && selectedExportIds.size > 0
        ? messages.filter((m) => selectedExportIds.has(m.id))
        : messages;

    return source
      .filter((m) => m.content.trim())
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.trim()}`)
      .join('\n\n');
  }, [messages, selectedExportIds, selectionMode]);

  const exportConversation = useCallback(async () => {
    if (isExporting) return;
    setExportError(null);

    const transcript = buildTranscript();
    if (!transcript) {
      setExportError('There are no messages to export yet.');
      return;
    }

    setIsExporting(true);
    try {
      let content = transcript;
      try {
        const summary = await generateExportSummary(transcript, threadIdRef.current, product);
        if (summary.trim()) content = summary;
      } catch {
        // Fall back to the raw transcript if summarization fails.
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const baseName = `platform-conversation-${stamp}`;

      if (exportFormat === 'clipboard') {
        await navigator.clipboard.writeText(content);
      } else if (exportFormat === 'txt') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, `${baseName}.txt`);
      } else if (exportFormat === 'docx') {
        const { Document, Packer, Paragraph, TextRun } = await import('docx');
        const paragraphs = content
          .split('\n')
          .map((line) => new Paragraph({ children: [new TextRun(line)] }));
        const doc = new Document({ sections: [{ children: paragraphs }] });
        const blob = await Packer.toBlob(doc);
        downloadBlob(blob, `${baseName}.docx`);
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
        const margin = 48;
        const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;
        const pageHeight = pdf.internal.pageSize.getHeight() - margin;
        const lineHeight = 16;
        pdf.setFontSize(11);
        const lines = pdf.splitTextToSize(content, maxWidth) as string[];
        let y = margin;
        for (const line of lines) {
          if (y > pageHeight) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(line, margin, y);
          y += lineHeight;
        }
        pdf.save(`${baseName}.pdf`);
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not export the conversation.');
    } finally {
      setIsExporting(false);
    }
  }, [buildTranscript, exportFormat, isExporting, product]);

  const shareConversation = useCallback(async () => {
    if (isSharing) return;
    setShareError(null);

    const transcript = buildTranscript();
    if (!transcript) {
      setShareError('No conversation to share yet.');
      return;
    }

    setIsSharing(true);
    try {
      let summary = transcript;
      try {
        const generated = await generateExportSummary(transcript, threadIdRef.current, product);
        if (generated.trim()) summary = generated;
      } catch {
        // Fall back to the raw transcript if summarization fails.
      }

      const subject = encodeURIComponent(
        `Conversation Export - ${threadIdRef.current || 'current conversation'}`,
      );
      let body = encodeURIComponent(summary);
      let composeUrl = `mailto:?subject=${subject}&body=${body}`;

      if (composeUrl.length > MAX_MAILTO_URL_LENGTH) {
        const condensed = summary.replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim();
        const maxBodyChars = 900;
        const shortened =
          condensed.length > maxBodyChars
            ? `${condensed.slice(0, maxBodyChars)}...\n\n(Shortened to fit email compose.)`
            : condensed;
        body = encodeURIComponent(shortened);
        composeUrl = `mailto:?subject=${subject}&body=${body}`;

        if (composeUrl.length > MAX_MAILTO_URL_LENGTH) {
          await navigator.clipboard.writeText(summary);
          throw new Error(
            'Summary is too long for automatic email compose. It has been copied to your clipboard.',
          );
        }
      }

      const launched = openComposeLink(composeUrl);
      if (!launched) {
        await navigator.clipboard.writeText(summary);
        throw new Error('Could not open your email client. Summary copied to clipboard instead.');
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not share the conversation.');
    } finally {
      setIsSharing(false);
    }
  }, [buildTranscript, isSharing, product]);

  const loadTickets = useCallback(async () => {
    setView('tickets');
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const board = await getTicketBoard(ticketSearch.trim(), ticketSort, product);
      setTicketBoard(board);
    } catch (err) {
      setTicketsError(err instanceof Error ? err.message : 'Failed to load tickets.');
    } finally {
      setTicketsLoading(false);
    }
  }, [ticketSearch, ticketSort, product]);

  // Refresh the Ticket Board in the background (no view switch / spinner) — used
  // after a chat turn closes a ticket so the board reflects the deletion live.
  const refreshTicketBoardSilently = useCallback(async () => {
    try {
      const board = await getTicketBoard(ticketSearch.trim(), ticketSort, product);
      setTicketBoard(board);
    } catch {
      // Silent: the board will refresh on the next explicit open.
    }
  }, [ticketSearch, ticketSort, product]);

  const loadRawTicket = useCallback(async (ticketId: string) => {
    setRawTicketLoading(true);
    setRawTicket(null);
    try {
      const data = await getRawTicket(ticketId, product);
      setRawTicket(data);
    } catch (err) {
      setRawTicket({ error: err instanceof Error ? err.message : 'Failed to load ticket.' });
    } finally {
      setRawTicketLoading(false);
    }
  }, [product]);

  const clearRawTicket = useCallback(() => setRawTicket(null), []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const newChat = useCallback(() => {
    stopAudio();
    setSelectionMode(false);
    setSelectedExportIds(new Set());
    setExportError(null);
    setShareError(null);
    threadIdRef.current = null;
    setMessages([]);
    setStatus('ready');
    setActiveNode(null);
    setAgentProgress([]);
    setDraft('');
    setView('home');
  }, [stopAudio]);

  const loadHistory = useCallback(async () => {
    setView('history');
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      // Show the user's conversations across ALL tenants, each tagged; every
      // per-tenant fetch stays tenant-scoped + guarded server-side.
      const data = await listAllTenantSessions(50);
      setSessions(data);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load chat history.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openSession = useCallback(async (sessionId: string) => {
    setStatus('ready');
    setActiveNode(null);
    setAgentProgress([]);
    setView('chat');
    // Restore the product chosen for this session so it keeps being sent with
    // every request for the resumed conversation — and use it for the scoped
    // message read below (state updates are async, so read the value directly).
    // Fall back to the tenant embedded in the session id for legacy threads.
    const threadProduct =
      loadThreadProduct(sessionId) ?? (tenantOfSessionId(sessionId) as ProductSelection | null);
    setProduct(threadProduct);
    try {
      const history = await getSessionMessages(sessionId, threadProduct);
      threadIdRef.current = sessionId;
      setMessages(history);
    } catch (err) {
      threadIdRef.current = sessionId;
      setMessages([
        {
          id: nextId(),
          role: 'assistant',
          content: `⚠️ ${
            err instanceof Error ? err.message : 'Could not load this conversation.'
          }`,
        },
      ]);
    }
  }, []);

  const removeSession = useCallback(async (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    try {
      await deleteSession(sessionId, loadThreadProduct(sessionId) ?? tenantOfSessionId(sessionId));
    } catch {
      try {
        setSessions(await listAllTenantSessions(50));
      } catch {
        // ignore re-sync failure
      }
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'streaming') return;
      // A product (Sales / Knowledge Center) is mandatory before sending.
      if (!product) return;

      setView('chat');
      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: trimmed };
      const assistantMsg: ChatMessage = { id: nextId(), role: 'assistant', content: '' };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setDraft('');
      setStatus('streaming');
      setAgentProgress([]);

      const appendToAssistant = (chunk: string) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          last.content += chunk;
          next[next.length - 1] = last;
          return next;
        });
      };

      try {
        await streamChat({
          message: trimmed,
          threadId: threadIdRef.current,
          product,
          onToken: appendToAssistant,
          onNode: setActiveNode,
          onProgress: (step) => {
            setAgentProgress((prev) => {
              const idx = prev.findIndex((item) => item.id === step.id);
              if (idx === -1) return [...prev, step];
              const next = [...prev];
              next[idx] = step;
              return next;
            });
          },
          onComplete: ({ response, threadId, ticketClosed }) => {
            threadIdRef.current = threadId;
            // Persist the product for this thread so it survives reloads and is
            // restored (and re-sent) when the session is reopened.
            saveThreadProduct(threadId, product);
            if (response) {
              setMessages((prev) => {
                const next = [...prev];
                const last = { ...next[next.length - 1] };
                if (!last.content) last.content = response;
                next[next.length - 1] = last;
                return next;
              });
            }
            // Live process steps are ephemeral — clear them once the turn completes.
            setAgentProgress([]);
            // A ticket was closed this turn — refresh the board so it drops out.
            if (ticketClosed) {
              void refreshTicketBoardSilently();
            }
          },
          onError: (msg) => {
            appendToAssistant(`\n\n⚠️ ${msg}`);
          },
        });
        setStatus('ready');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to reach the backend.';
        setMessages((prev) => {
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          last.content = last.content || `⚠️ ${message}`;
          next[next.length - 1] = last;
          return next;
        });
        setStatus('error');
      } finally {
        setActiveNode(null);
      }
    },
    [status, product, refreshTicketBoardSilently],
  );

  const value = useMemo<AssistantContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      view,
      setView,
      product,
      setProduct,
      availableTenants,
      sessionExpired,
      operatorName,
      operatorEmail,
      operatorReady,
      setOperator,
      clearOperator,
      messages,
      status,
      activeNode,
      agentProgress,
      draft,
      setDraft,
      sessions,
      historyLoading,
      historyError,
      loadHistory,
      openSession,
      removeSession,
      sendMessage,
      newChat,
      playingMessageId,
      audioLoadingId,
      audioError,
      playMessageAudio,
      stopAudio,
      isExporting,
      exportError,
      exportFormat,
      setExportFormat,
      selectionMode,
      toggleSelectionMode,
      selectedExportIds,
      toggleExportSelection,
      exportConversation,
      isSharing,
      shareError,
      shareConversation,
      ticketBoard,
      ticketsLoading,
      ticketsError,
      ticketSearch,
      setTicketSearch,
      ticketSort,
      setTicketSort,
      selectedTicketId,
      setSelectedTicketId,
      loadTickets,
      rawTicket,
      rawTicketLoading,
      loadRawTicket,
      clearRawTicket,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      view,
      product,
      availableTenants,
      sessionExpired,
      operatorName,
      operatorEmail,
      operatorReady,
      setOperator,
      clearOperator,
      messages,
      status,
      activeNode,
      agentProgress,
      draft,
      sessions,
      historyLoading,
      historyError,
      loadHistory,
      openSession,
      removeSession,
      sendMessage,
      newChat,
      playingMessageId,
      audioLoadingId,
      audioError,
      playMessageAudio,
      stopAudio,
      isExporting,
      exportError,
      exportFormat,
      selectionMode,
      toggleSelectionMode,
      selectedExportIds,
      toggleExportSelection,
      exportConversation,
      isSharing,
      shareError,
      shareConversation,
      ticketBoard,
      ticketsLoading,
      ticketsError,
      ticketSearch,
      ticketSort,
      selectedTicketId,
      loadTickets,
      rawTicket,
      rawTicketLoading,
      loadRawTicket,
      clearRawTicket,
    ],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within an AssistantProvider');
  return ctx;
}
