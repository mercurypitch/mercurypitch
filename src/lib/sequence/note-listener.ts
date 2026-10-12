// ============================================================
// Note listener — one note's hold state, hearing the voice (pure)
// ============================================================
//
// The sequence engine (sequence-engine.ts) listens for the note it waits
// on with one of these, and in free mode for the note after it with
// another. A listener is a hold-engine state (src/lib/hold/) ticked against
// its note's MIDI, so a note is heard exactly as Long note hears one, and
// lands on the hold's lock. Beside it, the listener keeps the readings that
// counted toward its note, the in-band run's readings and the frame it
// began on, and the first voiced frame it heard.
//
// A frame that does not count is heard as silence. That is how the engine
// keeps the run that landed a note from landing a later one: the held run,
// followed here frame by frame as the hold smooths a centre, until a gap
// starts a new run or the centre leaves the landed note's band.

import type { HoldPreset, HoldState } from '@/lib/hold/hold-engine'
import { createHoldState, HOLD_PRESETS, holdTickFromFrame, tickHold, } from '@/lib/hold/hold-engine'
import type { PitchPoint } from '@/lib/hold/hold-reading'
import { heldCents, offTarget, startsRun } from '@/lib/hold/hold-reading'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { foldCents } from '@/lib/pitch-measurements'

/** The level's rules a listener hears by (the sequence preset's). */
export interface ListenRules {
  /** Half-width of the band around each note, cents. */
  readonly tolCents: number
  /** In band this long, continuously, lands a note. */
  readonly landMs: number
  /** Read the voice against the nearest octave of each note. */
  readonly octaveFold: boolean
}

/** What one note's hold state has heard of the voice. */
export interface NoteListener {
  /** Its hold state; null until it hears its first frame. */
  readonly hold: HoldState | null
  /** The voiced readings that counted toward it, cents off it as sung. */
  readonly heard: readonly PitchPoint[]
  /** The current in-band run's readings, as the hold reads them. */
  readonly bandRun: readonly number[]
  /** The frame the current in-band run began on; null out of band. */
  readonly bandFrom: number | null
  /** Its first voiced frame, counted or not; null until the voice sounds. */
  readonly voicedFrom: number | null
}

/**
 * The voiced run that landed a note, while it may still be that note held
 * over: the note's index and MIDI, the run's smoothed centre against it
 * (as the hold smooths one), and the run's last voiced frame.
 */
export interface HeldRun {
  readonly index: number
  readonly midi: number
  readonly centre: number
  readonly lastVoicedAt: number
}

/** A listener that has heard nothing yet. */
export const UNHEARD: NoteListener = {
  hold: null,
  heard: [],
  bandRun: [],
  bandFrom: null,
  voicedFrom: null,
}

/** Float sums of frame times drift; thresholds compare with this slack. */
const EPS = 1e-6

const holdPresets = new WeakMap<ListenRules, HoldPreset>()

/** The hold engine's preset for one note at this level. */
export function holdPresetFor(preset: ListenRules): HoldPreset {
  let hold = holdPresets.get(preset)
  if (hold === undefined) {
    hold = {
      ...HOLD_PRESETS.exercise,
      tolCents: preset.tolCents,
      lockMs: preset.landMs,
      // The sequence ends notes and phrases itself; the hold never does.
      endMs: Number.POSITIVE_INFINITY,
      goalSeconds: Number.POSITIVE_INFINITY,
    }
    holdPresets.set(preset, hold)
  }
  return hold
}

/** A sung reading as the level judges it: against the nearest octave of the note where it folds. */
function judged(cents: number, preset: ListenRules): number {
  return preset.octaveFold ? foldCents(cents) : cents
}

/** A reading, as the hold reads it, inside the band. */
function inBand(cents: number, preset: ListenRules): boolean {
  return Math.abs(heldCents(judged(cents, preset))) <= preset.tolCents + EPS
}

/**
 * Where the voice reached the band for the run that landed: from the
 * frame the smoothed centre entered it, back over the readings that were
 * already inside it, on the same voiced run.
 */
export function onsetOf(listener: NoteListener, preset: ListenRules): number {
  const heard = listener.heard
  let k = heard.length - 1
  while (k > 0 && heard[k].t > (listener.bandFrom ?? heard[k].t) + EPS) k -= 1
  while (
    k > 0 &&
    inBand(heard[k - 1].cents, preset) &&
    !startsRun(heard[k - 1], heard[k])
  ) {
    k -= 1
  }
  return heard[k].t
}

/**
 * One frame for a note's listener: its hold state ticked against `midi`,
 * with the reading kept when voiced. A frame that does not count is heard
 * as silence.
 */
export function hear(
  listener: NoteListener,
  frame: PitchFrame,
  previous: PitchFrame | null,
  midi: number,
  preset: ListenRules,
  counts: boolean,
): NoteListener {
  const tick = holdTickFromFrame(
    frame,
    listener.hold === null ? null : previous,
    midi,
  )
  const sung = counts ? tick.offCents : null
  const reading = sung === null ? null : judged(sung, preset)
  const hold = tickHold(
    listener.hold ?? createHoldState(),
    { ...tick, offCents: reading },
    holdPresetFor(preset),
  )
  const banded = hold.inBand && reading !== null
  return {
    hold,
    heard:
      sung === null
        ? listener.heard
        : [...listener.heard, { t: frame.t, cents: sung }],
    bandRun: banded ? [...listener.bandRun, heldCents(reading)] : [],
    bandFrom: banded ? (listener.bandFrom ?? frame.t) : null,
    voicedFrom:
      listener.voicedFrom ?? (tick.offCents === null ? null : frame.t),
  }
}

/** The listener's hold state locked on this frame: its note lands. */
export const locked = (listener: NoteListener): boolean =>
  listener.hold?.events.includes('lock') ?? false

/**
 * The held run after this frame. It lets go (null) once a gap starts a
 * new voiced run, or once its smoothed centre, smoothed as the hold
 * smooths one, leaves the band of the note it landed. An unvoiced frame
 * inside the run keeps it, and so does vibrato around the note.
 */
export function followHeldRun(
  run: HeldRun,
  frame: PitchFrame,
  previous: PitchFrame | null,
  preset: ListenRules,
): HeldRun | null {
  const sung = offTarget(frame, run.midi)
  if (sung === null) return run
  const point = { t: frame.t, cents: sung }
  if (startsRun({ t: run.lastVoicedAt, cents: run.centre }, point)) return null
  const dt = previous === null ? 0 : frame.t - previous.t
  const tau = holdPresetFor(preset).centreTauSec
  const alpha = tau > 0 ? 1 - Math.exp(-dt / tau) : 1
  const centre =
    run.centre + alpha * (heldCents(judged(sung, preset)) - run.centre)
  if (Math.abs(centre) > preset.tolCents + EPS) return null
  return { ...run, centre, lastVoicedAt: frame.t }
}
