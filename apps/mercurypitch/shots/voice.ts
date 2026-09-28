// ============================================================
// The fictional singer's voice — a sung phrase, synthesised, as a WAV
// ============================================================
//
// Chromium plays this file as its microphone (the config's
// --use-file-for-fake-audio-capture), so the Sing room draws a real trace
// from a real detector run. Nobody's voice is in it: it is additive
// synthesis, a stack of harmonics shaped like an open vowel, with the
// glides, vibrato and breaths a person sings with, so the line the room
// draws looks like singing rather than a test tone.
//
// The phrase is the harness's own, written for this file: three rising
// lines in C major that climb to E5 and settle on C5. Chromium loops the
// file, and the live capture waits for the held E5 (store.shots.ts), so the
// trace on screen is nearly the whole phrase and the pill names a note.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const RATE = 48_000

/** One sung note: a MIDI number (0 for a breath) and a length in seconds. */
type Note = readonly [midi: number, seconds: number]

// C4 = 60. G4 67, A4 69, B4 71, C5 72, D5 74, E5 76, E4 64.
const PHRASE: readonly Note[] = [
  [0, 0.4],
  [67, 0.5],
  [69, 0.5],
  [72, 1.1],
  [71, 0.45],
  [69, 0.45],
  [67, 1.0],
  [0, 0.3],
  [64, 0.5],
  [67, 0.5],
  [69, 0.5],
  [74, 1.3],
  [72, 0.6],
  [69, 0.9],
  [0, 0.3],
  [67, 0.45],
  [69, 0.45],
  [72, 0.45],
  [76, 2.6],
  [74, 0.5],
  [72, 1.4],
  [0, 1.2],
]

function hz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** A small deterministic generator, so the same notes give the same file. */
function jitter(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648 - 0.5
  }
}

/** How strongly an open vowel lets a harmonic at `freq` Hz through. */
function vowel(freq: number): number {
  const peak = (centre: number, width: number): number =>
    Math.exp(-(((freq - centre) / width) ** 2))
  return peak(700, 260) + 0.6 * peak(1150, 300) + 0.25 * peak(2600, 500)
}

/** The pitch, in MIDI, `local` seconds into a note that follows `from`. */
function pitchAt(
  from: number,
  midi: number,
  local: number,
  at: number,
): number {
  // A 90 ms glide in from the previous note, or a small scoop from below.
  const start = from === 0 ? midi - 0.4 : from
  const glide = Math.min(1, local / 0.09)
  const eased = start + (midi - start) * (1 - (1 - glide) ** 2)
  // Vibrato grows in once a note has been held for a third of a second.
  const depth = Math.min(1, Math.max(0, (local - 0.35) / 0.45)) * 0.06
  return eased + depth * Math.sin(2 * Math.PI * 5.2 * at)
}

function synthesise(): Float32Array {
  const total = PHRASE.reduce((sum, [, seconds]) => sum + seconds, 0)
  const samples = new Float32Array(Math.round(total * RATE))
  const drift = jitter(7)
  let phase = 0
  let index = 0
  let at = 0
  let previous = 0
  for (const [midi, seconds] of PHRASE) {
    const count = Math.round(seconds * RATE)
    for (let k = 0; k < count; k += 1, index += 1) {
      const local = k / RATE
      if (midi === 0) continue
      const freq = hz(pitchAt(previous, midi, local, at + local))
      phase += (2 * Math.PI * freq * (1 + drift() * 0.002)) / RATE
      let value = 0
      for (let harmonic = 1; harmonic <= 12; harmonic += 1) {
        const weight = 0.35 / harmonic + 0.5 * vowel(freq * harmonic)
        value += Math.sin(harmonic * phase) * weight
      }
      // 40 ms in, 80 ms out, so no note clicks.
      const envelope =
        Math.min(1, local / 0.04) * Math.min(1, (seconds - local) / 0.08)
      samples[index] = value * envelope
    }
    at += seconds
    previous = midi
  }
  let peak = 0
  for (const value of samples) peak = Math.max(peak, Math.abs(value))
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = (samples[i] / peak) * 0.6
  }
  return samples
}

/** 16-bit mono PCM in a RIFF container. */
function wavBytes(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((value, i) => {
    const clamped = Math.max(-1, Math.min(1, value))
    data.writeInt16LE(Math.round(clamped * 32_767), i * 2)
  })
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

/** Write the phrase to `path`. */
export function writeVoiceWav(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, wavBytes(synthesise()))
}
