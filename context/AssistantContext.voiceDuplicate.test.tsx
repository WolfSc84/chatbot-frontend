/**
 * The duplicated spoken answer, reproduced at the envelope level.
 *
 * Observed on a real `nabors_support` live-voice call: the panel showed the
 * graph's full answer AND, immediately after, the realtime model's reworded
 * restatement of that same answer. Two bubbles, one answer.
 *
 * The cause is ordering, which is why this test drives the exact sequence rather
 * than calling a handler once: the model speaks filler FIRST ("Let me pull up…")
 * and that text goes final, which closes the voice turn — so the restatement
 * that arrives after the card opens a brand-new turn and cannot be caught by a
 * naive "this turn already has a message" check.
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
};

let captured: Handlers | null = null;

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
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a spoken answer that is also displayed", () => {
  it("appears exactly once, even though the model restates it aloud", async () => {
    const h = await startVoice();

    await act(async () => {
      h.onUserTranscript("what can you do for me", true);
      h.onAssistantText("Let me pull up what I can help you with.", true);
      h.onCard?.({ kind: "answer", markdown: ANSWER, supersedesText: true });
      h.onAssistantText(RESTATEMENT, true);
    });

    const body = screen.getByTestId("body").textContent ?? "";
    // The governed answer is on screen, with its link intact...
    expect(body).toContain("nabors.com");
    // ...exactly once...
    expect(body.split(ANSWER).length - 1).toBe(1);
    // ...and the model's reworded copy of it never became a second message.
    expect(body).not.toContain(RESTATEMENT);
  });

  it("still shows a ticket draft alongside its spoken summary", async () => {
    // The draft speaks a SUMMARY, not the draft, so the two carry different
    // content and suppressing either would lose something the user needs.
    const h = await startVoice();

    await act(async () => {
      h.onUserTranscript("raise a ticket", true);
      h.onCard?.({
        kind: "ticket_draft",
        markdown: DRAFT,
        supersedesText: false,
      });
      h.onAssistantText(SUMMARY, true);
    });

    const body = screen.getByTestId("body").textContent ?? "";
    expect(body).toContain(DRAFT);
    expect(body).toContain(SUMMARY);
  });

  it("suppresses a SECOND restatement in the same turn, not just the first", async () => {
    // The flag used to clear on the first assistant `final`, so a turn that produced
    // two responses — a re-route, or a refusal the gate recovered — wrote the second
    // one to the panel as its own message beside the card. Live on 2026-09-25 that is
    // how one "what tickets do I have open" became three bubbles. The turn ends when
    // the USER speaks, not when the model first stops.
    const h = await startVoice();

    await act(async () => {
      h.onUserTranscript("what tickets do I have open", true);
      h.onAssistantText("Let me pull up the current tickets for you.", true);
      h.onCard?.({ kind: "answer", markdown: ANSWER, supersedesText: true });
      h.onAssistantText(RESTATEMENT, true);
      h.onAssistantText(
        "Here are the tickets currently open on your account.",
        true,
      );
    });

    const body = screen.getByTestId("body").textContent ?? "";
    expect(body).toContain("nabors.com");
    expect(body).not.toContain(RESTATEMENT);
    expect(body).not.toContain("Here are the tickets currently open");
  });

  it("starts judging again on the next user turn", async () => {
    // The suppression must not outlive the turn it belongs to, or the next answer
    // — which may legitimately have no card — would be swallowed.
    const h = await startVoice();

    await act(async () => {
      h.onUserTranscript("what tickets do I have open", true);
      h.onCard?.({ kind: "answer", markdown: ANSWER, supersedesText: true });
      h.onAssistantText(RESTATEMENT, true);
    });
    await act(async () => {
      h.onUserTranscript("thanks", true);
      h.onAssistantText("Any time.", true);
    });

    expect(screen.getByTestId("body").textContent ?? "").toContain("Any time.");
  });

  it("leaves an ordinary spoken answer with no card untouched", async () => {
    const h = await startVoice();

    await act(async () => {
      h.onUserTranscript("what is the extension", true);
      h.onAssistantText("Extension x2200.", true);
    });

    expect(screen.getByTestId("body").textContent ?? "").toContain(
      "Extension x2200.",
    );
  });
});
