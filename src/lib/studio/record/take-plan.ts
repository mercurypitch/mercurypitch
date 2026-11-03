// ============================================================
// Studio take plan — where Record starts the song, which stretch a take keeps, and when it stops on its own
// ============================================================
//
// A plain take records from the playhead (or along with a song already
// playing) until Stop. With a range on the ruler a take can keep less, or
// more than once (loop-range.ts):
//
// - Punch (Punch on, Repeat off): the song starts a pre-roll before the
//   range, the count-in's length or one bar, so the singer comes in on the
//   part before it. The take keeps only the range, with short fades at its
//   edges (take-passes.ts), and stops by itself at the range's end, where
//   the song stops too, as Pro Tools does without post-roll. A range too
//   near the song's start for the whole pre-roll gets the rest as count-in.
// - Loop (Repeat on): the song plays the range over and over from its
//   start, after the usual count-in, and every pass becomes its own take
//   on one clip (clip-passes.ts). Recording stops by itself after the most
//   passes a clip keeps, or at the five-minute limit, whichever comes first.
//
// A song playing when Record is pressed plays on under a plain take; a
// punch or a loop starts it again where its stretch needs it.
import { STUDIO_MAX_CLIP_PASSES } from '../model/clip-passes'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import type { StudioFrameRange } from '../playback/loop-range'
import { STUDIO_BEATS_PER_BAR, studioBeatFrames, studioCountInSeconds, } from './take-timing'

/** What a take keeps besides the whole capture: one range once, or every pass of it. */
export interface StudioTakeCut {
  readonly mode: 'punch' | 'loop'
  readonly range: StudioFrameRange
}

export interface StudioTakeRequest {
  readonly cut: StudioTakeCut | null
  /** A song is playing and has a place on the clock: a plain take follows it. */
  readonly playing: boolean
  readonly playheadFrame: number
  readonly countInBars: number
  readonly tempoBpm: number
}

export interface StudioTakePlan {
  readonly cut: StudioTakeCut | null
  /** Where Record starts the song; null for a song that plays on. */
  readonly songFrom: number | null
  /** Where the take's clip starts at the earliest, and its live waveform. */
  readonly fromFrame: number | null
  readonly countInSeconds: number
  /** The song frame, on the run's count, where the capture stops by itself; null for none. */
  readonly stopAt: number | null
}

/** A punch's pre-roll in frames: the count-in's bars of song, or one bar without a count-in. */
export function studioPunchPreroll(tempoBpm: number, countInBars: number) {
  const bars = Math.max(1, countInBars)
  return Math.round(studioBeatFrames(tempoBpm) * STUDIO_BEATS_PER_BAR * bars)
}

export function planStudioTake(request: StudioTakeRequest): StudioTakePlan {
  const { cut } = request
  if (cut?.mode === 'punch') {
    const { startFrame, endFrame } = cut.range
    const preroll = studioPunchPreroll(request.tempoBpm, request.countInBars)
    const songFrom = Math.max(0, startFrame - preroll)
    // What the song's start leaves short of the pre-roll is counted in.
    const missing = preroll - (startFrame - songFrom)
    return {
      cut,
      songFrom,
      fromFrame: startFrame,
      countInSeconds: missing / STUDIO_SAMPLE_RATE,
      stopAt: endFrame,
    }
  }
  const countIn =
    request.countInBars > 0
      ? studioCountInSeconds(request.tempoBpm, request.countInBars)
      : 0
  if (cut?.mode === 'loop') {
    const { startFrame, endFrame } = cut.range
    return {
      cut,
      songFrom: startFrame,
      fromFrame: startFrame,
      countInSeconds: countIn,
      stopAt: startFrame + STUDIO_MAX_CLIP_PASSES * (endFrame - startFrame),
    }
  }
  const from = request.playing ? null : Math.max(0, request.playheadFrame)
  return {
    cut: null,
    songFrom: from,
    fromFrame: from,
    countInSeconds: request.playing ? 0 : countIn,
    stopAt: null,
  }
}
