// ============================================================
// TV stage lane band — which notes the lane shows, and at what pitch height
// ============================================================
//
// The lane is the phone's zen ribbon drawn for a TV (ZenPitchRibbon.tsx,
// stem-mixer/zen-pitch-ribbon.ts), so it shows what the ribbon shows: the
// notes from 1.5 s behind the now marker to 5.5 s ahead of it, at their real
// pitch, in a band that is the visible notes' range padded by two semitones
// and never narrower than ten. A library module cannot reach into a feature,
// so the rules are restated here, and lane-band.test.ts holds the two to
// the same answers.
//
// The band eases as the ribbon's does, a tenth of the way to the visible
// notes' band every sixtieth of a second, so a new phrase glides in instead
// of jumping. The ribbon keeps that ease as state from frame to frame; here
// it is worked out from the position alone, as the same weighted sum of the
// bands the lane showed over the last 0.8 s of the song. Nothing to keep
// between frames, a paused stage holds still, and a seek lands on the band
// the song would have had there. In a rest the band holds the last phrase's,
// as the ribbon's does, and before the first note it is the first phrase's.
//
// Tests: src/lib/tv-stage/lane-band.test.ts.

import type { TvStageNote } from './protocol'

/** Seconds of song the lane shows behind the now marker, and ahead of it: the ribbon's. */
export const LANE_BEHIND_SEC = 1.5
export const LANE_AHEAD_SEC = 5.5

/** The now marker's place across the lane: the ribbon's, 1.5 of 7 s. */
export const LANE_NOW_RATIO =
  LANE_BEHIND_SEC / (LANE_BEHIND_SEC + LANE_AHEAD_SEC)

/** Semitones of room above the highest note in view and below the lowest. */
const BAND_PAD = 2

/** The narrowest band, in semitones: one phrase on a single note is not a wall. */
export const BAND_MIN_SPAN = 10

/** How far the band moves toward the notes in view each sixtieth of a second. */
export const BAND_EASE = 0.1

/** The ease as a sum: one band a sixtieth of a second, for 0.8 s back. */
const EASE_STEP_SEC = 1 / 60
const EASE_STEPS = 48

/** A pitch band in MIDI numbers, low to high. */
export interface LaneBand {
  readonly low: number
  readonly high: number
}

// Sorted once per song, not every frame: the lane's notes arrive in the
// order the phone keeps them, which an edit can leave out of time order.
// Keyed by the song message's array, which stays the same while the song is on.
const SORTED = new WeakMap<readonly TvStageNote[], SortedNotes>()

/** A song's notes in time order, and how long the longest of them lasts. */
export interface SortedNotes {
  readonly notes: readonly TvStageNote[]
  readonly longest: number
}

/** The song's notes in time order, worked out once per song. */
export function sortedNotes(notes: readonly TvStageNote[]): SortedNotes {
  const kept = SORTED.get(notes)
  if (kept !== undefined) return kept
  const sorted = [...notes].sort((a, b) => a.t0 - b.t0)
  const longest = sorted.reduce(
    (most, note) => Math.max(most, note.t1 - note.t0),
    0,
  )
  const made = { notes: sorted, longest }
  SORTED.set(notes, made)
  return made
}

/** The index of the first note that starts at or after `time`. */
function firstStartingAt(sorted: readonly TvStageNote[], time: number): number {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (sorted[middle].t0 < time) low = middle + 1
    else high = middle
  }
  return low
}

/**
 * The notes that overlap `from`..`to`, in time order. A long note that
 * started before `from` is found too: the search starts as far back as the
 * song's longest note lasts.
 */
function notesBetween(
  sorted: SortedNotes,
  from: number,
  to: number,
): TvStageNote[] {
  const notes = sorted.notes
  const end = firstStartingAt(notes, to)
  const found: TvStageNote[] = []
  for (
    let at = firstStartingAt(notes, from - sorted.longest);
    at < end;
    at += 1
  ) {
    if (notes[at].t1 > from) found.push(notes[at])
  }
  return found
}

/** The notes the lane shows at `position`: those overlapping its window. */
export function notesInView(
  sorted: SortedNotes,
  position: number,
): TvStageNote[] {
  return notesBetween(
    sorted,
    position - LANE_BEHIND_SEC,
    position + LANE_AHEAD_SEC,
  )
}

/** The note sounding at `time`, or null: the first begun and not yet ended. */
export function noteAt(sorted: SortedNotes, time: number): TvStageNote | null {
  const notes = sorted.notes
  const end = firstStartingAt(notes, time + 1e-9)
  for (
    let at = firstStartingAt(notes, time - sorted.longest);
    at < end;
    at += 1
  ) {
    if (time < notes[at].t1) return notes[at]
  }
  return null
}

/**
 * The band of these notes: their range padded by `BAND_PAD`, widened evenly
 * to at least `minSpan`. Null for none.
 */
export function noteBand(
  notes: readonly TvStageNote[],
  minSpan = BAND_MIN_SPAN,
): LaneBand | null {
  if (notes.length === 0) return null
  let low = Infinity
  let high = -Infinity
  for (const note of notes) {
    low = Math.min(low, note.midi)
    high = Math.max(high, note.midi)
  }
  low -= BAND_PAD
  high += BAND_PAD
  const missing = minSpan - (high - low)
  return missing > 0
    ? { low: low - missing / 2, high: high + missing / 2 }
    : { low, high }
}

/**
 * The latest end among the notes that start before `index`, looked for back
 * from there until no earlier note could end later.
 */
function lastEndBefore(sorted: SortedNotes, index: number): number {
  let latest = -Infinity
  for (let at = index - 1; at >= 0; at -= 1) {
    const note = sorted.notes[at]
    if (note.t0 + sorted.longest < latest) break
    latest = Math.max(latest, note.t1)
  }
  return latest
}

/**
 * The band the lane aims for at `position`: the notes in view's. In a rest,
 * the band the last phrase left as its last note went; before the first
 * note, the band the first phrase brings. Null only for a song with no notes.
 */
export function heldBand(
  sorted: SortedNotes,
  position: number,
): LaneBand | null {
  if (sorted.notes.length === 0) return null
  const inView = notesInView(sorted, position)
  if (inView.length > 0) return noteBand(inView)
  const before = firstStartingAt(sorted.notes, position + LANE_AHEAD_SEC)
  if (before === 0) {
    return noteBand(
      notesInView(sorted, sorted.notes[0].t0 - LANE_AHEAD_SEC + 1e-3),
    )
  }
  const lastEnd = lastEndBefore(sorted, before)
  return noteBand(notesInView(sorted, lastEnd + LANE_BEHIND_SEC - 1e-3))
}

/**
 * The band the lane shows at `position`, eased: the bands it aimed for over
 * the last 0.8 s, each weighted as the ribbon's ease weighs it (see the
 * header). Null only for a song with no notes.
 */
export function laneBand(
  notes: readonly TvStageNote[],
  position: number,
): LaneBand | null {
  const sorted = sortedNotes(notes)
  let low = 0
  let high = 0
  let total = 0
  let weight = 1
  for (let step = 0; step < EASE_STEPS; step += 1) {
    const band = heldBand(sorted, position - step * EASE_STEP_SEC)
    // Only a song with no notes has no band.
    if (band === null) return null
    low += band.low * weight
    high += band.high * weight
    total += weight
    weight *= 1 - BAND_EASE
  }
  return { low: low / total, high: high / total }
}
