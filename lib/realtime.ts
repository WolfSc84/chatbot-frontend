/**
 * Live-voice (realtime duplex) browser client.
 *
 * Three pieces, deliberately in one file because they only exist together:
 *   1. `MicCapture`     — getUserMedia -> 24 kHz mono PCM16 frames.
 *   2. `PlaybackQueue`  — gapless scheduling of assistant audio, flushable on barge-in.
 *   3. `RealtimeSession`— the socket, speaking the frozen envelope.
 *
 * The browser opens the socket to `ca-ai-core` directly (a Next.js Route Handler
 * cannot proxy a WebSocket), presenting only the single-use ticket minted
 * server-side. No bearer ever reaches this code.
 */

import { fetchRealtimeTicket, RealtimeDisabledError } from './api';

/** The gateway's wire format. Both directions, both ends. */
export const REALTIME_SAMPLE_RATE = 24000;

// ---------------------------------------------------------------------------
// base64 <-> PCM16
// ---------------------------------------------------------------------------

function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  // Chunked: String.fromCharCode(...bytes) blows the argument limit past ~100k.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToPcm16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  // Copy rather than alias: the byte offset is not guaranteed 2-aligned.
  return new Int16Array(bytes.buffer.slice(0, bytes.length - (bytes.length % 2)));
}

// ---------------------------------------------------------------------------
// 1. Microphone capture
// ---------------------------------------------------------------------------

/**
 * Downsampling happens in the AudioContext, not here: asking for a 24 kHz
 * context makes the browser resample the mic for us. The worklet only has to
 * quantise float -> int16 and batch frames so we are not posting 128 samples at
 * a time across the thread boundary.
 */
const CAPTURE_WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Int16Array(2048);
    this._n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i += 1) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this._buf[this._n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this._n === this._buf.length) {
        const out = this._buf.slice();
        this.port.postMessage(out, [out.buffer]);
        this._n = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;

  /** Resolves once frames are flowing to `onFrame`. Throws on denied permission. */
  async start(onFrame: (pcm: Int16Array) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: REALTIME_SAMPLE_RATE,
      },
    });

    const ctx = new AudioContext({ sampleRate: REALTIME_SAMPLE_RATE });
    this.ctx = ctx;
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: 'text/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    const source = ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(ctx, 'pcm-capture');
    node.port.onmessage = (event) => onFrame(event.data as Int16Array);

    // Level metering reuses the same graph so the existing level-bar UI works.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 32;
    analyser.smoothingTimeConstant = 0.78;
    source.connect(analyser);
    this.analyser = analyser;

    source.connect(node);
    // A worklet with no downstream sink is not guaranteed to be pulled; a muted
    // gain node keeps the graph alive without echoing the mic to the speakers.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    node.connect(sink).connect(ctx.destination);
    this.node = node;
    if (ctx.state === 'suspended') await ctx.resume();
  }

  /** Current input level 0..1, for the level bars. */
  level(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) sum += data[i];
    return data.length ? sum / data.length / 255 : 0;
  }

  /** The actual context rate, so a browser that ignored the hint is visible. */
  sampleRate(): number {
    return this.ctx?.sampleRate ?? 0;
  }

  stop(): void {
    if (this.node) this.node.port.onmessage = null;
    this.node?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.ctx?.close().catch(() => undefined);
    this.node = null;
    this.analyser = null;
    this.stream = null;
    this.ctx = null;
  }
}

// ---------------------------------------------------------------------------
// 2. Playback queue
// ---------------------------------------------------------------------------

/**
 * Assistant audio arrives as many small chunks. Scheduling each one at an
 * explicit cursor rather than `play()`-ing it gives gapless output; keeping the
 * live sources lets barge-in cut them mid-word.
 */
export class PlaybackQueue {
  private ctx: AudioContext | null = null;
  private cursor = 0;
  private live = new Set<AudioBufferSourceNode>();

  private context(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext({ sampleRate: REALTIME_SAMPLE_RATE });
      this.cursor = 0;
    }
    return this.ctx;
  }

  enqueue(b64: string): void {
    const pcm = base64ToPcm16(b64);
    if (!pcm.length) return;
    const ctx = this.context();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

    const buffer = ctx.createBuffer(1, pcm.length, REALTIME_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 0x8000;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, this.cursor);
    source.start(startAt);
    this.cursor = startAt + buffer.duration;
    this.live.add(source);
    source.onended = () => this.live.delete(source);
  }

  /** Barge-in: drop everything queued and stop what is already sounding. */
  flush(): void {
    this.live.forEach((source) => {
      try {
        source.onended = null;
        source.stop();
      } catch {
        /* already finished */
      }
    });
    this.live.clear();
    this.cursor = 0;
  }

  /** True while assistant audio is still scheduled to play. */
  get speaking(): boolean {
    return this.live.size > 0;
  }

  close(): void {
    this.flush();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}

// ---------------------------------------------------------------------------
// 3. Session
// ---------------------------------------------------------------------------

