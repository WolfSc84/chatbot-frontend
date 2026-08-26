import type {
  AgentProgressKind,
  AgentProgressPhase,
  AgentProgressStatus,
  AgentProgressStep,
  ChatMessage,
  SessionInfo,
  TicketBoardResponse,
  TicketSort,
} from './types';
import { IS_L1_SUPPORT_MODE } from './flags';

/**
 * The client talks to local Next.js proxy routes (under /api), which inject the
 * backend bearer token server-side. The token is therefore never exposed to the
 * browser and there are no CORS concerns.
 */
const CHAT_STREAM_URL = '/api/chat/stream';
const CHAT_AUDIO_URL = '/api/chat/audio';
const CHAT_TRANSCRIBE_URL = '/api/chat/transcribe';
const CHAT_ATTACH_URL = '/api/chat/attach';
const CHAT_REPORT_URL = '/api/chat/report';
const CHAT_TRANSCRIBE_CORRECT_URL = '/api/chat/transcribe/correct';
const CHAT_EXPORT_SUMMARY_URL = '/api/chat/export-summary';
const SESSIONS_URL = '/api/sessions';
const TENANTS_URL = '/api/tenants';
const TICKETS_BOARD_URL = '/api/tickets/board';
const CHAT_WARMUP_URL = '/api/chat/warmup';
const CHAT_LOGIN_URL = '/api/chat/login';
const CHAT_LOGOUT_URL = '/api/chat/logout';

export interface AudioSynthesisOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
}

/** Structured report payload emitted by the Sales-exclusive report subagent,
 * carried in the `complete` event's actions. Downloaded via {@link downloadReport}. */
export interface ReportPayload {
  title: string;
  subtitle?: string;
  filename?: string;
  sections: { heading: string; body?: string; bullets?: string[] }[];
}

export interface StreamCompletePayload {
  response: string;
  threadId: string | null;
  ticketClosed?: boolean;
  /** Present when a report was generated this turn (Sales-only). */
  report?: ReportPayload | null;
  executionTimeline: AgentProgressStep[];
}

export interface StreamChatOptions {
  message: string;
  threadId: string | null;
  currentPage?: string | null;
  /** Mandatory product context: 'sales' or 'knowledge_center'. */
  product?: string | null;
  /** Forced reply language (e.g. 'en' / 'es'); mirrors the UI toggle. Omitted
   * from the request body when falsy so the backend keeps auto-detecting. */
  replyLanguage?: string;
  signal?: AbortSignal;
  /** Called for each streamed text token. */
  onToken?: (content: string) => void;
  /** Called when a LangGraph node starts/stops. */
  onNode?: (nodeName: string | null) => void;
  /** Called for each structured loading step emitted by the backend. */
  onProgress?: (step: AgentProgressStep) => void;
  /** Called once on the final `complete` event. */
  onComplete?: (payload: StreamCompletePayload) => void;
  /** Called on a stream-level error event. */
  onError?: (message: string) => void;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

/** Pull the structured report out of the complete-event `actions` array, if any. */
function extractReport(actions: unknown): ReportPayload | null {
  if (!Array.isArray(actions)) return null;
  for (const action of actions) {
    const rec = asRecord(action);
    if (rec?.type === 'report' && rec.report && typeof rec.report === 'object') {
      return rec.report as ReportPayload;
    }
  }
  return null;
}

/**
 * L1 support-team operator identity (L1 variation). Read from localStorage (set
 * by the operator identity gate) and sent as `x-support-name` / `x-support-email`
 * so the proxy can translate them to the backend identity headers. Empty in
 * standard mode. Never throws (SSR / disabled storage safe).
 */
function supportHeaders(): Record<string, string> {
  if (!IS_L1_SUPPORT_MODE || typeof window === 'undefined') return {};
  try {
    const name = (window.localStorage.getItem('l1SupportName') ?? '').trim();
    const email = (window.localStorage.getItem('l1SupportEmail') ?? '').trim();
    const out: Record<string, string> = {};
    if (name) out['x-support-name'] = name;
    if (email) out['x-support-email'] = email;
    return out;
  } catch {
    return {};
  }
}

/**
 * Build the tenant transport header for browser -> proxy calls. The proxy
 * validates the value and maps it to the backend `x-platform-id`. When no
 * product is set, the proxy applies its fail-closed default. In L1 mode the
 * operator identity headers are attached too (so every authed call carries them).
 */
function productHeader(product?: string | null): Record<string, string> {
  return { ...(product ? { 'x-product': product } : {}), ...supportHeaders() };
}

function normalizePhase(value: unknown): AgentProgressPhase {
  if (value === 'plan' || value === 'process' || value === 'do' || value === 'respond') {
    return value;
  }
  return 'process';
}

function normalizeStatus(value: unknown): AgentProgressStatus {
  if (value === 'started' || value === 'completed' || value === 'error') return value;
  return 'started';
}

function normalizeKind(value: unknown): AgentProgressKind {
  if (value === 'tool' || value === 'node') return value;
  return 'node';
}

function parseStep(raw: unknown): AgentProgressStep | null {
  const step = asRecord(raw);
  if (!step) return null;

  const id = typeof step.id === 'string' ? step.id : null;
  const name = typeof step.name === 'string' ? step.name : null;
  if (!id || !name) return null;

  return {
    id,
    name,
    label: typeof step.label === 'string' ? step.label : name,
    phase: normalizePhase(step.phase),
    status: normalizeStatus(step.status),
    kind: normalizeKind(step.kind),
    timestamp: typeof step.timestamp === 'string' ? step.timestamp : undefined,
  };
}

function parseExecutionTimeline(raw: unknown): AgentProgressStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseStep).filter((step): step is AgentProgressStep => step !== null);
}

