/**
 * A dropped live call must cost the microphone, not the conversation.
 *
 * Reported from a real session: a red "Live voice disconnected." appeared and voice
 * could not be restarted — the user had to open a new conversation and lost the one
 * they were in. The socket closing is routine (an idle call is closed on purpose so
 * it stops costing money), but the handler treated a RECOVERABLE close by skipping
 * stopLiveVoice(), which is the only thing that nulls the session ref — and
 * startLiveVoice early-returns while that ref is set.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handlers = {
  onUserTranscript: (text: string, final: boolean) => void;
  onAssistantText: (text: string, final: boolean) => void;
  onCard?: (card: {
    kind: string;
    markdown: string;
    supersedesText: boolean;
  }) => void;
  onReady?: (info: { thread_id?: string }) => void;
  onError: (message: string, recoverable: boolean) => void;
};

let captured: Handlers | null = null;
let constructed = 0;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/lib/api", () => ({
  deleteSession: vi.fn(),
  generateExportSummary: vi.fn(),
  getRawTicket: vi.fn(),
  getSessionMessages: vi.fn(async () => []),
  getTenants: vi.fn(async () => [
    { id: "nabors_support", label: "Nabors Support" },
  ]),
  SessionExpiredError: class SessionExpiredError extends Error {},
  downloadReport: vi.fn(),
  getTicketBoard: vi.fn(async () => []),
  listAllTenantSessions: vi.fn(async () => []),
  streamChat: vi.fn(),
  synthesizeAudio: vi.fn(),
  tenantOfSessionId: vi.fn(() => null),
  uploadFile: vi.fn(),
}));

vi.mock("@/lib/realtime", () => ({
  REALTIME_SAMPLE_RATE: 24000,
  isRealtimeSupported: () => true,
  RealtimeDisabledError: class RealtimeDisabledError extends Error {},
  MicCapture: class MicCapture {},
  PlaybackQueue: class PlaybackQueue {},
  RealtimeSession: class RealtimeSession {
    constructor(handlers: Handlers) {
      captured = handlers;
      constructed += 1;
    }
    async start() {}
    stop() {}
  },
}));

import { AssistantProvider, useAssistant } from "./AssistantContext";

const ANSWER = "Product detail is at [nabors.com](https://www.nabors.com/).";
const RESTATEMENT =
  "Here is what I can help with. I am Nabors Support for Nabors and Canrig.";
const DRAFT = "| Affected application | Nabors Support |";
const SUMMARY = "Shall I file that ticket?";

function Probe() {
  const { messages, setProduct, setInputMode } = useAssistant();
  return (
    <div>
      <span data-testid="count">{messages.length}</span>
      <span data-testid="body">
        {messages.map((m) => `[${m.role}]${m.content}`).join("||")}
      </span>
      <button onClick={() => setProduct("nabors_support")}>pick</button>
      <button onClick={() => setInputMode("live")}>live</button>
    </div>
  );
}

async function startVoice() {
  render(
    <AssistantProvider>
      <Probe />
    </AssistantProvider>,
  );
  await act(async () => {
    screen.getByText("pick").click();
  });
  await act(async () => {
    screen.getByText("live").click();
  });
  if (!captured) throw new Error("live voice session was never constructed");
  return captured;
}

beforeEach(() => {
  captured = null;
  constructed = 0;
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a live call that drops", () => {
  it("can be started again — the ref is released even on a recoverable close", async () => {
    const h = await startVoice();
    expect(constructed).toBe(1);

    await act(async () => {
      h.onError("Live voice disconnected.", true);
    });

    // Restarting must build a NEW session. While the stale ref survived, this was a
    // silent no-op for the rest of the conversation's life.
    await act(async () => {
      screen.getByText("live").click();
    });
    expect(constructed).toBe(2);
  });

  it("keeps the conversation on screen", async () => {
    const h = await startVoice();

    await act(async () => {
      h.onUserTranscript("what tickets do I have open", true);
      h.onAssistantText("You have four.", true);
      h.onError("Live voice disconnected.", true);
    });

    const body = screen.getByTestId("body").textContent ?? "";
    expect(body).toContain("what tickets do I have open");
    expect(body).toContain("You have four.");
  });

  it("still tears down on a close that cannot be retried", async () => {
    const h = await startVoice();

    await act(async () => {
      h.onError("Live voice is not available for this session.", false);
    });

    await act(async () => {
      screen.getByText("live").click();
    });
    expect(constructed).toBe(2);
  });
});
