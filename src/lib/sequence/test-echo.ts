// ============================================================
// Test echoes — sung responses as frame streams, played through the engine
// ============================================================
//
// The parts a response is built from (rests, held notes, slides), Merc's
// phrase at an even pace, and a runner that feeds the frames to
// tickSequence and logs every event with the time of the frame it fired
// on. Frames are 1/60 s apart, as glass/test-frames makes them; for the
// sequence engine's tests.

import { FPS, midiToF0, silence, tone } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { MissedNote, NoteOutcome, Phrase, SequenceEvent, SequencePreset, SequenceState, } from './sequence-engine'
import { createSequenceState, tickSequence } from './sequence-engine'

export const C3 = 48
export const G3 = 55
export const C4 = 60
export const D4 = 62
export const E4 = 64
export const F4 = 65
export const FS4 = 66
export const G4 = 67
export const A4 = 69
export const C5 = 72

export type Part = (startT: number) => PitchFrame[]

export const rest =
  (seconds: number): Part =>
  (startT) =>
    silence(seconds, startT)

export const sing =
  (midi: number, seconds: number, detuneCents = 0): Part =>
  (startT) =>
    tone(midi, seconds, { startT, detuneCents })

/** A straight slide from one note to another, voiced on every frame. */
export const slide =
  (from: number, to: number, seconds: number): Part =>
  (startT) => {
    const n = Math.round(seconds * FPS)
    return Array.from({ length: n }, (_, i) => ({
      t: startT + i / FPS,
      f0: midiToF0(from + ((to - from) * i) / (n - 1)),
      conf: 0.9,
      rms: 0.6,
    }))
  }

/** A held note with a vibrato of `depthCents` either side, at `hz`. */
export const vibrato =
  (midi: number, seconds: number, depthCents: number, hz: number): Part =>
  (startT) => {
    const n = Math.round(seconds * FPS)
    return Array.from({ length: n }, (_, i) => ({
      t: startT + i / FPS,
      f0: midiToF0(
        midi + (depthCents / 100) * Math.sin((2 * Math.PI * hz * i) / FPS),
      ),
      conf: 0.9,
      rms: 0.6,
    }))
  }

/** Merc's notes, each `seconds` long, one straight after the other. */
export function phraseOf(midis: readonly number[], seconds: number): Phrase {
  return {
    notes: midis.map((midi, i) => ({ midi, at: i * seconds, seconds })),
  }
}

export interface Played {
  state: SequenceState
  /** Every event, with the time of the frame it fired on. */
  log: Array<{ t: number; event: SequenceEvent }>
}

export function play(
  frames: readonly PitchFrame[],
  phrase: Phrase,
  preset: SequencePreset,
  responseStart = 0,
): Played {
  let state = createSequenceState(responseStart)
  const log: Played['log'] = []
  for (const frame of frames) {
    state = tickSequence(state, frame, phrase, preset)
    for (const event of state.events) log.push({ t: frame.t, event })
  }
  return { state, log }
}

/** Seconds to whole microseconds, so frame-clock sums compare exactly. */
export const micro = (seconds: number): number => Math.round(seconds * 1e6)

export const onsets = (outcomes: readonly NoteOutcome[]) =>
  outcomes.map((o) => (o.landed ? micro(o.onset) : null))
export const landings = (outcomes: readonly NoteOutcome[]) =>
  outcomes.map((o) => (o.landed ? micro(o.landedAt) : null))
export const asMissed = (
  outcome: NoteOutcome | undefined,
): MissedNote | null =>
  outcome !== undefined && !outcome.landed ? outcome : null
