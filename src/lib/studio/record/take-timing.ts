// ============================================================
// Studio take timing — where a recorded take sits on the song, and when its count-in and click sound
// ============================================================
//
// A take is captured on the clock the song plays on (studio-clock.ts), so
// one anchor relates the two: song frame `frame` leaves the graph for the
// speakers at clock time `time` (a run's startFrame and audibleEpoch,
// run.ts), and every later frame 1/48000 s after. The singer hears a frame
// later than it leaves the graph, by the output path, and what they sing to
// it reaches the capture later again, by the input path. The two together
// are the round trip: a take is late against the song by exactly that.
//
// The take is not moved to make up for it. Its clip keeps the round trip in
// the trim at its start (sourceInFrame), so the clip starts on the song
// frame the singer heard, and nothing at playback is shifted. Every frame
// here is a whole frame of the 48 kHz timeline (whole-frame.ts): the clip's
// start, its trim and its end.
//
// The round trip comes from the best evidence there is: a measured one
// (MicLatencyWizard, mic-latency-store.ts), corrected for the difference
// between the clock it was measured on and the Studio's, which buffers
// more; else what the browser reports of the two paths. The singer's own
// offset is added last.
import { STUDIO_SAMPLE_RATE } from '../model/types'

/** Song frame `frame` leaves the graph at clock time `time`. */
export interface StudioTakeAnchor {
  readonly frame: number
  readonly time: number
}

/** The song frame leaving the graph at clock time `time`, fractional. */
export function takeFrameAt(anchor: StudioTakeAnchor, time: number): number {
  return anchor.frame + (time - anchor.time) * STUDIO_SAMPLE_RATE
}

/** When song frame `frame` leaves the graph. */
export function takeTimeOf(anchor: StudioTakeAnchor, frame: number): number {
  return anchor.time + (frame - anchor.frame) / STUDIO_SAMPLE_RATE
}

/** Where a round trip came from, for the words beside the offset. */
export type StudioRoundTripSource = 'measured' | 'estimated'

export interface StudioRoundTrip {
  /** Taken off the start of every new take, the singer's offset included. */
  readonly seconds: number
  readonly source: StudioRoundTripSource
  /** Before the singer's offset. */
  readonly baseSeconds: number
}

/** An input path for a browser that reports none: a typical capture buffer. */
export const DEFAULT_INPUT_SECONDS = 0.01
/** The longest round trip believed: a Bluetooth headset can be this far behind. */
export const MAX_ROUND_TRIP_SECONDS = 1
/** The singer's offset either way, in ms. */
export const MAX_RECORD_OFFSET_MS = 250

export interface StudioRoundTripEvidence {
  /** The measured round trip for this input, ms; zero or absent when never measured. */
  readonly measuredMs?: number
  /** The output path of the clock that measurement was made on, ms, when it was kept. */
  readonly measuredPathMs?: number | null
  /** The Studio clock's output path now: its baseLatency plus outputLatency, seconds. */
  readonly pathSeconds: number
  /** The input path the microphone track reports, seconds, when it reports one. */
  readonly inputSeconds?: number
  /** The singer's offset, ms: positive moves new takes earlier. */
  readonly offsetMs: number
}

const finitePositive = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/** A latency the browser reports, or none for a missing or nonsensical one. */
export function reportedLatency(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0
}

/** The round trip a new take is trimmed by: measured where it can be, estimated where not. */
export function studioRoundTrip(
  evidence: StudioRoundTripEvidence,
): StudioRoundTrip {
  const path = Math.max(0, reportedLatency(evidence.pathSeconds))
  let baseSeconds: number
  let source: StudioRoundTripSource
  if (finitePositive(evidence.measuredMs)) {
    source = 'measured'
    // A measurement made on a clock with a shorter output path is short by
    // the difference: the Studio's clock buffers more (latencyHint 'playback').
    const correction = finitePositive(evidence.measuredPathMs)
      ? path - evidence.measuredPathMs / 1000
      : 0
    baseSeconds = evidence.measuredMs / 1000 + correction
  } else {
    source = 'estimated'
    const input = finitePositive(evidence.inputSeconds)
      ? evidence.inputSeconds
      : DEFAULT_INPUT_SECONDS
    baseSeconds = path + input
  }
  const offset =
    Math.max(
      -MAX_RECORD_OFFSET_MS,
      Math.min(
        MAX_RECORD_OFFSET_MS,
        Number.isFinite(evidence.offsetMs) ? evidence.offsetMs : 0,
      ),
    ) / 1000
  const clamp = (seconds: number) =>
    Math.max(0, Math.min(MAX_ROUND_TRIP_SECONDS, seconds))
  return {
    seconds: clamp(baseSeconds + offset),
    source,
    baseSeconds: clamp(baseSeconds),
  }
}

