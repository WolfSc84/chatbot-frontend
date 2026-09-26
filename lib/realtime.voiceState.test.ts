/**
 * What the status indicator is allowed to claim.
 *
 * Reported on a live call: the indicator said "Listening…" whenever the call was
 * open and unmuted, including every silent moment — and after the assistant's last
 * word it sat on "Speaking…" for the rest of the call, because nothing ever moved
 * it back. Both are statements about the microphone that were not true.
 *
 * 'listening' now means server VAD heard the user START. Everything else on an open,
 * unmuted call is 'waiting'.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  fetchRealtimeTicket: vi.fn(async () => ({
    ticket: "t",
    socket_url: "ws://test",
    mic_energy_floor: 0,
  })),
  RealtimeDisabledError: class extends Error {},
}));

import { RealtimeSession, type RealtimeState } from "./realtime";

let socket: FakeSocket;

class FakeSocket {
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    socket = this;
    queueMicrotask(() => this.onopen?.());
  }
  send() {}
  close() {}
}

const noopNode = () => ({ connect: () => noopNode(), disconnect() {} });

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  audioWorklet = { addModule: async () => undefined };
  createMediaStreamSource() {
    return { connect() {} };
  }
  createAnalyser() {
    return {
      fftSize: 0,
      smoothingTimeConstant: 0,
      frequencyBinCount: 16,
      getByteFrequencyData() {},
      connect() {},
      disconnect() {},
    };
  }
  createGain() {
    return { gain: { value: 0 }, connect: () => noopNode(), disconnect() {} };
  }
  get destination() {
    return {};
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

class FakeWorkletNode {
  port: { onmessage: ((e: { data: Int16Array }) => void) | null } = {
    onmessage: null,
  };
  connect() {
    return noopNode();
  }
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal(
    "AudioContext",
    vi.fn(() => new FakeAudioContext()),
  );
  vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
  vi.stubGlobal("Blob", class {});
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:x",
    revokeObjectURL() {},
  });
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) },
  });
});

afterEach(() => vi.unstubAllGlobals());

async function openCall() {
  const states: RealtimeState[] = [];
  const session = new RealtimeSession({
    onState: (s) => states.push(s),
    onUserTranscript: () => {},
    onAssistantText: () => {},
    onError: () => {},
  });
  await session.start();
  return {
    session,
    states,
    deliver: (e: unknown) => socket.onmessage?.({ data: JSON.stringify(e) }),
  };
}

describe("the live-voice status indicator", () => {
  it("waits for the user rather than claiming to hear them", async () => {
    const { states } = await openCall();

    // The call goes live on 'waiting', not 'listening': nobody has spoken yet.
    expect(states.at(-1)).toBe("waiting");
    expect(states).not.toContain("listening");
  });

  it("says listening only while server VAD says the user is speaking", async () => {
    const { states, deliver } = await openCall();

    deliver({ type: "speech_started" });
    expect(states.at(-1)).toBe("listening");

    deliver({ type: "speech_stopped" });
    expect(states.at(-1)).toBe("thinking");
  });

  it("stops claiming to speak once the audio has run out", async () => {
    const { session, states } = await openCall();

    // The queue is what knows when the last buffer ended; the session listens.
    (
      session as unknown as { playback: { onDrained: (() => void) | null } }
    ).playback.onDrained?.();
    expect(states.at(-1)).not.toBe("speaking");
  });
});
