// Studio output edit — what an edit while playing did to the lane it changed and to a lane it left alone, read from the output around its stamp.
//
// Two steady tones play on two lanes: one the edit changes, one it does not.
// Each is read by a Goertzel filter over windows that hold whole periods of
// both tones, so the other tone adds nothing to the reading. A window that
// does not hold whole periods leaks: 5 ms windows over 330 and 165 Hz read
// one tone's arrival in the other and timed edits that had not happened. So
// the reader refuses tones that its windows cannot hold whole, and every
// window is a whole number of frames at the capture's rate as well: at 44.1
// kHz, the CI runner's rate, 10 ms is 441 frames and 30 ms 1323.
//
// Whole periods are not enough while one tone changes level. A tone fading
// over 30 ms is no longer a single frequency inside a window, and with a
// plain window it read 0.25 dB into the other tone. A periodic Hann window
// leaves two whole-period tones in bins of their own and keeps a fading one
// out of the other's bin, so the readings are weighted by it.
import type { StudioCapture, StudioClickStamp } from './studio-output-capture'
import { frameClock, requireHeld } from './studio-output-span'

/** The level before the stamp is read over this long. */
export const EDIT_STEADY_MS = 300
/** An arrival is timed in windows this long, stepped every quarter millisecond. */
const ARRIVAL_WINDOW_MS = 10
/** Dips are read in windows this long, stepped every millisecond. */
const DIP_WINDOW_MS = 30
/** The settled level is read over this long, `settleMs` after the stamp. */
const SETTLED_MS = 60

const db = (amplitude: number) =>
  amplitude > 0 ? 20 * Math.log10(amplitude) : -120

/** The tone on the lane an edit changes, and the one on a lane it leaves alone, in Hz. */
export interface EditTones {
  readonly edited: number
  readonly untouched: number
}

/** What an edit while playing did to the sound, read around its stamp. */
export interface EditReading {
  /** The edited lane's tone before the edit and once settled, in dBFS. */
  readonly editedBeforeDb: number
  readonly editedAfterDb: number
  /**
   * Audio-clock ms from the stamp until the edited tone has moved half its
   * way, in amplitude, to its new level. Null when it moved less than 1 dB:
   * an edit that changes nothing heard, such as a split.
   */
  readonly heardMs: number | null
  /**
   * How far the untouched lane's tone fell below its quietest steady window
   * before the stamp, in its quietest window after it, in dB (30 ms windows).
   */
  readonly untouchedDipDb: number
  /** The same for the edited lane's tone, below the lower of its levels before and after. */
  readonly editedDipDb: number
  /**
   * The largest second difference of the output between the stamp and the
   * settled level against the largest before the stamp or once settled, in
   * dB. A cut or a jump steps the waveform and shows here; a crossfade,
   * however short, does not, and nor does a lane that is louder after.
   */
  readonly clickDb: number
}

/**
 * Amplitude of one frequency over `windowFrames` from index `at`, weighted by
 * a periodic Hann window (Goertzel). Exact for a steady tone with whole
 * periods in the window.
 */
function toneAmplitude(
  capture: StudioCapture,
  at: number,
  windowFrames: number,
  hz: number,
): number {
  const k = (2 * Math.PI * hz) / capture.sampleRate
  const coefficient = 2 * Math.cos(k)
  let previous = 0
  let before = 0
  for (let i = 0; i < windowFrames; i++) {
    const weight = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / windowFrames)
    const next =
      capture.samples[at + i] * weight + coefficient * previous - before
    before = previous
    previous = next
  }
  const real = previous - before * Math.cos(k)
  const imaginary = before * Math.sin(k)
  // The window's mean weight is a half.
  return (4 * Math.hypot(real, imaginary)) / windowFrames
}

/** Whole frames for a window, refusing one that would hold part of a period or part of a frame. */
function wholeWindow(
  capture: StudioCapture,
  milliseconds: number,
  tones: EditTones,
): number {
  const exact = (value: number) => Math.abs(value - Math.round(value)) < 1e-9
  const frames = (milliseconds * capture.sampleRate) / 1000
  if (!exact(frames))
    throw new Error(
      `A ${milliseconds} ms window is not a whole number of frames at ${capture.sampleRate} Hz.`,
    )
  for (const hz of [tones.edited, tones.untouched])
    if (!exact((milliseconds * hz) / 1000))
      throw new Error(
        `A ${milliseconds} ms window does not hold whole periods of ${hz} Hz.`,
      )
  return Math.round(frames)
}

/** One tone's amplitude in every window from `from` while it fits before `to`, stepping `step`. */
function toneTrace(
  capture: StudioCapture,
  hz: number,
  window: number,
  step: number,
  [from, to]: readonly [number, number],
): { index: number; amplitude: number }[] {
  const trace: { index: number; amplitude: number }[] = []
  for (let at = from; at + window <= to; at += step)
    trace.push({ index: at, amplitude: toneAmplitude(capture, at, window, hz) })
  return trace
}

