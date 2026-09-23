/**
 * Live-voice mute: a muted mic must send nothing upstream, and unmute must
 * resume instantly on the same warm stream (no reconnect, no re-prompt).
 *
 * This is the fix for "it answers when I'm not talking": the call opens muted,
 * so a noisy room cannot produce a turn before the user taps to talk.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  fetchRealtimeTicket: vi.fn(async () => ({
    ticket: 't',
    socket_url: 'ws://test',
    mic_energy_floor: 0,
  })),
  RealtimeDisabledError: class extends Error {},
}));

import { RealtimeSession } from './realtime';

// The one frame the capture worklet would emit; content is irrelevant here.
const PCM = new Int16Array([1, 2, 3, 4]);

const sends: string[] = [];
let workletNode: { port: { onmessage: ((e: { data: Int16Array }) => void) | null } };

class FakeSocket {
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    queueMicrotask(() => this.onopen?.());
  }
  send(data: string) { sends.push(data); }
  close() {}
}

const noopNode = () => ({ connect: () => noopNode(), disconnect() {} });

class FakeAudioContext {
  state = 'running';
  audioWorklet = { addModule: async () => undefined };
  createMediaStreamSource() { return { connect() {} }; }
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
  createGain() { return { gain: { value: 0 }, connect: () => noopNode(), disconnect() {} }; }
  get destination() { return {}; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

class FakeWorkletNode {
  port: { onmessage: ((e: { data: Int16Array }) => void) | null } = { onmessage: null };
  constructor() { workletNode = this; }
  connect() { return noopNode(); }
  disconnect() {}
}

beforeEach(() => {
  sends.length = 0;
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('AudioContext', vi.fn(() => new FakeAudioContext()));
  vi.stubGlobal('AudioWorkletNode', FakeWorkletNode);
  vi.stubGlobal('Blob', class {});
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL() {} });
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) },
  });
});

afterEach(() => vi.unstubAllGlobals());

function handlers() {
  return {
    onState: () => {},
    onUserTranscript: () => {},
    onAssistantText: () => {},
    onError: () => {},
  };
}

/** Deliver one captured frame the way the worklet port would. */
function emitFrame() {
  workletNode.port.onmessage?.({ data: PCM });
}

describe('live-voice mute drops frames until the user taps to talk', () => {
  it('opens muted and sends nothing', async () => {
    const session = new RealtimeSession(handlers());
    await session.start();

    expect(session.isMuted).toBe(true);
    emitFrame();
    emitFrame();
    expect(sends).toHaveLength(0);
  });

  it('unmute resumes on the same stream, mute silences again', async () => {
    const session = new RealtimeSession(handlers());
    await session.start();

    session.setMuted(false);
    expect(session.isMuted).toBe(false);
    emitFrame();
    expect(sends).toHaveLength(1);
    expect(JSON.parse(sends[0]).type).toBe('audio_append');

    session.setMuted(true);
    emitFrame();
    expect(sends).toHaveLength(1); // no new frame while muted
  });
});
