/**
 * The product selector must never be left empty by a transient failure.
 *
 * `getTenants()` used to return [] for every non-401 failure, the provider wrote
 * that into state once on mount, and nothing ever asked again — so one 500/503/429
 * or dropped connection emptied the dropdown until the page was reloaded. The window
 * is ordinary: ca-ai-core's lifespan waits for the agent tier before it serves, so a
 * login right after the stack starts lands in it.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Hoisted: vi.mock is lifted above ordinary declarations, so the factory below
// cannot close over plain consts defined here.
const { FakeSessionExpired, FakeTenantsUnavailable, getTenants } = vi.hoisted(() => ({
  FakeSessionExpired: class FakeSessionExpired extends Error {},
  FakeTenantsUnavailable: class FakeTenantsUnavailable extends Error {},
  getTenants: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/lib/realtime', () => ({
  RealtimeVoiceSession: class {
    start = vi.fn();
    stop = vi.fn();
  },
}));

vi.mock('@/lib/api', () => ({
  deleteSession: vi.fn(),
  generateExportSummary: vi.fn(),
  getRawTicket: vi.fn(),
  getSessionMessages: vi.fn(async () => []),
  getTenants: (...args: unknown[]) => getTenants(...args),
  SessionExpiredError: FakeSessionExpired,
  TenantsUnavailableError: FakeTenantsUnavailable,
  downloadReport: vi.fn(),
  getTicketBoard: vi.fn(async () => []),
  listAllTenantSessions: vi.fn(async () => []),
  streamChat: vi.fn(),
  synthesizeAudio: vi.fn(),
  tenantOfSessionId: vi.fn(() => null),
  uploadFile: vi.fn(),
}));

import { AssistantProvider, useAssistant } from './AssistantContext';

function Probe() {
  const { availableTenants, tenantsLoading } = useAssistant();
  return (
    <div>
      <span data-testid="loading">{String(tenantsLoading)}</span>
      <span data-testid="tenants">{availableTenants.map((t) => t.id).join(',')}</span>
    </div>
  );
}

const renderProbe = () =>
  render(
    <AssistantProvider>
      <Probe />
    </AssistantProvider>,
  );

afterEach(() => {
  getTenants.mockReset();
  vi.useRealTimers();
});

describe('tenant discovery', () => {
  it('recovers from a transient failure instead of showing an empty picker', async () => {
    getTenants
      .mockRejectedValueOnce(new FakeTenantsUnavailable('503'))
      .mockResolvedValueOnce([{ id: 'nabors_support', label: 'Nabors Support' }]);

    await act(async () => {
      renderProbe();
    });

    await waitFor(() => expect(screen.getByTestId('tenants').textContent).toBe('nabors_support'));
    expect(getTenants).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('stops after a bounded number of attempts and shows the empty state', async () => {
    getTenants.mockRejectedValue(new FakeTenantsUnavailable('503'));

    await act(async () => {
      renderProbe();
    });

    // Never a spinner that never resolves — a user entitled to nothing must land
    // on an empty list, and so must an outage. Timeout exceeds the total backoff
    // (400ms + 800ms) so this waits for exhaustion rather than racing it.
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'), {
      timeout: 4000,
    });
    expect(screen.getByTestId('tenants').textContent).toBe('');
    expect(getTenants.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('does not retry an expired session — that needs a re-login, not patience', async () => {
    getTenants.mockRejectedValue(new FakeSessionExpired('401'));

    await act(async () => {
      renderProbe();
    });

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(getTenants).toHaveBeenCalledTimes(1);
  });

  it('accepts a genuinely empty list without retrying', async () => {
    getTenants.mockResolvedValue([]);

    await act(async () => {
      renderProbe();
    });

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(getTenants).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tenants').textContent).toBe('');
  });
});
