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

  it('unmute resumes on the same stream, mute stops sending mic audio', async () => {
    const session = new RealtimeSession(handlers());
    await session.start();

    session.setMuted(false);
    expect(session.isMuted).toBe(false);
    emitFrame();
    expect(sends).toHaveLength(1);
    expect(JSON.parse(sends[0]).type).toBe('audio_append');

    session.setMuted(true);
    emitFrame();
    // A frame still goes out, but it carries SILENCE, not the room. See the
    // flush tests below for why.
    expect(decodeAudio(sends[1])).toEqual([0, 0, 0, 0]);
  });
});

/**
 * Muting mid-utterance used to throw the turn away.
 *
 * Server VAD ends a turn by hearing REALTIME_VAD_SILENCE_MS (2500ms) of silence in
 * the audio it RECEIVES. Dropping frames the instant the user mutes gives it nothing
 * to measure, so the utterance never commits, never transcribes, and no answer ever
 * comes — reported as "I muted after speaking and it cancelled my request".
 */
describe('muting flushes silence so VAD can close the turn', () => {
  it('sends zeroed frames after mute, so the words already spoken still commit', async () => {
    const session = new RealtimeSession(handlers());
    await session.start();
    session.setMuted(false);
    emitFrame();
    sends.length = 0;

    session.setMuted(true);
    emitFrame();

    expect(sends).toHaveLength(1);
    const frame = JSON.parse(sends[0]);
    expect(frame.type).toBe('audio_append');
    // Same length as a real frame, so the gateway's silence clock advances at the
    // same rate; all zeroes, so it adds no word.
    expect(decodeAudio(sends[0])).toEqual([0, 0, 0, 0]);
  });

  it('stops entirely once the flush window has passed', async () => {
    const session = new RealtimeSession(handlers());
    await session.start();
    session.setMuted(false);
    session.setMuted(true);
    sends.length = 0;

    // Past MUTE_FLUSH_MS (3200ms): VAD has long since decided, so nothing more is
    // owed and a muted mic must cost nothing.
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(realNow() + 5000);
    emitFrame();
    emitFrame();
    expect(sends).toHaveLength(0);
    vi.mocked(Date.now).mockRestore();
  });

  it('opening a call muted never flushes — nothing is sent before the first word', async () => {
    const session = new RealtimeSession(handlers());
    await session.start(); // opens muted via the field, not setMuted

    emitFrame();
    emitFrame();
    expect(sends).toHaveLength(0);
  });
});

/** Decode an audio_append envelope back to PCM samples. */
function decodeAudio(raw: string): number[] {
  const b64 = JSON.parse(raw).audio as string;
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return Array.from(new Int16Array(bytes.buffer));
}