/** What a finished capture knows about where it sits. */
export interface StudioTakeCapture {
  readonly anchor: StudioTakeAnchor
  /** Clock time of the first captured sample. */
  readonly startTime: number
  /** Frames captured, at 48 kHz once any resample is done. */
  readonly frames: number
  readonly roundTripSeconds: number
  /**
   * The song frame the take starts on: the playhead when Record started the
   * song. Null for a take started while the song already played, which
   * keeps everything captured.
   */
  readonly fromFrame: number | null
}

/** A take's clip on the timeline, in whole 48 kHz frames. */
export interface StudioTakePlacement {
  readonly startFrame: number
  readonly sourceInFrame: number
  readonly sourceOutFrame: number
}

/** The song frame the singer heard while a take's first sample was sung. */
export function studioHeardFirst(
  anchor: StudioTakeAnchor,
  startTime: number,
  roundTripSeconds: number,
): number {
  return Math.round(
    takeFrameAt(anchor, startTime) - roundTripSeconds * STUDIO_SAMPLE_RATE,
  )
}

/**
 * A take's clip once its first sample's song frame is known: that sample
 * lands on `heardFirst`, so the first one kept lands on `fromFrame` (or as
 * early as the take reaches, never before the song's start). Null when the
 * trim leaves nothing.
 */
export function placeHeardTake(
  heardFirst: number,
  fromFrame: number | null,
  frames: number,
): StudioTakePlacement | null {
  if (!Number.isSafeInteger(frames) || frames <= 0) return null
  if (!Number.isSafeInteger(heardFirst)) return null
  const startFrame = Math.max(0, heardFirst, fromFrame ?? 0)
  const sourceInFrame = startFrame - heardFirst
  if (sourceInFrame >= frames) return null
  return { startFrame, sourceInFrame, sourceOutFrame: frames }
}

/** Where a take's clip goes: the song frame the singer heard as each sample was sung. */
export function placeStudioTake(
  capture: StudioTakeCapture,
): StudioTakePlacement | null {
  return placeHeardTake(
    studioHeardFirst(
      capture.anchor,
      capture.startTime,
      capture.roundTripSeconds,
    ),
    capture.fromFrame,
    capture.frames,
  )
}

/** Beats in a bar: the model keeps no time signature, so every song is in 4/4. */
export const STUDIO_BEATS_PER_BAR = 4

/** Frames of the timeline in one beat at `tempoBpm`, fractional. */
export function studioBeatFrames(tempoBpm: number): number {
  return (STUDIO_SAMPLE_RATE * 60) / tempoBpm
}

/** A count-in of `bars` bars at `tempoBpm`, in seconds. */
export function studioCountInSeconds(tempoBpm: number, bars: number): number {
  return (bars * STUDIO_BEATS_PER_BAR * 60) / tempoBpm
}

/** One click on the song's beat grid. */
export interface StudioClickBeat {
  /** Its song frame, fractional; before the song's start for a count-in. */
  readonly frame: number
  /** The first beat of a bar. */
  readonly accent: boolean
}

/**
 * The song's beats in [fromFrame, toFrame): beat k sits on k beats from the
 * song's start, as the Beats ruler draws them, and a bar's first beat is
 * accented. A count-in reaches before the song's start with the same grid.
 */
export function studioClickBeats(
  fromFrame: number,
  toFrame: number,
  tempoBpm: number,
): StudioClickBeat[] {
  const beat = studioBeatFrames(tempoBpm)
  const beats: StudioClickBeat[] = []
  // A hair under a beat counts as on it: float noise never skips one.
  for (let k = Math.ceil(fromFrame / beat - 1e-9); k * beat < toFrame; k++) {
    const inBar =
      ((k % STUDIO_BEATS_PER_BAR) + STUDIO_BEATS_PER_BAR) % STUDIO_BEATS_PER_BAR
    beats.push({ frame: k * beat, accent: inBar === 0 })
  }
  return beats
}
