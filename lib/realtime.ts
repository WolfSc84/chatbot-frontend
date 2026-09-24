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

// Must exceed the gateway's REALTIME_VAD_SILENCE_MS (2500ms default) with margin,
// or the flush stops before VAD has decided the user finished speaking.
const MUTE_FLUSH_MS = 3200;

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

/**
 * Silences captured frames quieter than a floor, so room noise never opens a turn.
 *
 * Two rules decide the shape of this, and both are load-bearing:
 *
 * 1. **Zero the frame; never drop it.** Server VAD ends the user's turn by HEARING
 *    silence. A gate that stopped emitting frames would remove the very silence the
 *    end-of-turn detector waits for, and turns would hang open — a worse failure
 *    than the noise it set out to fix. The frame cadence out of here is identical
 *    to the cadence in; only the samples change.
 * 2. **Hysteresis, or it bites off words.** A bare per-frame comparison clips the
 *    quiet attack of a word and its decay. Once speech opens the gate it stays open
 *    for `release` further frames, so trailing consonants survive.
 *
 * Measured on four real recordings with continuous background noise: at floor 0.02
 * this silenced 3-13% of frames and the transcript was unchanged (one improved).
 *
 * A floor of 0 disables gating entirely — the pre-gate behaviour, and the rollback.
 */
export class EnergyGate {
  private hold = 0;

  constructor(
    private readonly floor: number,
    private readonly release = 3,
  ) {}

  /** Normalised RMS (0..1) of one frame. */
  static rms(pcm: Int16Array): number {
    if (pcm.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < pcm.length; i += 1) {
      const v = pcm[i] / 32768;
      sum += v * v;
    }
    return Math.sqrt(sum / pcm.length);
  }

  /** The frame to send: unchanged when it carries speech, zeroed when it does not. */
  process(pcm: Int16Array): Int16Array {
    if (!(this.floor > 0)) return pcm;
    if (EnergyGate.rms(pcm) >= this.floor) {
      this.hold = this.release;
      return pcm;
    }
    if (this.hold > 0) {
      this.hold -= 1;
      return pcm;
    }
    // Same length, same timing — silence, not absence.
    return new Int16Array(pcm.length);
  }
}