export type RealtimeState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface RealtimeHandlers {
  onState: (state: RealtimeState) => void;
  /** Interim + final transcripts of what the user said. */
  onUserTranscript: (text: string, final: boolean) => void;
  /** Interim + final assistant reply text. */
  onAssistantText: (text: string, final: boolean) => void;
  /** Host-page actions relayed from the graph (navigate, highlight, …). */
  onActions?: (actions: unknown[]) => void;
  onReady?: (info: { thread_id?: string; session_id?: string }) => void;
  onError: (message: string, recoverable: boolean) => void;
}

export interface RealtimeStartOptions {
  threadId?: string | null;
  replyLanguage?: string | null;
  currentPage?: string | null;
  product?: string | null;
}

export { RealtimeDisabledError };

export class RealtimeSession {
  private socket: WebSocket | null = null;
  private mic = new MicCapture();
  private playback = new PlaybackQueue();
  private state: RealtimeState = 'idle';
  private closedByUs = false;

  constructor(private handlers: RealtimeHandlers) {}

  get currentState(): RealtimeState {
    return this.state;
  }

  get micLevel(): number {
    return this.mic.level();
  }

  private setState(next: RealtimeState): void {
    if (this.state === next) return;
    this.state = next;
    this.handlers.onState(next);
  }

  /**
   * Fetch a fresh ticket, open the socket, then start the mic.
   *
   * The ticket is never stored — it lives in this call frame only, and every
   * connect (including a reconnect) mints a new one, because core consumes it
   * atomically on first use.
   */
  async start(options: RealtimeStartOptions = {}): Promise<void> {
    this.closedByUs = false;
    this.setState('connecting');

    const { ticket, socket_url } = await fetchRealtimeTicket(options);

    const socket = new WebSocket(`${socket_url}?ticket=${encodeURIComponent(ticket)}`);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () =>
        // A pre-accept refusal surfaces as a plain handshake failure; the 4xxx
        // close code core logged is not visible to the browser.
        reject(new Error('Live voice refused the connection.'));
      socket.onclose = (event) => {
        if (this.state === 'connecting') reject(new Error(closeReason(event)));
      };
    });

    socket.onmessage = (event) => this.onEnvelope(event.data);
    socket.onerror = null;
    socket.onclose = (event) => {
      if (!this.closedByUs) this.handlers.onError(closeReason(event), true);
      this.teardown();
    };

    await this.mic.start((pcm) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: 'audio_append', audio: pcm16ToBase64(pcm) }));
    });

    this.setState('listening');
  }

  private onEnvelope(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let envelope: Record<string, unknown>;
    try {
      envelope = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (envelope.type) {
      case 'ready':
        this.handlers.onReady?.(envelope as { thread_id?: string; session_id?: string });
        break;
      case 'user_transcript':
        this.handlers.onUserTranscript(String(envelope.text ?? ''), Boolean(envelope.final));
        break;
      case 'assistant_text':
        this.handlers.onAssistantText(String(envelope.text ?? ''), Boolean(envelope.final));
        break;
      case 'audio':
        this.playback.enqueue(String(envelope.audio ?? ''));
        this.setState('speaking');
        break;
      case 'speech_started':
        // Barge-in: the user talked over the assistant. Drop its audio now and
        // tell the server to abandon the response it was still generating.
        this.playback.flush();
        this.send({ type: 'cancel' });
        this.setState('listening');
        break;
      case 'speech_stopped':
        this.setState('thinking');
        break;
      case 'thinking':
        this.setState('thinking');
        break;
      case 'actions':
        this.handlers.onActions?.((envelope.actions as unknown[]) ?? []);
        break;
      case 'error':
        this.handlers.onError(
          String(envelope.message ?? 'Live voice failed.'),
          Boolean(envelope.recoverable),
        );
        if (!envelope.recoverable) this.setState('error');
        break;
      default:
        break;
    }
  }

  /** Type a message into the live session (keyboard still works mid-call). */
  sendText(text: string): void {
    this.send({ type: 'text', text });
    this.setState('thinking');
  }

  /** Manual turn end, for a push-to-talk style control over a live session. */
  commit(): void {
    this.send({ type: 'commit' });
    this.setState('thinking');
  }

  private send(envelope: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(envelope));
    }
  }

  stop(): void {
    this.closedByUs = true;
    try {
      this.socket?.close(1000, 'client hung up');
    } catch {
      /* already gone */
    }
    this.teardown();
  }

  private teardown(): void {
    this.mic.stop();
    this.playback.close();
    this.socket = null;
    this.setState('idle');
  }
}

/** Human-readable reason for a socket close, keyed off core's 4xxx codes. */
function closeReason(event: CloseEvent): string {
  switch (event.code) {
    case 4401:
      return 'The voice session could not be authorised. Try again.';
    case 4403:
      return 'Live voice is not available for this session.';
    case 4429:
      return 'Too many live voice sessions open. Close one and retry.';
    case 4503:
      return 'The voice service is unreachable right now.';
    case 1000:
      return 'Live voice ended.';
    default:
      return event.reason || 'Live voice disconnected.';
  }
}

/** Feature detection for the degrade-to-push-to-talk path. */
export function isRealtimeSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof WebSocket !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}
