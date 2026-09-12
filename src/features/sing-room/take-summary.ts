// ============================================================
// Take summary — the four numbers the Sing room's end card says
// ============================================================
//
// A take is a run in the Sing room. Nothing about it is stored while it
// happens: the room feeds the frames it already receives through here when
// the singer stops, and the result is four counts, one sentence, and — if a
// previous take was kept — one line comparing them.
//
// O(1) PER TAKE. `createTakeAccumulator` is the production path: a take can
// run for half an hour, and keeping every frame to answer four questions at
// the end is tens of thousands of objects held for nothing. The accumulator
// keeps a 1-cent histogram, a running minimum and maximum, and two clocks —
// the same four answers in a fixed 5 kB. The batch functions below stay as
// the reference the accumulator is tested against.
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
//   duration        how long the take RAN, voiced and silent together, with
//                   every gap in the frame stream clamped. Not wall clock:
//                   parking a run unmounts the room and the clock with it, and
//                   a take parked for forty seconds reported forty seconds of
//                   singing it never did.
//   range touched   the lowest and the highest note HELD for 150 ms. A
//                   sixteenth of a second at the top of a break is a squeak,
//                   and a range that counts it is a range nobody believes.
//                   A frame covers the interval UNTIL THE NEXT ONE, so the
//                   hold is measured inclusive of that dwell: three frames 64
//                   ms apart span 128 ms of timestamps and hold for 192.
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
export const MAX_FRAME_GAP_MS = 250

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

/**
 * Milliseconds the take RAN, gaps in the frame stream discounted.
 *
 * The same clamp as `voicedMs`, over every frame rather than the voiced ones:
 * silence inside a take is still time spent singing in the room, but the
 * minutes a parked take spent on another tab are not.
 */
export function runMs(frames: readonly TakeFrame[]): number {
  let total = 0
  for (let i = 0; i < frames.length - 1; i++) {
    const gap = frames[i + 1].atMs - frames[i].atMs
    if (gap <= 0) continue
    total += Math.min(gap, MAX_FRAME_GAP_MS)
  }
  return total
}

/**
 * The running half of the range rule, shared by the batch function and the
 * accumulator so there is exactly one definition of "held".
 *
 * `dwell` is how long the frame BEFORE this one covered — a frame is a sample
 * of an interval, not an instant, and the interval runs until the next frame.
 * Without it a hold measured at the production frame rate loses one whole
 * interval: three frames 64 ms apart span 128 ms of timestamps, and a 150 ms
 * rule threw away a note that was held for 192.
 */
function createRangeTracker(holdMs: number): {
  push: (frame: TakeFrame, dwell: number) => void
  finish: (dwell: number) => TakeRange | null
} {
  let lowMidi = Number.POSITIVE_INFINITY
  let highMidi = Number.NEGATIVE_INFINITY
  let runMidi: number | null = null
  let runStart = 0
  let runEnd = 0

  const close = (dwell: number): void => {
    if (runMidi === null) return
    if (runEnd - runStart + dwell >= holdMs) {
      if (runMidi < lowMidi) lowMidi = runMidi
      if (runMidi > highMidi) highMidi = runMidi
    }
    runMidi = null
  }

  return {
    push(frame, dwell) {
      if (!isVoiced(frame)) {
        close(dwell)
        return
      }
      const midi = Math.round(frame.midi)
      if (runMidi === midi) {
        runEnd = frame.atMs
        return
      }
      close(dwell)
      runMidi = midi
      runStart = frame.atMs
      runEnd = frame.atMs
    },
    finish(dwell) {
      close(dwell)
      if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi)) return null
      return {
        lowMidi,
        highMidi,
        lowLabel: noteLabel(lowMidi),
        highLabel: noteLabel(highMidi),
      }
    },
  }
}

/** The longest gap that still counts, as the clocks and the hold all use it. */
function clampGap(previousAtMs: number | null, atMs: number): number {
  if (previousAtMs === null) return 0
  return Math.min(Math.max(0, atMs - previousAtMs), MAX_FRAME_GAP_MS)
}

/** The lowest and highest note held for `holdMs`, or null if none was. */
export function rangeTouched(
  frames: readonly TakeFrame[],
  holdMs: number = RANGE_HOLD_MS,
): TakeRange | null {
  const tracker = createRangeTracker(holdMs)
  let previousAtMs: number | null = null
  let gap = 0
  for (const frame of frames) {
    gap = clampGap(previousAtMs, frame.atMs)
    previousAtMs = frame.atMs
    tracker.push(frame, gap)
  }
  // The last frame has no successor to measure its dwell against, so the one
  // before it is the best estimate there is.
  return tracker.finish(gap)
}

