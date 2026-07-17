// ============================================================
// Glass tests — synthetic pitch-track builders (house pattern:
// pure metrics verified against constructed frame streams).
// ============================================================

import type { PitchFrame } from '@/lib/pitch-f0-stream'

export const FPS = 60

/** f0 in Hz for a MIDI note (A4 = 69 = 440 Hz). */
export function midiToF0(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** A steady voiced tone at `midi` (+ cents detune) for `seconds`. */
export function tone(
  midi: number,
  seconds: number,
  { detuneCents = 0, startT = 0, rms = 0.6 } = {},
): PitchFrame[] {
  const f0 = midiToF0(midi + detuneCents / 100)
  const frames: PitchFrame[] = []
  for (let i = 0; i < Math.round(seconds * FPS); i++) {
    frames.push({ t: startT + i / FPS, f0, conf: 0.9, rms })
  }
  return frames
}

/** Unvoiced frames (breath / silence) for `seconds`. */
export function silence(seconds: number, startT = 0): PitchFrame[] {
  const frames: PitchFrame[] = []
  for (let i = 0; i < Math.round(seconds * FPS); i++) {
    frames.push({ t: startT + i / FPS, f0: 0, conf: 0, rms: 0.001 })
  }
  return frames
}

/** Concatenate segments, re-basing each one's clock to run continuously. */
export function sequence(
  ...parts: Array<(startT: number) => PitchFrame[]>
): PitchFrame[] {
  const frames: PitchFrame[] = []
  let t = 0
  for (const part of parts) {
    const built = part(t)
    frames.push(...built)
    if (built.length > 0) t = built[built.length - 1].t + 1 / FPS
  }
  return frames
}