export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;

  /**
   * Resolves once frames are flowing to `onFrame`. Throws on denied permission.
   *
   * `energyFloor` comes from the ticket mint, so it is a per-session server value
   * rather than a build-time constant. 0 (or omitted) leaves capture ungated.
   */
  async start(onFrame: (pcm: Int16Array) => void, energyFloor = 0): Promise<void> {
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
    // The gate runs here rather than inside the worklet: the worklet is built from
    // a source string and cannot be imported by a test, and an untested gate in the
    // live audio path is exactly the thing that must not ship untested. Behaviour is
    // identical — same frames, same order, same cadence.
    const gate = new EnergyGate(energyFloor);
    node.port.onmessage = (event) => onFrame(gate.process(event.data as Int16Array));

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
  // Whether audio is allowed to sound at all. Barge-in disarms; the next turn
  // re-arms. Without this, `flush()` stops what is playing and the very next
  // frame off the socket starts playing again — the assistant talks over the
  // user who just interrupted it, which is what "it keeps talking over me"
  // means in practice. Frames already in transit when VAD fired are exactly the
  // ones this refuses.
  private armed = true;
  // The assistant item currently sounding, and how much of it the user has
  // actually heard. Barge-in reports this to the gateway so the model's context
  // ends where the user's ears did — otherwise it believes it said the whole
  // turn, including the part that was cut off, and a follow-up like "go back to
  // the second step" is reasoned against words nobody heard.
  private itemId: string | null = null;
  private playedSeconds = 0;
  private startedAt: number | null = null;
  // Sum of the actual decoded audio DURATION received for the current item — the
  // real length of what the gateway generated. The scheduled timeline
  // (`cursor - startedAt`) is not this: on a playback underrun each new buffer is
  // scheduled at `max(currentTime, cursor)`, so the timeline grows by the silent
  // gap too. Reporting a truncate point off the gap-inflated timeline overshoots
  // the item's real length and the gateway rejects it ("Audio content of N ms is
  // already shorter than M ms"). Clamping to this never overshoots.
  private contentSeconds = 0;

  private context(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext({ sampleRate: REALTIME_SAMPLE_RATE });
      this.cursor = 0;
    }
    return this.ctx;
  }

  enqueue(b64: string, itemId?: string): void {
    // Checked before decoding: an abandoned response should cost nothing.
    if (!this.armed) return;
    if (itemId && itemId !== this.itemId) {
      // A new assistant item: start counting its audio from zero.
      this.itemId = itemId;
      this.playedSeconds = 0;
      this.startedAt = null;
      this.contentSeconds = 0;
    }
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
    if (this.startedAt === null) this.startedAt = startAt;
    this.cursor = startAt + buffer.duration;
    this.contentSeconds += buffer.duration;
    this.live.add(source);
    source.onended = () => this.live.delete(source);
  }

  /**
   * Barge-in: stop what is sounding, drop what is queued, and refuse what is
   * still arriving until {@link arm} is called for the next turn.
   */
  flush(): void {
    this.armed = false;
    // Freeze how much was heard BEFORE stopping anything: measured from the
    // audio clock rather than counting frames, because frames that were queued
    // but never reached the speaker were never heard.
    const ctx = this.ctx;
    if (ctx && this.startedAt !== null) {
      const heard = ctx.currentTime - this.startedAt;
      // Never claim more was heard than the gateway actually generated. Clamp to
      // the summed content duration, NOT to `cursor - startedAt`: the latter
      // includes silent underrun gaps and overshoots the item's real length,
      // which the gateway rejects on truncate.
      this.playedSeconds = Math.max(0, Math.min(heard, this.contentSeconds));
    }
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

  /**
   * Allow audio to sound again, for a turn that is genuinely new.
   *
   * Called from every signal that can precede a response, not just one: a
   * re-arm that never fires would leave the call permanently silent, which is
   * worse than the bug this guard fixes.
   */
  arm(): void {
    this.armed = true;
  }

  /**
   * What the user actually heard of the current assistant item, for truncation.
   * ``null`` when there is nothing to truncate — no item, or nothing sounded.
   */
  heardSoFar(): { itemId: string; playedMs: number } | null {
    if (!this.itemId) return null;
    return { itemId: this.itemId, playedMs: Math.round(this.playedSeconds * 1000) };
  }

  /** True while assistant audio is still scheduled to play. */
  get speaking(): boolean {
    return this.live.size > 0;
  }

  /** Whether audio is currently allowed to sound (diagnostics and tests). */
  get isArmed(): boolean {
    return this.armed;
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
  /**
   * Displayable content accompanying the speech — a ticket draft, or an answer
   * carrying a link. A Markdown table cannot be read aloud usefully, so the
   * spoken channel summarizes it and the panel shows it.
   *
   * `supersedesText` is the server's verdict on whether the words being spoken
   * for this turn merely restate this card. When true the card IS the turn's
   * message and the spoken restatement must not add a second one; when false
   * (a draft and its short summary) the two carry different content and both
   * belong on screen. The browser never infers this from `kind` — only the
   * server knows which spoken string it chose.
   */
  onCard?: (card: { kind: string; markdown: string; supersedesText: boolean }) => void;
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
  // Live voice opens MUTED: nothing is captured until the user taps to talk, so a
  // noisy room cannot produce a turn before the first word. Muting drops frames
  // in the capture callback rather than stopping the mic track — the stream stays
  // warm, so unmute is instant and never re-prompts for the microphone.
  private muted = true;
  // When the user mutes, keep feeding DIGITAL SILENCE upstream until this moment.
  //
  // Server VAD ends a turn by hearing silence (REALTIME_VAD_SILENCE_MS, 2500ms) in
  // the audio it receives. Cutting the stream dead mid-utterance gives it nothing to
  // measure, so the turn never commits, never transcribes, and dies in the gateway's
  // buffer — muting right after speaking silently threw the request away.
  //
  // Zeroed frames close the turn without adding a word, so the "a muted room cannot
  // start a turn" property still holds: silence alone never triggers speech_started.
  private muteFlushUntil = 0;

  constructor(private handlers: RealtimeHandlers) {}

  get currentState(): RealtimeState {
    return this.state;
  }

  /** Whether the microphone is currently silenced (nothing sent upstream). */
  get isMuted(): boolean {
    return this.muted;
  }

  /** Silence or re-open the microphone without touching the session. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    // Only a mute TRANSITION opens the flush window. A call opens muted via the
    // field directly, so nothing is sent before the user has ever spoken.
    this.muteFlushUntil = muted ? Date.now() + MUTE_FLUSH_MS : 0;
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
    this.muted = true; // every call opens silenced; the user taps to talk
    this.setState('connecting');

    const { ticket, socket_url, mic_energy_floor } = await fetchRealtimeTicket(options);

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

    await this.mic.start(
      (pcm) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (this.muted) {
          // Past the flush window: capture keeps running (warm for instant unmute)
          // but nothing reaches the gateway, so no VAD, no commit, no turn.
          if (Date.now() >= this.muteFlushUntil) return;
          // Inside it: send a same-length frame of zeroes, so VAD can hear the end
          // of whatever the user was mid-way through saying and commit that turn.
          socket.send(
            JSON.stringify({ type: 'audio_append', audio: pcm16ToBase64(new Int16Array(pcm.length)) }),
          );
          return;
        }
        socket.send(JSON.stringify({ type: 'audio_append', audio: pcm16ToBase64(pcm) }));
      },
      // Server-supplied per session. A junk or absent value gates nothing rather
      // than guessing a floor — a live call must never fail closed on a setting.
      typeof mic_energy_floor === 'number' && mic_energy_floor >= 0 ? mic_energy_floor : 0,
    );

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
        // Re-arm 1 of 3 — a fresh session starts able to speak.
        this.playback.arm();
        this.handlers.onReady?.(envelope as { thread_id?: string; session_id?: string });
        break;
      case 'user_transcript':
        this.handlers.onUserTranscript(String(envelope.text ?? ''), Boolean(envelope.final));
        break;
      case 'assistant_text':
        this.handlers.onAssistantText(String(envelope.text ?? ''), Boolean(envelope.final));
        break;
      case 'audio':
        this.playback.enqueue(
          String(envelope.audio ?? ''),
          typeof envelope.item_id === 'string' ? envelope.item_id : undefined,
        );
        this.setState('speaking');
        break;
      case 'speech_started': {
        // Barge-in: the user talked over the assistant. Drop its audio now and
        // tell the server to abandon the response it was still generating.
        //
        // Read what was heard BEFORE flushing clears the count — flush() freezes
        // the figure, so ask for it after.
        this.playback.flush();
        const heard = this.playback.heardSoFar();
        this.send({ type: 'cancel' });
        if (heard) {
          // Cut the model's memory of the turn to what the user actually got,
          // so an interruption becomes usable context rather than a turn the
          // model believes it delivered in full.
          this.send({
            type: 'truncate',
            item_id: heard.itemId,
            audio_end_ms: heard.playedMs,
          });
        }
        this.setState('listening');
        break;
      }
      case 'speech_stopped':
        // Re-arm 2 of 3, and the one that matters. Server VAD emits
        // speech_started when the user begins and speech_stopped when they
        // finish, and `create_response: true` means the next response follows
        // this — so it is the actual turn boundary. Re-arming on a timer would
        // guess, and re-arming on the next assistant_text would race the audio
        // deltas, which are not ordered against it.
        this.playback.arm();
        this.setState('thinking');
        break;
      case 'thinking':
        this.setState('thinking');
        break;
      case 'actions':
        this.handlers.onActions?.((envelope.actions as unknown[]) ?? []);
        break;
      case 'assistant_card': {
        const markdown = typeof envelope.markdown === 'string' ? envelope.markdown : '';
        if (markdown.trim()) {
          this.handlers.onCard?.({
            kind: String(envelope.kind ?? 'unknown'),
            markdown,
            // Absent on an older agents tier — default false, which is exactly
            // today's behaviour (show both), so the browser degrades cleanly.
            supersedesText: envelope.supersedes_text === true,
          });
        }
        break;
      }
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
    // Re-arm 3 of 3: a manually ended turn also precedes a response, and this
    // path never emits speech_stopped. Currently unreachable from the UI — no
    // control calls commit() — but the guard belongs with the send, not with
    // whoever wires a button to it later.
    this.playback.arm();
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