/** `D3` — the note as every line of the end card spells it. */
export function noteLabel(midi: number): string {
  const note = midiToNote(midi)
  return `${note.name}${note.octave}`
}

/**
 * The whole take, or null when there is not enough of it to show.
 *
 * The batch path: every frame in memory at once. Production uses
 * `createTakeAccumulator`, which answers the same four questions in constant
 * space; this stays as the reference the accumulator is tested against, and
 * as the shape a caller with a recorded take in hand can use directly.
 *
 * `takeNumber` counts takes in this session and is the room's to keep: it
 * survives a discard, because "takes this session" is how many times you
 * sang, not how many you decided to keep.
 */
export function summarizeTake(
  frames: readonly TakeFrame[],
  takeNumber: number,
): TakeSummary | null {
  const voiced = voicedMs(frames)
  if (voiced < MIN_VOICED_MS) return null

  const deviations = frames.filter(isVoiced).map((f) => Math.abs(f.cents))

  return {
    durationMs: runMs(frames),
    voicedMs: voiced,
    takeNumber,
    range: rangeTouched(frames),
    heldWithinCents: Math.round(percentile(deviations, 0.8)),
  }
}

/**
 * The same summary, built one frame at a time in constant space.
 *
 * THREE RUNNING ANSWERS, none of which needs the frames kept:
 *
 *   the clocks    two sums of clamped gaps, one over every frame and one
 *                 over the voiced ones.
 *   the range     `createRangeTracker`, which is already incremental.
 *   the cents     a histogram in 1-cent bins. The number is read out loud
 *                 ("held within 12 cents"), so a bin IS the resolution of
 *                 the answer — nothing is lost by rounding on the way in
 *                 instead of on the way out.
 *
 * 1201 bins covers a whole octave of error; anything wilder is a detection
 * artifact and lands in the last bin, where it can push the percentile up
 * but cannot distort it into a number nobody could have sung.
 */
export interface TakeAccumulator {
  push: (frame: TakeFrame) => void
  /** Null under `MIN_VOICED_MS` of voice, exactly as the batch path is. */
  summarize: (takeNumber: number) => TakeSummary | null
  reset: () => void
  /** How many frames have been pushed. The probe reads it; nothing else. */
  readonly frameCount: number
  /** The take's clock, in seconds — the free run's whole x axis. */
  readonly elapsedSeconds: number
}

const MAX_CENTS_BIN = 1200

export function createTakeAccumulator(
  holdMs: number = RANGE_HOLD_MS,
): TakeAccumulator {
  const bins = new Int32Array(MAX_CENTS_BIN + 1)
  let tracker = createRangeTracker(holdMs)
  let voicedFrames = 0
  let voiced = 0
  let ran = 0
  let frames = 0
  let previousAtMs: number | null = null
  let previousVoiced = false
  let gap = 0

  const accumulator: TakeAccumulator = {
    push(frame) {
      gap = clampGap(previousAtMs, frame.atMs)
      // The gap belongs to the frame BEFORE it: that is the interval that
      // frame covered, and whether it counts as voice is that frame's answer.
      ran += gap
      if (previousVoiced) voiced += gap
      previousAtMs = frame.atMs
      previousVoiced = isVoiced(frame)
      frames += 1

      tracker.push(frame, gap)
      if (!previousVoiced) return
      voicedFrames += 1
      const cents = Math.round(Math.abs(frame.cents))
      bins[Math.min(MAX_CENTS_BIN, Math.max(0, cents))] += 1
    },

    summarize(takeNumber) {
      if (voiced < MIN_VOICED_MS) return null
      return {
        durationMs: ran,
        voicedMs: voiced,
        takeNumber,
        // Finishing consumes the tracker's open run; a second call would
        // answer with nothing, so each take is summarized once.
        range: tracker.finish(gap),
        heldWithinCents: binPercentile(bins, voicedFrames, 0.8),
      }
    },

    reset() {
      bins.fill(0)
      tracker = createRangeTracker(holdMs)
      voicedFrames = 0
      voiced = 0
      ran = 0
      frames = 0
      previousAtMs = null
      previousVoiced = false
      gap = 0
    },

    get frameCount() {
      return frames
    },
    get elapsedSeconds() {
      return ran / 1000
    },
  }
  return accumulator
}

/** Nearest-rank, read straight off the histogram. */
function binPercentile(
  bins: Int32Array,
  total: number,
  fraction: number,
): number {
  if (total === 0) return 0
  const rank = Math.min(total, Math.max(1, Math.ceil(fraction * total)))
  let seen = 0
  for (let cents = 0; cents < bins.length; cents++) {
    seen += bins[cents]
    if (seen >= rank) return cents
  }
  return bins.length - 1
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
