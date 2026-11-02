// ============================================================
// The singer's voice against the harmony, one frame at a time
// ============================================================
//
// What one frame of the singer's turn shows: the trail's point, which
// walks along the lamps as the line goes, the voice against the note it is
// on (in the band of light or not) and Merc's face, which follows the voice
// toward that note. Pure: the controller keeps when the voice entered the
// band, and which note the line is on.
//
// The trail's place along the line is a note's position (`pos`): 0 is the
// first lamp, 1 the second, and so on, with a half step either side. Taking
// turns, the voice walks from just before a note's lamp to just past it as
// it sings that note, and on to the next once it lands; together, it walks
// on Merc's clock, a note's lamp at the middle of his note.

import { levelFromRms } from '@/components/room-kit/voice-level'
import { offTarget } from '@/lib/hold/hold-reading'
import type { MercVoice } from '@/lib/merc/sim'
import type { PitchFrame } from '@/lib/pitch-f0-stream'

/** A point of the voice's trail: where along the line, and its pitch. */
export interface HarmonyTrailPoint {
  /** Seconds on the frames' clock. */
  readonly t: number
  /** Along the line, in notes: 0 is the first lamp. */
  readonly pos: number
  /** The voice's pitch, MIDI; null where it was silent. */
  readonly midi: number | null
}

/** Taking turns: from this far before a note's lamp... */
const WALK_FROM = 0.45
/** ...to this far past it, over this long, s. */
const WALK_TO = 0.4
const WALK_SECONDS = 1.4

/** Taking turns: where the voice is along the line, on note `index` since `since`. */
export function turnPos(index: number, since: number, t: number): number {
  const k = Math.min(1, Math.max(0, (t - since) / WALK_SECONDS))
  return index - WALK_FROM + (WALK_FROM + WALK_TO) * k
}

/**
 * Together: where the voice is along the line on Merc's clock, `step` s a
 * note from `start`, a note's lamp at the middle of his note; held to the
 * line's ends.
 */
export function togetherPos(
  t: number,
  start: number,
  step: number,
  notes: number,
): number {
  const pos = (t - start) / step - 0.5
  return Math.min(notes - 0.5, Math.max(-0.5, pos))
}

/** Together: the note Merc is on at `t`, held to the line. */
export function togetherIndex(
  t: number,
  start: number,
  step: number,
  notes: number,
): number {
  return Math.min(notes - 1, Math.max(0, Math.floor((t - start) / step)))
}

export interface HarmonyReading {
  readonly point: HarmonyTrailPoint
  /** Merc's face following the voice; null when the frame has no voice. */
  readonly voice: MercVoice | null
  /** The voice is in the band of light around the note it is on. */
  readonly inBand: boolean
}

/** One frame of the turn, heard against `target` with a band of `tolCents`. */
export function readHarmonyVoice(
  frame: PitchFrame,
  target: number,
  tolCents: number,
  pos: number,
): HarmonyReading {
  const cents = offTarget(frame, target)
  if (cents === null) {
    return {
      point: { t: frame.t, pos, midi: null },
      voice: null,
      inBand: false,
    }
  }
  const midi = target + cents / 100
  return {
    point: { t: frame.t, pos, midi },
    voice: {
      voiced: true,
      cents,
      level: levelFromRms(frame.rms),
      steady: 1 - Math.min(1, Math.abs(cents) / (tolCents * 4)),
      midi,
    },
    inBand: Math.abs(cents) <= tolCents,
  }
}