/**
 * Stream a chat completion from the platform backend over SSE (via the proxy).
 * Mirrors the event contract used by the backend `/chat/stream` route:
 *   { type: 'token', content }
 *   { type: 'node', node_name, status }
 *   { type: 'complete', response, thread_id }
 *   { type: 'error', error }
 */
export async function streamChat(options: StreamChatOptions): Promise<void> {
  const {
    message,
    threadId,
    currentPage = null,
    product = null,
    replyLanguage,
    signal,
    onToken,
    onNode,
    onProgress,
    onComplete,
    onError,
  } = options;

  const response = await fetch(CHAT_STREAM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Tenant travels as a dedicated header (browser -> proxy). The proxy
      // validates it and maps it to the backend `x-platform-id`. It is never
      // placed in the ChatRequest body (which accepts only message/current_page/
      // thread_id).
      ...(product ? { 'x-product': product } : {}),
      // L1 support-team operator identity (L1 variation): the proxy translates
      // these to the backend `x-support-*` headers. Empty in standard mode.
      ...supportHeaders(),
    },
    body: JSON.stringify({
      message,
      current_page: currentPage,
      thread_id: threadId,
      // Forced reply language override — only sent when set, so an unset toggle
      // leaves the backend's message-text auto-detection untouched.
      ...(replyLanguage ? { reply_language: replyLanguage } : {}),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Chat request failed (${response.status}). ${detail}`.trim());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const timeline: AgentProgressStep[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const payload = trimmed.slice(trimmed.indexOf(':') + 1).trim();
      if (!payload || payload === '[DONE]') continue;

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(payload);
      } catch {
        continue;
      }

      switch (data.type) {
        case 'token': {
          if (typeof data.content === 'string') onToken?.(data.content);
          break;
        }
        case 'node': {
          const name = data.status === 'started' ? (data.node_name as string) : null;
          onNode?.(name ?? null);

          const step = parseStep(data.step);
          if (step) {
            timeline.push(step);
            onProgress?.(step);
          }
          break;
        }
        case 'tool':
        case 'handler_complete':
        case 'action_complete': {
          const step = parseStep(data.step);
          if (step) {
            timeline.push(step);
            onProgress?.(step);
          }
          break;
        }
        case 'complete': {
          const text = typeof data.response === 'string' ? data.response : null;
          const fromComplete = parseExecutionTimeline(data.execution_timeline);
          const finalTimeline = fromComplete.length > 0 ? fromComplete : timeline;

          onComplete?.({
            response: text ?? '',
            threadId: (data.thread_id as string) ?? threadId,
            ticketClosed: data.ticket_closed === true,
            report: extractReport(data.actions),
            executionTimeline: finalTimeline,
          });
          break;
        }
        case 'error': {
          onError?.((data.error as string) ?? 'An error occurred while streaming the response.');
          break;
        }
        default:
          break;
      }
    }
  }
}

/** Fetch the user's recent chat sessions for the "Chat History" view. */
export async function listSessions(limit = 50, product?: string | null): Promise<SessionInfo[]> {
  const response = await fetch(`${SESSIONS_URL}?limit=${limit}`, {
    method: 'GET',
    headers: productHeader(product),
  });

  if (!response.ok) {
    throw new Error(`Failed to load sessions (${response.status}).`);
  }

  const data = (await response.json()) as { sessions?: SessionInfo[] };
  return data.sessions ?? [];
}

/** A tenant the current user may select, as returned by the backend. */
export interface TenantOption {
  id: string;
  label: string;
}

/** Thrown when the backend rejects a call with 401 — the session is dead and the
 *  user must re-authenticate. Distinct from a genuinely empty result so the UI can
 *  prompt a re-login instead of silently showing "no tenants". */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

/**
 * Fetch the tenants the authenticated user may select (dynamic, backend-driven).
 * Onboarding a tenant needs no frontend change. Throws SessionExpiredError on 401
 * (session dead → prompt re-login); returns [] on network error / genuine empty so
 * the UI still degrades gracefully (the backend also fail-closed authorizes each request).
 */
export async function getTenants(): Promise<TenantOption[]> {
  let response: Response;
  try {
    response = await fetch(TENANTS_URL, { method: 'GET', cache: 'no-store' });
  } catch {
    return []; // network error — not an auth problem
  }
  if (response.status === 401) throw new SessionExpiredError();
  if (!response.ok) return [];
  const data = (await response.json()) as { tenants?: { id: string; display_name?: string }[] };
  return (data.tenants ?? []).map((t) => ({ id: t.id, label: t.display_name || t.id }));
}

/** Derive the tenant from the `tenant::…` session-id prefix (fallback tag). */
export function tenantOfSessionId(id: string): string | null {
  const i = id.indexOf('::');
  return i > 0 ? id.slice(0, i) : null;
}

/**
 * Fetch chat history across ALL tenants the user may select, tagged and merged
 * newest-first. Tenants are discovered dynamically; each per-tenant call stays
 * tenant-scoped and guarded server-side (no cross-tenant query), so isolation is
 * preserved by construction.
 */
export async function listAllTenantSessions(limit = 50): Promise<SessionInfo[]> {
  const tenants = await getTenants();
  const perTenant = await Promise.all(
    tenants.map((t) => listSessions(limit, t.id).catch(() => [] as SessionInfo[])),
  );
  const seen = new Set<string>();
  return perTenant
    .flat()
    .map((s) => ({
      ...s,
      application_id: s.application_id ?? tenantOfSessionId(s.session_id),
    }))
    .filter((s) => (seen.has(s.session_id) ? false : (seen.add(s.session_id), true)))
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
}

/** Load the message history for a single session. */
export async function getSessionMessages(
  sessionId: string,
  product?: string | null,
): Promise<ChatMessage[]> {
  const response = await fetch(`${SESSIONS_URL}/${encodeURIComponent(sessionId)}/messages`, {
    method: 'GET',
    headers: productHeader(product),
  });

  if (!response.ok) {
    throw new Error(`Failed to load session messages (${response.status}).`);
  }

  const data = (await response.json()) as {
    messages?: { role: string; content: string }[];
  };

  return (data.messages ?? []).map((m, idx) => ({
    id: `${sessionId}_${idx}`,
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));
}

/** Delete a chat session. */
export async function deleteSession(sessionId: string, product?: string | null): Promise<void> {
  const response = await fetch(`${SESSIONS_URL}/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: productHeader(product),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete session (${response.status}).`);
  }
}

/**
 * Generate spoken audio (MP3) for assistant text via the proxy.
 * Returns an audio Blob suitable for an <audio> element / object URL.
 */
export async function synthesizeAudio(
  text: string,
  options: AudioSynthesisOptions = {},
  product?: string | null,
): Promise<Blob> {
  const response = await fetch(CHAT_AUDIO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...productHeader(product) },
    body: JSON.stringify({ text, ...options }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = (await response.json()) as { error?: string };
      detail = data.error ?? '';
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(detail || `Audio playback failed (${response.status}).`);
  }

  return response.blob();
}

/** Upload recorded microphone audio and return the transcribed text. */
export async function transcribeAudio(
  audio: Blob,
  filename = 'voice-input.webm',
  language = 'en',
  product?: string | null,
): Promise<string> {
  const formData = new FormData();
  formData.append('audio_file', audio, filename);
  formData.append('language', language);

  const response = await fetch(CHAT_TRANSCRIBE_URL, {
    method: 'POST',
    headers: productHeader(product),
    body: formData,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = (await response.json()) as { error?: string };
      detail = data.error ?? '';
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(detail || `Voice transcription failed (${response.status}).`);
  }

  const data = (await response.json()) as { text?: string };
  return (data.text ?? '').trim();
}

/**
 * Attach a file to the current conversation as Sales-only session context.
 * Returns the (possibly server-minted) thread id so the follow-up turn resumes the
 * same conversation the file rode. Sales-gated server-side (403 for other tenants).
 */
export async function uploadFile(
  file: File,
  product?: string | null,
  threadId?: string | null,
): Promise<{ threadId: string; filename: string; chars: number }> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  if (threadId) formData.append('thread_id', threadId);

  const response = await fetch(CHAT_ATTACH_URL, {
    method: 'POST',
    headers: productHeader(product),
    body: formData,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = (await response.json()) as { error?: string };
      detail = data.error ?? '';
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(detail || `File attachment failed (${response.status}).`);
  }

  const data = (await response.json()) as {
    thread_id?: string;
    filename?: string;
    chars?: number;
  };
  return {
    threadId: data.thread_id ?? '',
    filename: data.filename ?? file.name,
    chars: data.chars ?? 0,
  };
}

/**
 * Render a generated report to a downloadable file (PDF/Excel/Word) via the proxy.
 * Returns the file Blob plus the server-suggested filename. Sales-gated server-side
 * (403 for tenants without the `reporting` capability).
 */
export async function downloadReport(
  report: ReportPayload,
  format: 'pdf' | 'xlsx' | 'docx',
  product?: string | null,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(CHAT_REPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...productHeader(product) },
    body: JSON.stringify({ report, format }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = (await response.json()) as { error?: string };
      detail = data.error ?? '';
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(detail || `Report download failed (${response.status}).`);
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `${report.filename ?? 'report'}.${format}`;
  return { blob: await response.blob(), filename };
}

/**
 * Correct grammar and spelling in a raw voice transcript via the LLM.
 * Always resolves — returns the original text on any error so callers are never blocked.
 * Pass `context` (e.g. current page URL) for better domain-aware correction.
 */
export async function correctTranscript(
  text: string,
  context?: string,
  product?: string | null,
): Promise<string> {
  if (!text.trim()) return text;
  try {
    const response = await fetch(CHAT_TRANSCRIBE_CORRECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...productHeader(product) },
      body: JSON.stringify({ text, context }),
    });
    if (!response.ok) return text;
    const data = (await response.json()) as { text?: string };
    return (data.text ?? text).trim() || text;
  } catch {
    return text;
  }
}

/** Pre-cache welcome-screen template prompts so the first click responds instantly. */
let warmupSent = false;
export async function warmupCache(prompts: string[]): Promise<void> {
  if (warmupSent) return;
  const cleaned = prompts.map((p) => p.trim()).filter((p) => p.length > 0);
  if (cleaned.length === 0) return;
  warmupSent = true;

  try {
    await fetch(CHAT_WARMUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompts: cleaned }),
      keepalive: true,
    });
  } catch {
    // Warmup is best-effort; ignore failures so the dashboard still loads.
    warmupSent = false;
  }
}

/** On login: reload previously-slow (>30s) prompts into the response cache. */
export async function loginLoadCache(): Promise<void> {
  try {
    await fetch(CHAT_LOGIN_URL, { method: 'POST', keepalive: true });
  } catch {
    // Best-effort; ignore failures so login is never blocked.
  }
}

/** On logout: clear the entire response cache (slow-prompt journal is kept). */
export async function logoutClearCache(): Promise<void> {
  try {
    await fetch(CHAT_LOGOUT_URL, { method: 'POST', keepalive: true });
  } catch {
    // Best-effort; ignore failures so logout is never blocked.
  }
}

/** Generate a professional summary of a conversation transcript for export/share. */
export async function generateExportSummary(
  transcript: string,
  threadId: string | null,
  product?: string | null,
): Promise<string> {
  const response = await fetch(CHAT_EXPORT_SUMMARY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...productHeader(product) },
    body: JSON.stringify({ transcript, thread_id: threadId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate summary (${response.status}).`);
  }

  const data = (await response.json()) as { content?: string };
  return data.content ?? '';
}

/** Fetch the ticket board (grouped/sorted/filtered) for the current user. */
export async function getTicketBoard(
  q = '',
  sort: TicketSort = 'newest',
  product?: string | null,
): Promise<TicketBoardResponse> {
  const params = new URLSearchParams({ sort });
  if (q) params.set('q', q);

  const response = await fetch(`${TICKETS_BOARD_URL}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: productHeader(product),
  });

  if (!response.ok) {
    throw new Error(`Failed to load tickets (${response.status}).`);
  }

  return (await response.json()) as TicketBoardResponse;
}

/** Fetch the raw JSON payload for a single ticket. */
export async function getRawTicket(ticketId: string, product?: string | null): Promise<unknown> {
  const response = await fetch(
    `/api/tickets/${encodeURIComponent(ticketId)}/raw`,
    { method: 'GET', cache: 'no-store', headers: productHeader(product) },
  );

  if (!response.ok) {
    throw new Error(`Failed to load ticket details (${response.status}).`);
  }

  return response.json();
}
