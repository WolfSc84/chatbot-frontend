/**
 * API route: GET /api/env-config   → returns all configurable settings from the repo-root .env
 * API route: POST /api/env-config  → writes a single key back to the .env
 *
 * ⚠️  Every change requires a backend restart (uv run app) to take effect.
 *
 * Security: only keys in CONFIG_SCHEMA are readable/writable — secrets (API keys,
 * connection strings, tokens) are never exposed.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getBackendOrigin } from '@/lib/server/backend';

// process.cwd() = web_interface/ in Next.js App Router, so the repo-root
// `.env` (the single source of truth) lives one directory up.
const ENV_PATH = path.resolve(process.cwd(), '../.env');

type BooleanEntry = {
  type: 'boolean';
  label: string;
  description: string;
  group: string;
  default: boolean;
};
type EnumEntry = {
  type: 'enum';
  label: string;
  description: string;
  group: string;
  options: { value: string; label: string }[];
  default: string;
};
type ConfigEntry = BooleanEntry | EnumEntry;

/** Allow-listed configurable keys. Secrets (keys, tokens, endpoints) are NOT included. */
const CONFIG_SCHEMA: Record<string, ConfigEntry> = {
  // ── Knowledge Base ──────────────────────────────────────────────────
  RETRIEVAL_PRIMARY: {
    type: 'enum',
    label: 'Vector Backend',
    description:
      'turbovec: the shipping quantized local vector index (provider-agnostic). ' +
      'Aliases "local"/"turbo" resolve to the same backend.',
    group: 'Knowledge Base',
    options: [{ value: 'turbovec', label: 'TurboVec (local)' }],
    default: 'turbovec',
  },
  VECTOR_SEARCH_TYPE: {
    type: 'enum',
    label: 'Vector Search Strategy',
    description:
      'mmr: Maximal Marginal Relevance (diverse results). ' +
      'similarity: plain cosine similarity. ' +
      'hybrid_bm25: BM25 keyword + vector ensemble.',
    group: 'Knowledge Base',
    options: [
      { value: 'mmr', label: 'MMR (diverse)' },
      { value: 'similarity', label: 'Similarity' },
      { value: 'hybrid_bm25', label: 'Hybrid BM25 + Vector' },
    ],
    default: 'similarity',
  },
  // ── Storage ──────────────────────────────────────────────────────────
  PERSISTENCE_PRIMARY: {
    type: 'enum',
    label: 'Persistence Backend',
    description:
      'postgres: the durable conversation-history + LangGraph checkpoint store ' +
      '(provider-agnostic; runs locally via the containerized Postgres).',
    group: 'Storage',
    options: [{ value: 'postgres', label: 'Postgres' }],
    default: 'postgres',
  },
  // ── Integrations ─────────────────────────────────────────────────────
  AZDO_TICKETING_ENABLED: {
    type: 'boolean',
    label: 'Azure DevOps Ticketing',
    description:
      'ON: the assistant can create Azure Boards work items via MCP when resolving support requests. ' +
      'OFF: ticket creation is disabled (the assistant still answers questions).',
    group: 'Integrations',
    default: true,
  },
  TICKET_PLATFORM: {
    type: 'enum',
    label: 'Ticket Platform',
    description:
      'azure: tickets are created in Azure DevOps Boards (requires AZDO_* credentials). ' +
      'local: tickets are stored in a local JSON file only.',
    group: 'Integrations',
    options: [
      { value: 'local', label: 'Local JSON' },
      { value: 'azure', label: 'Azure DevOps Boards' },
    ],
    default: 'azure',
  },
  // ── Observability ────────────────────────────────────────────────────
  LANGFUSE_ENABLED: {
    type: 'boolean',
    label: 'Langfuse Tracing',
    description:
      'ON: LLM calls are traced to Langfuse for observability (requires LANGFUSE_HOST + keys; ' +
      'fail-open — silently no-ops if unset). OFF: no traces are sent.',
    group: 'Observability',
    default: false,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function readEnvFile(): string {
  try { return fs.readFileSync(ENV_PATH, 'utf-8'); } catch { return ''; }
}

function parseEnv(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    result[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return result;
}

function setEnvKey(raw: string, key: string, value: string): string {
  const lines = raw.split('\n');
  let found = false;
  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) return line;
    if (trimmed.slice(0, trimmed.indexOf('=')).trim() === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) updated.push(`${key}=${value}`);
  return updated.join('\n');
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const raw = readEnvFile();
  const env = parseEnv(raw);

  const settings = Object.entries(CONFIG_SCHEMA).map(([key, entry]) => {
    const rawValue = env[key];
    if (entry.type === 'boolean') {
      const resolved = rawValue !== undefined
        ? rawValue.toLowerCase() === 'true'
        : entry.default;
      return { key, ...entry, value: resolved, rawValue: rawValue ?? `(not set — defaults to ${entry.default})` };
    } else {
      const resolved = rawValue ?? entry.default;
      return { key, ...entry, value: resolved, rawValue: rawValue ?? `(not set — defaults to ${entry.default})` };
    }
  });

  return NextResponse.json({ settings, envPath: ENV_PATH });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { key: string; value: string | boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { key, value } = body;

  if (!Object.prototype.hasOwnProperty.call(CONFIG_SCHEMA, key)) {
    return NextResponse.json({ error: `Key "${key}" is not in the allowed list.` }, { status: 403 });
  }

  const entry = CONFIG_SCHEMA[key];
  let writeValue: string;

  if (entry.type === 'boolean') {
    if (typeof value !== 'boolean') {
      return NextResponse.json({ error: '"value" must be a boolean for toggle keys.' }, { status: 400 });
    }
    writeValue = value ? 'true' : 'false';
  } else {
    const allowed = entry.options.map((o) => o.value);
    if (!allowed.includes(String(value))) {
      return NextResponse.json(
        { error: `Invalid value "${value}" for "${key}". Allowed: ${allowed.join(', ')}.` },
        { status: 400 },
      );
    }
    writeValue = String(value);
  }

  const raw = readEnvFile();
  const updated = setEnvKey(raw, key, writeValue);

  try {
    fs.writeFileSync(ENV_PATH, updated, 'utf-8');
  } catch (err) {
    return NextResponse.json({ error: `Failed to write .env: ${err}` }, { status: 500 });
  }

  // Trigger backend auto-restart so the new value takes effect.
  // Failure here is non-fatal — the .env write already succeeded.
  let restartTriggered = false;
  let restartError: string | null = null;
  try {
    const backendUrl = getBackendOrigin();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    await fetch(`${backendUrl}/admin/restart`, { method: 'POST', signal: ctrl.signal });
    clearTimeout(t);
    restartTriggered = true;
  } catch (err) {
    restartError = String(err);
  }

  return NextResponse.json({
    ok: true,
    key,
    value: writeValue,
    restartTriggered,
    restartError,
  });
}

