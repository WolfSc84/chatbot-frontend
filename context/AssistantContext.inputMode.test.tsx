/**
 * Regression test for the defect that actually shipped in the input-mode work.
 *
 * Routing the live-voice button through `setInputMode` and acting on the
 * DIFFERENCE from the current mode meant that when the opening mode was already
 * 'live' but no socket was open, "set mode to live" changed nothing and started
 * nothing — the button silently did nothing. TypeScript and ESLint both passed;
 * only an end-to-end harness several steps removed from the cause caught it.
 *
 * This is the cheap test that should have caught it, which is why this runner
 * exists at all.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startSpy = vi.fn();
const stopSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/lib/api', () => ({
  deleteSession: vi.fn(),
  generateExportSummary: vi.fn(),
  getRawTicket: vi.fn(),
  getSessionMessages: vi.fn(async () => []),
  getTenants: vi.fn(async () => []),
  SessionExpiredError: class SessionExpiredError extends Error {},
  downloadReport: vi.fn(),
  getTicketBoard: vi.fn(async () => []),
  listAllTenantSessions: vi.fn(async () => []),
  streamChat: vi.fn(),
  synthesizeAudio: vi.fn(),
  tenantOfSessionId: vi.fn(() => null),
  uploadFile: vi.fn(),
}));

vi.mock('@/lib/realtime', () => ({
  REALTIME_SAMPLE_RATE: 24000,
  isRealtimeSupported: () => true,
  RealtimeDisabledError: class RealtimeDisabledError extends Error {},
  MicCapture: class MicCapture {},
  PlaybackQueue: class PlaybackQueue {},
  RealtimeSession: class RealtimeSession {
    async start() {
      startSpy();
    }
    stop() {
      stopSpy();
    }
  },
}));

import { AssistantProvider, useAssistant } from './AssistantContext';

function Probe() {
  const { inputMode, setInputMode } = useAssistant();
  return (
    <div>
      <span data-testid="mode">{inputMode}</span>
      <button onClick={() => setInputMode('live')}>go-live</button>
      <button onClick={() => setInputMode('text')}>go-text</button>
    </div>
  );
}

beforeEach(() => {
  startSpy.mockClear();
  stopSpy.mockClear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('setInputMode', () => {
  it('asking for the mode already active still acts on it', async () => {
    // The exact shape of the shipped bug: mode is already 'live', no session is
    // running, and the user presses the button. A transition-based
    // implementation does nothing here.
    window.localStorage.setItem('assistant:inputMode', 'live');

    render(
      <AssistantProvider>
        <Probe />
      </AssistantProvider>,
    );

    expect(await screen.findByTestId('mode')).toHaveTextContent('live');

    // Wipe the remembered value so the click has something observable to do.
    // The buggy version returned early on "same mode" BEFORE recording anything,
    // so nothing would be written back and this assertion would fail — which is
    // what gives this test teeth. Verified by reverting the fix.
    window.localStorage.clear();

    await act(async () => {
      screen.getByText('go-live').click();
    });

    expect(window.localStorage.getItem('assistant:inputMode')).toBe('live');
    expect(screen.getByTestId('mode')).toHaveTextContent('live');
  });

  it('remembers every mode change, including a repeat of the current one', async () => {
    render(
      <AssistantProvider>
        <Probe />
      </AssistantProvider>,
    );

    await act(async () => {
      screen.getByText('go-text').click();
    });
    expect(window.localStorage.getItem('assistant:inputMode')).toBe('text');

    await act(async () => {
      screen.getByText('go-live').click();
    });
    expect(window.localStorage.getItem('assistant:inputMode')).toBe('live');
    expect(screen.getByTestId('mode')).toHaveTextContent('live');
  });
});
