'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Settings2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface EnumOption { value: string; label: string; }

interface BaseSetting {
  key: string;
  label: string;
  description: string;
  group: string;
  rawValue: string;
}
interface BoolSetting extends BaseSetting {
  type: 'boolean';
  value: boolean;
  default: boolean;
}
interface EnumSetting extends BaseSetting {
  type: 'enum';
  value: string;
  options: EnumOption[];
  default: string;
}
type Setting = BoolSetting | EnumSetting;

interface ApiResponse { settings: Setting[]; envPath: string; }
type SaveState = 'idle' | 'saving' | 'restarting' | 'saved' | 'error';
type RestartStatus = 'idle' | 'restarting' | 'ready' | 'timeout';

// ── Confirm dialog ─────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  setting: Setting;
  newValue: string | boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmDialog({ setting, newValue, onConfirm, onCancel }: ConfirmDialogProps) {
  const displayNew =
    setting.type === 'boolean'
      ? (newValue ? 'ON (true)' : 'OFF (false)')
      : String(newValue);
  const displayOld =
    setting.type === 'boolean'
      ? (setting.value ? 'ON (true)' : 'OFF (false)')
      : setting.value;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-gray-100 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Confirm change</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              This will update <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">.env</code> on disk.
            </p>
          </div>
        </div>

        {/* Change summary */}
        <div className="p-5 space-y-3">
          <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Setting</span>
              <span className="font-medium text-gray-900">{setting.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Key</span>
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{setting.key}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">From</span>
              <span className="text-gray-700">{displayOld}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">To</span>
              <span className="font-semibold text-navy-900">{displayNew}</span>
            </div>
          </div>

          {/* Restart warning */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800">
              <strong>The backend will restart and the UI will reload.</strong> The change is
              written to <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">.env</code>,
              the backend re-launches itself (~2&nbsp;s downtime), then this page refreshes
              automatically. In-flight chats may briefly disconnect.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-navy-950 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 active:scale-95"
          >
            Apply &amp; restart backend
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [envPath, setEnvPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [fetchError, setFetchError] = useState('');
  const [saveError, setSaveError] = useState<Record<string, string>>({});
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const [restartStatus, setRestartStatus] = useState<RestartStatus>('idle');

  // Pending confirmation
  const [pending, setPending] = useState<{ setting: Setting; newValue: string | boolean } | null>(null);

  async function load() {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch('/api/env-config');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ApiResponse = await res.json();
      setSettings(data.settings);
      setEnvPath(data.envPath);
    } catch (e) {
      setFetchError(`Failed to load config: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function requestChange(setting: Setting, newValue: string | boolean) {
    setPending({ setting, newValue });
  }

  /** Poll the backend /health endpoint until it responds OK (or timeout). */
  async function waitForBackend(timeoutMs = 60000, intervalMs = 600): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    // Initial grace window so we don't catch the dying old process
    await new Promise((r) => setTimeout(r, 1500));
    while (Date.now() < deadline) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch('/api/backend-health', { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(t);
        if (res.ok) return true;
      } catch {
        // backend not up yet — keep polling
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }

  async function applyChange() {
    if (!pending) return;
    const { setting, newValue } = pending;
    const { key } = setting;
    setPending(null);
    setSaveState((s) => ({ ...s, [key]: 'saving' }));
    setSaveError((e) => { const n = { ...e }; delete n[key]; return n; });

    // Optimistic update
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value: newValue as never } : s))
    );

    try {
      const res = await fetch('/api/env-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: newValue }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();

      setChangedKeys((prev) => new Set(prev).add(key));

      if (data.restartTriggered) {
        // Backend is restarting — flip status and wait for /health
        setSaveState((s) => ({ ...s, [key]: 'restarting' }));
        setRestartStatus('restarting');
        const ok = await waitForBackend();
        if (ok) {
          setRestartStatus('ready');
          setSaveState((s) => ({ ...s, [key]: 'saved' }));
          setChangedKeys(new Set()); // restart succeeded — clear pending list
          // Reload the UI so every page reflects the fresh backend state.
          // Brief delay so the user sees the "Backend restarted" banner first.
          setTimeout(() => window.location.reload(), 1200);
        } else {
          setRestartStatus('timeout');
          setSaveState((s) => ({ ...s, [key]: 'error' }));
          setSaveError((prev) => ({
            ...prev,
            [key]: 'Backend did not come back within 60 s. Restart manually: uv run app',
          }));
        }
      } else {
        // Restart trigger failed (backend not running?). Save still succeeded.
        setSaveState((s) => ({ ...s, [key]: 'saved' }));
        if (data.restartError) {
          setSaveError((prev) => ({
            ...prev,
            [key]: `Saved, but auto-restart failed: ${data.restartError}. Restart manually: uv run app`,
          }));
        }
      }

      setTimeout(() => setSaveState((s) => ({ ...s, [key]: 'idle' })), 2500);
    } catch (e) {
      setSaveState((s) => ({ ...s, [key]: 'error' }));
      setSaveError((prev) => ({ ...prev, [key]: String(e) }));
      // Revert
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value: setting.value as never } : s))
      );
    }
  }

  const groups = settings.reduce<Record<string, Setting[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Confirm dialog */}
      {pending && (
        <ConfirmDialog
          setting={pending.setting}
          newValue={pending.newValue}
          onConfirm={applyChange}
          onCancel={() => setPending(null)}
        />
      )}

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-950">
            <Settings2 className="h-5 w-5 text-accent-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Assistant Config</h1>
            <p className="text-sm text-gray-500">
              Manage backend settings — writes directly to{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">.env</code>
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 active:scale-95"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* ─── PRIOR WARNING ────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">
            Each change auto-restarts the backend and reloads the UI.
          </p>
          <p className="mt-1">
            Settings are written to <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">.env</code>,
            the Python server re-launches itself, then this page refreshes automatically so every
            view picks up the new configuration. Expect a ~2&nbsp;s pause where in-flight chat
            requests may disconnect. The UI confirms before each write.
          </p>
        </div>
      </div>

      {/* Live restart banner */}
      {restartStatus === 'restarting' && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
          <span>
            <strong>Restarting backend…</strong> Waiting for the backend to come back online.
          </span>
        </div>
      )}
      {restartStatus === 'ready' && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>
            <strong>Backend restarted.</strong> Reloading the UI to apply the new configuration…
          </span>
        </div>
      )}
      {restartStatus === 'timeout' && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span>
            <strong>Auto-restart timed out.</strong> The .env was saved, but the backend did not
            respond within 30&nbsp;s. Run{' '}
            <code className="rounded bg-red-100 px-1 py-0.5 text-xs">uv run app</code> manually.
          </span>
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading config…
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([group, items]) => (
            <section key={group}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {group}
              </h2>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {items.map((setting, idx) => (
                  <div
                    key={setting.key}
                    className={`flex items-start justify-between gap-6 px-5 py-4 ${
                      changedKeys.has(setting.key) ? 'bg-amber-50/50' : ''
                    } ${idx < items.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    {/* Left */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{setting.label}</span>
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          {setting.key}
                        </code>
                        {changedKeys.has(setting.key) && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            restart pending
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                        {setting.description}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Raw .env value:{' '}
                        <span className="font-medium text-gray-600">{setting.rawValue}</span>
                      </p>
                      {saveError[setting.key] && (
                        <p className="mt-1 text-xs text-red-600">{saveError[setting.key]}</p>
                      )}
                    </div>

                    {/* Right: control + status */}
                    <div className="flex shrink-0 items-center gap-3 pt-0.5">
                      {saveState[setting.key] === 'saving' && (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      )}
                      {saveState[setting.key] === 'restarting' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      {saveState[setting.key] === 'saved' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      {saveState[setting.key] === 'error' && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}

                      {setting.type === 'boolean' ? (
                        /* Toggle switch */
                        <>
                          <button
                            role="switch"
                            aria-checked={setting.value}
                            aria-label={`Toggle ${setting.label}`}
                            onClick={() => requestChange(setting, !setting.value)}
                            disabled={
                              saveState[setting.key] === 'saving' ||
                              saveState[setting.key] === 'restarting' ||
                              restartStatus === 'restarting'
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-60 ${
                              setting.value ? 'bg-accent-500' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                setting.value ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span
                            className={`w-7 text-sm font-medium ${
                              setting.value ? 'text-emerald-600' : 'text-gray-400'
                            }`}
                          >
                            {setting.value ? 'ON' : 'OFF'}
                          </span>
                        </>
                      ) : (
                        /* Enum select */
                        <select
                          value={setting.value}
                          disabled={
                            saveState[setting.key] === 'saving' ||
                            saveState[setting.key] === 'restarting' ||
                            restartStatus === 'restarting'
                          }
                          onChange={(e) => requestChange(setting, e.target.value)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400 disabled:opacity-60"
                        >
                          {setting.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Env file path */}
          <p className="text-xs text-gray-400">
            File:{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">{envPath}</code>
          </p>
        </div>
      )}
    </div>
  );
}
