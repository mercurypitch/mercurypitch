// ============================================================
// Take summary — the four numbers the Sing room's end card says
// ============================================================
//
// A take is a run in the Sing room. Nothing about it is stored while it
// happens: the room feeds the frames it already receives through here when
// the singer stops, and the result is four counts, one sentence, and — if a
// previous take was kept — one line comparing them.
//
// HEADLESS ON PURPOSE (gate 3, owner answer 3). No Solid, no DOM, no store:
// the maths is the part that has to be right, and it is the part a component
// test cannot check. `SingTakeSheet` is a presentation of this and nothing
// more, and a desktop surface that wants the same numbers calls the same
// function rather than growing its own.
//
// The definitions, each of which is a decision and not an implementation
// detail:
//
//   duration        wall clock, voiced and silent together. A take is how
//                   long you were in the room, not how long you made noise.
//   range touched   the lowest and the highest note HELD for 150 ms. A
//                   sixteenth of a second at the top of a break is a squeak,
//                   and a range that counts it is a range nobody believes.
//   held within N   the 80th percentile of |cents| over voiced frames
//                   (nearest-rank), against the nearest scale note in a free
//                   run and against the target in a melody run — the caller
//                   decides which and passes the distance already measured.
//                   A percentile, not a mean: one slide between two notes
//                   drags a mean and cannot move the 80th.
//   under 3 seconds nothing. No sheet, nothing to keep (brief §5).

import { midiToNote } from '@/lib/scale-data'

/** One detection frame, as the room hands it over. */
export interface TakeFrame {
  /** Monotonic milliseconds — `performance.now()`, not a wall clock. */
  atMs: number
  /** Hz, or 0 when the frame heard nothing. */
  freq: number
  /** Distance from the reference note in cents; sign is ignored here. */
  cents: number
  /** The note this frame sat on, as a MIDI number. */
  midi: number
}

export interface TakeRange {
  lowMidi: number
  highMidi: number
  /** `D3`, `A4` — the note as the end card says it. */
  lowLabel: string
  highLabel: string
}

export interface TakeSummary {
  /** Wall clock across the whole run, voiced and silent. */
  durationMs: number
  /** How much of it had a voice in it. */
  voicedMs: number
  /** This take's number within the session, counting from one. */
  takeNumber: number
  /** Null when nothing was held long enough to name. */
  range: TakeRange | null
  /** The 80th percentile of |cents|, rounded. */
  heldWithinCents: number
}

/** A take shorter than this, measured in voiced time, shows no end card. */
export const MIN_VOICED_MS = 3000

/** How long a note has to hold before it counts towards the range. */
export const RANGE_HOLD_MS = 150

/**
 * The longest gap between two frames that still counts as continuous voice.
 *
 * The frame stream is an animation loop, so a gap larger than this is a
 * backgrounded tab or a stalled device — time that passed without anybody
 * singing through it, and counting it would let a run that spent forty
 * seconds in somebody's pocket claim forty seconds of voice.
 */
const MAX_FRAME_GAP_MS = 250

/**
 * Nearest-rank percentile over a list that may be empty.
 *
 * Nearest-rank rather than an interpolated one because the number is read
 * out loud ("held within 12 cents") and has to be a value that was actually
 * measured, not one between two of them.
 */
export function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil(fraction * sorted.length)
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))]
}

const isVoiced = (frame: TakeFrame): boolean =>
  frame.freq > 0 && Number.isFinite(frame.freq)

/** Milliseconds of voice, gaps in the frame stream discounted. */
export function voicedMs(frames: readonly TakeFrame[]): number {
  let total = 0
  for (let i = 0; i < frames.length - 1; i++) {
    if (!isVoiced(frames[i])) continue
    const gap = frames[i + 1].atMs - frames[i].atMs
    if (gap <= 0) continue
    total += Math.min(gap, MAX_FRAME_GAP_MS)
  }
  return total
}

/** The lowest and highest note held for `holdMs`, or null if none was. */
export function rangeTouched(
  frames: readonly TakeFrame[],
  holdMs: number = RANGE_HOLD_MS,
): TakeRange | null {
  let lowMidi = Number.POSITIVE_INFINITY
  let highMidi = Number.NEGATIVE_INFINITY

  let runMidi: number | null = null
  let runStart = 0
  let runEnd = 0

  const closeRun = (): void => {
    if (runMidi === null) return
    if (runEnd - runStart >= holdMs) {
      if (runMidi < lowMidi) lowMidi = runMidi
      if (runMidi > highMidi) highMidi = runMidi
    }
    runMidi = null
  }

  for (const frame of frames) {
    if (!isVoiced(frame)) {
      closeRun()
      continue
    }
    const midi = Math.round(frame.midi)
    if (runMidi === midi) {
      runEnd = frame.atMs
      continue
    }
    closeRun()
    runMidi = midi
    runStart = frame.atMs
    runEnd = frame.atMs
  }
  closeRun()

  if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi)) return null
  return {
    lowMidi,
    highMidi,
    lowLabel: noteLabel(lowMidi),
    highLabel: noteLabel(highMidi),
  }
}

/** `D3` — the note as every line of the end card spells it. */
export function noteLabel(midi: number): string {
  const note = midiToNote(midi)
  return `${note.name}${note.octave}`
}

/**
 * The whole take, or null when there is not enough of it to show.
 *
 * `takeNumber` counts takes in this session and is the room's to keep: it
 * survives a discard, because "takes this session" is how many times you
 * sang, not how many you decided to keep.
 */
export function summarizeTake(
  frames: readonly TakeFrame[],
  run: { startedAtMs: number; endedAtMs: number; takeNumber: number },
): TakeSummary | null {
  const voiced = voicedMs(frames)
  if (voiced < MIN_VOICED_MS) return null

  const deviations = frames.filter(isVoiced).map((f) => Math.abs(f.cents))

  return {
    durationMs: Math.max(0, run.endedAtMs - run.startedAtMs),
    voicedMs: voiced,
    takeNumber: run.takeNumber,
    range: rangeTouched(frames),
    heldWithinCents: Math.round(percentile(deviations, 0.8)),
  }
}

/** `3 min` / `12 sec` — the end card's own unit, never a clock face. */
export function formatTakeDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  if (seconds < 60) return `${seconds} sec`
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

/** `2 takes` / `1 take`. */
export function formatTakeCount(count: number): string {
  return `${count} ${count === 1 ? 'take' : 'takes'}`
}

/** `D3 to A4`, or a dash when nothing was held long enough. */
export function formatRange(range: TakeRange | null): string {
  return range === null ? '—' : `${range.lowLabel} to ${range.highLabel}`
}

/** `12 cents`. */
export function formatCentsValue(cents: number): string {
  return `${cents} cents`
}

/**
 * The one sentence, exactly as screen 16 says it:
 * `3 min · 2 takes · D3 to A4 touched · held within 12 cents`.
 *
 * A take with no held range drops that clause rather than inventing a word
 * for it.
 */
export function takeSentence(summary: TakeSummary): string {
  const parts = [
    formatTakeDuration(summary.durationMs),
    formatTakeCount(summary.takeNumber),
  ]
  if (summary.range !== null) {
    parts.push(`${formatRange(summary.range)} touched`)
  }
  parts.push(`held within ${formatCentsValue(summary.heldWithinCents)}`)
  return parts.join(' · ')
}

/** `25 August 2026` — the end card's date, in the mock's own form. */
export function formatTakeDate(epochMs: number): string {
  const date = new Date(epochMs)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