/** The quietest window of a trace among those `keep` picks. */
function quietest(
  trace: readonly { index: number; amplitude: number }[],
  keep: (index: number) => boolean,
): number {
  let least = Infinity
  for (const { index, amplitude } of trace)
    if (keep(index)) least = Math.min(least, amplitude)
  return least
}

/** The largest second difference over `[from, to)`. */
function largestStep(capture: StudioCapture, from: number, to: number): number {
  const { samples } = capture
  let largest = 0
  for (let i = Math.max(from, 2); i < to; i++)
    largest = Math.max(
      largest,
      Math.abs(samples[i] - 2 * samples[i - 1] + samples[i - 2]),
    )
  return largest
}

/** Where things sit in the capture, as indices into its samples. */
interface EditSpan {
  readonly steadyFrom: number
  readonly stamp: number
  readonly settled: number
  readonly end: number
}

/** The first arrival window whose edited tone has crossed half way from `before` to `after`, as ms after the stamp. */
function arrival(
  capture: StudioCapture,
  span: EditSpan,
  hz: number,
  window: number,
  [before, after]: readonly [number, number],
): number | null {
  const { frames, toMs } = frameClock(capture)
  const halfway = (before + after) / 2
  for (let at = span.stamp; at + window <= span.settled; at += frames(0.25)) {
    const amplitude = toneAmplitude(capture, at, window, hz)
    if (after < before ? amplitude <= halfway : amplitude >= halfway)
      return toMs(at + window / 2 - span.stamp)
  }
  return null
}

/**
 * Read an edit while playing from a capture holding `EDIT_STEADY_MS` before
 * its stamp and `settleMs` plus 60 ms after it. Throws on a capture that
 * misses either part, on tones its windows cannot hold whole, and on a
 * capture with no level to read: a silent or NaN capture is no reading, not
 * a clean edit.
 */
export function readEdit(
  capture: StudioCapture,
  stamp: StudioClickStamp,
  tones: EditTones,
  settleMs: number,
): EditReading {
  const { frames } = frameClock(capture)
  const arrivalWindow = wholeWindow(capture, ARRIVAL_WINDOW_MS, tones)
  const dipWindow = wholeWindow(capture, DIP_WINDOW_MS, tones)
  const steadyWindow = wholeWindow(capture, EDIT_STEADY_MS, tones)
  const settledWindow = wholeWindow(capture, SETTLED_MS, tones)
  const stampIndex =
    Math.round(stamp.contextTime * capture.sampleRate) - capture.startFrame
  const span: EditSpan = {
    steadyFrom: stampIndex - steadyWindow,
    stamp: stampIndex,
    settled: stampIndex + frames(settleMs),
    end: stampIndex + frames(settleMs) + settledWindow,
  }
  requireHeld(capture, span.steadyFrom, span.end)
  const before = toneAmplitude(
    capture,
    span.steadyFrom,
    steadyWindow,
    tones.edited,
  )
  const after = toneAmplitude(
    capture,
    span.settled,
    settledWindow,
    tones.edited,
  )
  const step = frames(1)
  const range = [span.steadyFrom, span.end] as const
  const untouched = toneTrace(capture, tones.untouched, dipWindow, step, range)
  const edited = toneTrace(capture, tones.edited, dipWindow, step, range)
  const steady = (index: number) => index + dipWindow <= span.stamp
  const around = (index: number) =>
    index + dipWindow > span.stamp && index < span.settled
  const untouchedSteady = quietest(untouched, steady)
  const editedFloor = Math.min(
    quietest(edited, steady),
    quietest(edited, (index) => index >= span.settled),
  )
  const steadyStep = Math.max(
    largestStep(capture, span.steadyFrom, span.stamp),
    largestStep(capture, span.settled, span.end),
  )
  if (
    !Number.isFinite(before + after + untouchedSteady + steadyStep) ||
    db(untouchedSteady) <= -60 ||
    Math.max(db(before), db(after)) <= -60
  )
    throw new Error('The capture holds no level to read an edit from.')
  const moved = Math.abs(db(after) - db(before)) >= 1
  return {
    editedBeforeDb: db(before),
    editedAfterDb: db(after),
    heardMs: moved
      ? arrival(capture, span, tones.edited, arrivalWindow, [before, after])
      : null,
    untouchedDipDb: Math.max(
      0,
      db(untouchedSteady) - db(quietest(untouched, around)),
    ),
    editedDipDb: Math.max(0, db(editedFloor) - db(quietest(edited, around))),
    clickDb: Math.max(
      0,
      db(largestStep(capture, span.stamp, span.settled)) - db(steadyStep),
    ),
  }
}
