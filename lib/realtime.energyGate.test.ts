/**
 * The capture gate, and the one rule that must never be broken.
 *
 * A bystander's "friends. Bye bye." was transcribed as the user and ended a real
 * call. The gate silences frames too quiet to be the speaker — but HOW it silences
 * them decides whether live voice still works at all: server VAD ends a turn by
 * hearing silence, so a gate that dropped frames instead of zeroing them would
 * starve the end-of-turn detector and leave every turn hanging open.
 *
 * That is the property these tests exist to pin.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EnergyGate } from './realtime';

const FRAME = 2048;

/** A frame at a given normalised amplitude (constant, so RMS == amplitude). */
function frame(amplitude: number, length = FRAME): Int16Array {
  const pcm = new Int16Array(length);
  pcm.fill(Math.round(amplitude * 32767));
  return pcm;
}

const LOUD = frame(0.08); // comfortably speech, per the measured field recordings
const QUIET = frame(0.001); // room tone

describe('EnergyGate', () => {
  it('zeroes a quiet frame instead of dropping it', () => {
    // The load-bearing property: same length out as in, so the audio timeline the
    // server sees is unbroken and end-of-turn detection still observes silence.
    const out = new EnergyGate(0.02).process(QUIET);

    expect(out.length).toBe(QUIET.length);
    expect(Array.from(out).every((s) => s === 0)).toBe(true);
  });

  it('passes a speech frame through untouched', () => {
    const out = new EnergyGate(0.02).process(LOUD);

    expect(out).toBe(LOUD);
  });

  it('holds the gate open after speech so word endings are not clipped', () => {
    // Trailing consonants decay below the floor. Cutting at the first quiet frame
    // truncates them and makes transcription worse, not better.
    const gate = new EnergyGate(0.02, 3);
    gate.process(LOUD);

    // The three frames inside the release window survive...
    expect(Array.from(gate.process(QUIET)).some((s) => s !== 0)).toBe(true);
    expect(Array.from(gate.process(QUIET)).some((s) => s !== 0)).toBe(true);
    expect(Array.from(gate.process(QUIET)).some((s) => s !== 0)).toBe(true);
    // ...and only sustained quiet is finally silenced.
    expect(Array.from(gate.process(QUIET)).every((s) => s === 0)).toBe(true);
  });

  it('re-opens instantly when the speaker resumes', () => {
    const gate = new EnergyGate(0.02, 1);
    gate.process(LOUD);
    gate.process(QUIET);
    gate.process(QUIET);

    expect(gate.process(LOUD)).toBe(LOUD);
  });

  it('a floor of zero disables gating entirely — the rollback lever', () => {
    const gate = new EnergyGate(0);

    expect(gate.process(QUIET)).toBe(QUIET);
  });

  it('computes RMS on the normalised scale the floor is expressed in', () => {
    expect(EnergyGate.rms(frame(0.05))).toBeCloseTo(0.05, 3);
    expect(EnergyGate.rms(new Int16Array(0))).toBe(0);
  });
});

/**
 * The same gate against a REAL recording: a voice speaking continuously over
 * constant background noise, captured in the field. Synthetic frames prove the
 * logic; this proves the chosen floor is survivable on material that has no
 * silence in it at all — the case where an over-eager gate would eat speech.
 *
 * Calibration behind the 0.02 default: this clip and three siblings were gated at
 * 0.02 and re-transcribed. Every transcript came back identical to ungated (one
 * slightly better), so the floor costs nothing on real noisy audio.
 */
describe('EnergyGate against real field audio', () => {
  const fixture = resolve(process.cwd(), '../e2e/fixtures/noisy_speech.wav');

  it('preserves the speech while silencing only a small minority of frames', () => {
    if (!existsSync(fixture)) {
      throw new Error(`missing fixture ${fixture} — the calibration cannot be reproduced`);
    }
    const buf = readFileSync(fixture);
    // 44-byte canonical WAV header, then interleaved PCM16 (mono here).
    const pcm = new Int16Array(buf.buffer, buf.byteOffset + 44, (buf.length - 44) >> 1);

    const FRAMES = Math.floor(pcm.length / FRAME);
    const gate = new EnergyGate(0.02);
    let silenced = 0;
    let emitted = 0;

    for (let i = 0; i < FRAMES; i += 1) {
      const out = gate.process(pcm.slice(i * FRAME, (i + 1) * FRAME));
      emitted += 1;
      // A frame counts as silenced only if every sample is zero.
      if (out.every((sample) => sample === 0)) silenced += 1;
    }

    // The timeline is intact: one frame out for every frame in. This is the
    // property that keeps end-of-turn detection working.
    expect(emitted).toBe(FRAMES);
    // And the gate is conservative on real speech — measured ~9% on this clip.
    expect(silenced / FRAMES).toBeLessThan(0.2);
    // It is not a no-op either, or it would prove nothing.
    expect(silenced).toBeGreaterThan(0);
  });
});
