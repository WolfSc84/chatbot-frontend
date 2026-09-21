/**
 * Barge-in: the assistant must stop, stay stopped, and remember only what was heard.
 *
 * Reported from real use as "it keeps talking over me". `flush()` stopped what
 * was sounding and then the very next frame off the socket played — and the
 * existing E2E passed anyway, because it counted `stop()` calls, which flush
 * performs faithfully. It asserted the stop and nothing about what happened next.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlaybackQueue } from './realtime';

/** Minimal AudioContext: jsdom has none, and only the timing matters here. */
class FakeSource {
  onended: (() => void) | null = null;
  started: number | null = null;
  stopped = false;
  buffer: { duration: number } | null = null;
  connect() {}
  start(at: number) { this.started = at; }
  stop() { this.stopped = true; }
}

class FakeContext {
  state = 'running';
  currentTime = 0;
  sources: FakeSource[] = [];
  createBuffer(_ch: number, length: number, rate: number) {
    return { duration: length / rate, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  get destination() { return {}; }
  close() { return Promise.resolve(); }
  resume() { return Promise.resolve(); }
}

let ctx: FakeContext;

// 1600 samples of silence = 100ms at 16-bit / 16kHz-ish; the exact value does
// not matter, only that it decodes to a non-empty buffer.
const FRAME = Buffer.alloc(1600 * 2).toString('base64');

beforeEach(() => {
  ctx = new FakeContext();
  vi.stubGlobal('AudioContext', vi.fn(() => ctx));
});

describe('audio stays stopped after a barge-in', () => {
  it('plays while armed', () => {
    const q = new PlaybackQueue();
    q.enqueue(FRAME, 'item-1');

    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].started).not.toBeNull();
  });

  it('REFUSES frames that arrive after the interruption', () => {
    // The actual defect: frames already in flight when VAD fired used to play.
    const q = new PlaybackQueue();
    q.enqueue(FRAME, 'item-1');
    q.flush();

    q.enqueue(FRAME, 'item-1');
    q.enqueue(FRAME, 'item-1');

    expect(ctx.sources).toHaveLength(1); // only the pre-barge-in frame
    expect(q.isArmed).toBe(false);
  });

  it('stops what is already sounding', () => {
    const q = new PlaybackQueue();
    q.enqueue(FRAME, 'item-1');

    q.flush();

    expect(ctx.sources[0].stopped).toBe(true);
  });

  it('re-arms for a genuinely new turn', () => {
    const q = new PlaybackQueue();
    q.enqueue(FRAME, 'item-1');
    q.flush();

    q.arm();
    q.enqueue(FRAME, 'item-2');

    expect(q.isArmed).toBe(true);
    expect(ctx.sources).toHaveLength(2);
  });

  it('a re-arm that never fires would silence the call — arm() is idempotent', () => {
    const q = new PlaybackQueue();
    q.arm();
    q.arm();
    q.enqueue(FRAME, 'item-1');

    expect(ctx.sources).toHaveLength(1);
  });
});

describe('what the user actually heard', () => {
  it('reports nothing when no item has played', () => {
    expect(new PlaybackQueue().heardSoFar()).toBeNull();
  });

  it('reports the item and the milliseconds genuinely heard', () => {
    const q = new PlaybackQueue();
    q.enqueue(FRAME, 'item-7');
    ctx.currentTime = 0.05; // 50ms of the frame has sounded
    q.flush();

    const heard = q.heardSoFar();
    expect(heard?.itemId).toBe('item-7');
    expect(heard?.playedMs).toBe(50);
  });

  it('never claims more was heard than was scheduled', () => {
    // Frames queued but never reached the speaker were never heard; claiming
    // them would truncate the model's context AFTER what the user got.
    const q = new PlaybackQueue();
    q.enqueue(FRAME, 'item-7');
    ctx.currentTime = 999;
    q.flush();

    const heard = q.heardSoFar();
    expect(heard!.playedMs).toBeLessThanOrEqual(Math.round(ctx.createBuffer(1, 1600, 16000).duration * 1000));
  });

  it('starts counting again for a new assistant item', () => {
    const q = new PlaybackQueue();
    q.enqueue(FRAME, 'item-1');
    ctx.currentTime = 0.08;
    q.flush();
    q.arm();

    q.enqueue(FRAME, 'item-2');
    ctx.currentTime = 0.09;
    q.flush();

    expect(q.heardSoFar()?.itemId).toBe('item-2');
  });
});
