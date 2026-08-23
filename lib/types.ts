export type ChatRole = 'user' | 'assistant';

export type AgentProgressStatus = 'started' | 'completed' | 'error';
export type AgentProgressPhase = 'plan' | 'process' | 'do' | 'respond';
export type AgentProgressKind = 'node' | 'tool';

export interface AgentProgressStep {
  id: string;
  name: string;
  label: string;
  phase: AgentProgressPhase;
  status: AgentProgressStatus;
  kind: AgentProgressKind;
  timestamp?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  executionTimeline?: AgentProgressStep[];
}

export interface SessionInfo {
  session_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string | null;
  /** Affected end-user email this conversation was filed for (L1 support tool). */
  user_affected?: string | null;
  /** Owning tenant token (sales | knowledge_center); null for legacy sessions. */
  application_id?: string | null;
}

export interface StatCardData {
  id: string;
  label: string;
  value: string | number;
  sublabel: string;
  icon: string;
  iconColor: string;
}

export interface EntityItem {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  initial: string;
  favorite?: boolean;
}

export interface Workspace {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompt: string;
}

/** Supported conversation export formats. */
export type ExportFormat = 'pdf' | 'docx' | 'txt' | 'clipboard';

/** Normalized ticket payload from the backend (matches TicketItemResponse). */
export interface TicketItem {
  local_id: string;
  title: string;
  description?: string | null;
  status: string;
  category?: string | null;
  intent_type?: string | null;
  created_at?: string | null;
  reported_by?: string | null;
  /** Affected end-user email the ticket was filed for (L1 support tool). */
  affected_user?: string | null;
  request_count?: number | null;
  request_id?: string | null;
  status_bucket: 'open' | 'in_progress' | 'done' | string;
}

/** Grouped ticket columns for board rendering. */
export interface TicketBoardColumns {
  open: TicketItem[];
  in_progress: TicketItem[];
  done: TicketItem[];
}

/** Counts for each board column. */
export interface TicketCounts {
  open: number;
  in_progress: number;
  done: number;
  total: number;
}

/** Backend-shaped ticket board payload. */
export interface TicketBoardResponse {
  tickets: TicketItem[];
  board: TicketBoardColumns;
  counts: TicketCounts;
}

/** Sort options for the ticket board. */
export type TicketSort = 'newest' | 'oldest' | 'id';
