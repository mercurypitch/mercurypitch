// Studio output span — captures stitched end to end on the audio clock, and what a start from silence did to the sound.
//
// One capture holds 32768 frames, 680 ms at 48 kHz and 743 ms at 44.1 kHz:
// less than a cold Play takes to sound and settle. So captures are taken
// every half span and stitched on their audio-clock frames. Frames two
// captures share must agree exactly, or the stitch throws: a capture placed
// a quantum off would otherwise read as a gap, a click or a late start.
//
// Every window, step and position below is a whole frame, as in readSeek:
// a millisecond is 44.1 frames on the CI runner, and fractional positions
// once read samples that do not exist and turned every level into NaN.
import type { Page } from '@playwright/test'
import type { StudioCapture, StudioClickStamp } from './studio-output-capture'
import { captureOutput, untilAudioClock } from './studio-output-capture'

const CAPTURE_FRAMES = 32768

/** Every sample sent to the speakers from audio-clock time `from` to `to`. */
export async function captureSpan(
  page: Page,
  from: number,
  to: number,
): Promise<StudioCapture> {
  const rate = await page.evaluate(
    () => window.__studioCapture?.context.sampleRate ?? 0,
  )
  if (!rate) throw new Error('No audio context is being captured.')
  const span = CAPTURE_FRAMES / rate
  const first = Math.round(from * rate)
  const last = Math.round(to * rate)
  if (last <= first) throw new Error('A span needs an end after its start.')
  const samples = new Float32Array(last - first)
  let filled = first
  let at = from + span / 2
  while (filled < last) {
    await untilAudioClock(page, at)
    const part = await captureOutput(page)
    const partEnd = part.startFrame + part.samples.length
    if (part.startFrame > filled)
      throw new Error(
        `The captures leave ${part.startFrame - filled} frames out at frame ${filled}.`,
      )
    for (let frame = Math.max(first, part.startFrame); frame < filled; frame++)
      if (samples[frame - first] !== part.samples[frame - part.startFrame])
        throw new Error(`Two captures disagree at frame ${frame}.`)
    const end = Math.min(partEnd, last)
    for (let frame = filled; frame < end; frame++)
      samples[frame - first] = part.samples[frame - part.startFrame]
    filled = Math.max(filled, end)
    at = partEnd / rate + span / 2
  }
  return { sampleRate: rate, startFrame: first, samples }
}

const db = (amplitude: number) =>
  amplitude > 0 ? 20 * Math.log10(amplitude) : -120

/** Amplitude of one frequency over `windowFrames` from index `at` (Goertzel), both whole frames. */
export function toneAmplitude(
  capture: StudioCapture,
  at: number,
  windowFrames: number,
  hz: number,
): number {
  const k = (2 * Math.PI * hz) / capture.sampleRate
  const coefficient = 2 * Math.cos(k)
  let previous = 0
  let before = 0
  for (let i = at; i < at + windowFrames; i++) {
    const next = capture.samples[i] + coefficient * previous - before
    before = previous
    previous = next
  }
  const real = previous - before * Math.cos(k)
  const imaginary = before * Math.sin(k)
  return (2 * Math.hypot(real, imaginary)) / windowFrames
}

/** RMS amplitude over `windowFrames` from index `at`. */
export function rms(
  capture: StudioCapture,
  at: number,
  windowFrames: number,
): number {
  let sum = 0
  for (let i = at; i < at + windowFrames; i++)
    sum += capture.samples[i] * capture.samples[i]
  return Math.sqrt(sum / windowFrames)
}

/** Whole frames for a duration, and back, at the capture's own rate. */
export function frameClock(capture: StudioCapture) {
  return {
    frames: (milliseconds: number) =>
      Math.max(1, Math.round((milliseconds * capture.sampleRate) / 1000)),
    toMs: (count: number) => (count * 1000) / capture.sampleRate,
  }
}

/** Throw unless the capture holds `[from, to)` as indices into its samples. */
export function requireHeld(
  capture: StudioCapture,
  from: number,
  to: number,
): void {
  if (from < 0 || to > capture.samples.length)
    throw new Error(
      'The capture does not hold the action and the settled level after it.',
    )
}

/** When a tone first reaches `share` of `target`, as audio-clock ms after `stamp`, timed to the middle of a 5 ms window. */
function toneArrival(
  capture: StudioCapture,
  stampIndex: number,
  untilIndex: number,
  hz: number,
  reached: (amplitude: number) => boolean,
): number | null {
  const { frames, toMs } = frameClock(capture)
  const windowFrames = frames(5)
  for (
    let at = stampIndex;
    at + windowFrames <= untilIndex;
    at += frames(0.25)
  ) {
    if (reached(toneAmplitude(capture, at, windowFrames, hz)))
      return toMs(at + windowFrames / 2 - stampIndex)
  }
  return null
}

/** What a start from silence did, read from the output around one press. */
export interface StartReading {
  /** The output's level in the 30 ms before the press, in dBFS: silence when the song starts from silence. */
  readonly beforeDb: number
  /** The tone's settled amplitude, in dBFS. */
  readonly settledDb: number
  /** Audio-clock ms from the press until the tone first reaches 1 % of that (-40 dB). */
  readonly firstSoundMs: number | null
  /** The same until half of it (-6 dB): most of the attack is over. */
  readonly halfLevelMs: number | null
  /** How far the speakers trail the render clock at the press, as the page reports it, in ms. */
  readonly outputPathMs: number
}

/**
 * Read a start from silence: the press's audio-clock stamp, a tone the song
 * plays, and that tone's level `settleMs` after the press. A capture that
 * does not hold the press and the settled level, or whose tone never came,
 * throws instead of reading as a fast start.
 */
export function readStart(
  capture: StudioCapture,
  press: StudioClickStamp,
  hz: number,
  settleMs: number,
): StartReading {
  const { frames } = frameClock(capture)
  const pressIndex =
    Math.round(press.contextTime * capture.sampleRate) - capture.startFrame
  const settledIndex = pressIndex + frames(settleMs)
  requireHeld(capture, pressIndex - frames(30), settledIndex + frames(20))
  const settled = toneAmplitude(capture, settledIndex, frames(20), hz)
  const before = rms(capture, pressIndex - frames(30), frames(30))
  if (!Number.isFinite(settled + before) || db(settled) <= -60)
    throw new Error('The capture holds no level to read a start from.')
  return {
    beforeDb: db(before),
    settledDb: db(settled),
    firstSoundMs: toneArrival(
      capture,
      pressIndex,
      settledIndex,
      hz,
      (amplitude) => amplitude >= settled / 100,
    ),
    halfLevelMs: toneArrival(
      capture,
      pressIndex,
      settledIndex,
      hz,
      (amplitude) => amplitude >= settled / 2,
    ),
    outputPathMs: outputPathMs(press),
  }
}

/** How far the speakers trail the render clock at a stamp, in ms. */
function outputPathMs(stamp: StudioClickStamp): number {
  return (
    (stamp.contextTime -
      (stamp.outputContextTime +
        (stamp.performanceMs - stamp.outputPerformanceMs) / 1000)) *
    1000
  )
}
