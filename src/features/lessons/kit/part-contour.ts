// ============================================================
// Part contour — a part's notes as one voice's line
// ============================================================
//
// A part sung under a microphone take must be one voice, since the hush
// keeps one sound playing and stops the rest (kit/sound.ts `Sound.hush`):
// so a part is one contour voice (`contourVoice`), built before the take
// opens and booked to start on bar 1's first beat through its `at`
// (Lesson 26 WEB-SPEC, Audio, A part under a take; What the kit and the
// app still need, item 6). This turns the part's notes into that voice's
// line: each note a held point at its pitch, joined to the next by a
// glide of 0.05 s that ends on the next note's first beat, so every note
// arrives on its beat; and two notes on one pitch in a row, which Lesson
// 26's parts never have and Lesson 28's song may, struck again by a dip
// in level to a quarter for 0.08 s between them. Lesson 14's song keeps
// its own line (lesson-14/song.ts), with its swells and its own dip.

import { hz } from './notes'
import type { ContourPoint } from './sound'

/** One note of a part: its MIDI note and its length, seconds. */
export interface PartNote {
  readonly midi: number
  readonly sec: number
}

/** Seconds of the glide from one note to the next, ending on the next note's first beat. */
export const PART_GLIDE_SEC = 0.05

/** The dip between two notes on one pitch: its lowest level, a share of the voice's, and its length, seconds. */
export const PART_DIP = { level: 0.25, sec: 0.08 } as const

/** Rounds a time to the microsecond, so points summed from lengths compare cleanly. */
const at = (t: number): number => Math.round(t * 1e6) / 1e6

/**
 * The contour of `notes` sung one after another from time 0: each held at
 * its pitch, gliding to the next over the last 0.05 s of its length, or
 * dipping to a quarter for 0.08 s, its middle on the boundary, into a
 * repeated pitch; the last held to its end, where the voice's release
 * begins. Empty for no notes.
 */
export function partContour(notes: readonly PartNote[]): ContourPoint[] {
  const first = notes[0]
  if (first === undefined) return []
  const points: ContourPoint[] = [{ t: 0, hz: hz(first.midi), level: 1 }]
  let end = 0
  notes.forEach((n, i) => {
    end += n.sec
    const next = notes[i + 1]
    if (next === undefined) {
      points.push({ t: at(end), hz: hz(n.midi), level: 1 })
      return
    }
    if (next.midi === n.midi) {
      const half = PART_DIP.sec / 2
      points.push({ t: at(end - half), hz: hz(n.midi), level: 1 })
      points.push({ t: at(end), hz: hz(n.midi), level: PART_DIP.level })
      points.push({ t: at(end + half), hz: hz(n.midi), level: 1 })
      return
    }
    points.push({ t: at(end - PART_GLIDE_SEC), hz: hz(n.midi), level: 1 })
    points.push({ t: at(end), hz: hz(next.midi), level: 1 })
  })
  return points
}
