// ============================================================
// TV stage model — what the stage knows, from the messages it got
// ============================================================
//
// The stage page keeps one state and folds every message into it
// (protocol.ts): the song, the last clock reading, the singer's recent
// pitch and the score. Between frames the song's position runs on from the
// last reading by the wall clock, so the lane moves at the display's rate
// while the room sends twenty frames a second. It never runs on past the
// song's end, so a room that stops sending without a word (it broke) leaves
// the lane standing at the end, not scrolling on for hours; a room that
// closes says idle (useKaraokeTvStage.ts).
//
// The state also keeps when the song last started or stopped, and where it
// was then (`turn`): the paused screen fades in and out from that moment
// (pause-screen.ts). A song's first frame is no turn, playing or not: a TV
// that starts showing the stage in the middle of a song must not see a
// paused screen fade out that it never saw come in.
//
// The singer's trail keeps a few seconds behind the song's position and no
// more. A jump back (a seek, a line tapped) drops what was sung after the
// new position, so the lane does not show a take from a moment that has not
// come round again yet.
//
// Tests: src/lib/tv-stage/model.test.ts.

import type { TvStageFrame, TvStageMessage, TvStageReading, TvStageScore, TvStageSong, } from './protocol'

/** Where the song was, and when the room read it. */
export interface TvStageClock {
  /** The wall clock in ms when `position` was read. */
  readonly at: number
  readonly position: number
  readonly playing: boolean
  readonly rate: number
}

/** When the song last started or stopped, and where it was then. */
export interface TvStageTurn {
  /** The wall clock in ms, as a frame's `at`; minus infinity for never. */
  readonly at: number
  readonly position: number
}

export interface TvStageState {
  readonly song: TvStageSong | null
  readonly clock: TvStageClock | null
  /** The singer's recent pitch, oldest first. */
  readonly trail: readonly TvStageReading[]
  readonly score: TvStageScore | null
  readonly turn: TvStageTurn
}

/** No turn to fade from: the stage has stood as it is for as long as it has been. */
export const LONG_AGO: TvStageTurn = {
  at: Number.NEGATIVE_INFINITY,
  position: 0,
}

export const EMPTY_TV_STAGE: TvStageState = {
  song: null,
  clock: null,
  trail: [],
  score: null,
  turn: LONG_AGO,
}

/** How much of the singer's pitch the trail keeps behind the position, in seconds. */
export const TRAIL_SECONDS = 6

/** The most readings the trail holds, whatever the rate they came at. */
export const TRAIL_LIMIT = 1200

/** A jump back of more than this, in seconds, is a seek rather than jitter. */
const JUMP_BACK_SECONDS = 0.25

/**
 * The song's position at `nowMs`, run on from the last reading, and never
 * run on past the song's end once its length is known. The run-on has no
 * time limit of its own: a phone that stalls for a few seconds mid-song must
 * not stop a lane whose music plays on. A reading already past the end (the
 * Developer screen's offset can put it there) stands where it is.
 */
export function tvStagePosition(state: TvStageState, nowMs: number): number {
  const clock = state.clock
  if (clock === null) return 0
  if (!clock.playing) return clock.position
  const ran = (Math.max(0, nowMs - clock.at) / 1000) * clock.rate
  const length = state.song?.duration ?? 0
  if (length <= 0) return clock.position + ran
  return clock.position + Math.min(ran, Math.max(0, length - clock.position))
}

function trailAfterFrame(
  state: TvStageState,
  frame: TvStageFrame,
): readonly TvStageReading[] {
  const previous = state.clock?.position ?? frame.position
  const jumpedBack = frame.position < previous - JUMP_BACK_SECONDS
  const kept = jumpedBack
    ? state.trail.filter(([time]) => time <= frame.position)
    : state.trail
  const from = frame.position - TRAIL_SECONDS
  const joined = [...kept, ...frame.singer].filter(([time]) => time >= from)
  return joined.length > TRAIL_LIMIT ? joined.slice(-TRAIL_LIMIT) : joined
}

function applyFrame(state: TvStageState, frame: TvStageFrame): TvStageState {
  const turned = state.clock !== null && state.clock.playing !== frame.playing
  return {
    song: state.song,
    clock: {
      at: frame.at,
      position: frame.position,
      playing: frame.playing,
      rate: frame.rate > 0 ? frame.rate : 1,
    },
    trail: trailAfterFrame(state, frame),
    score: frame.score,
    turn: turned ? { at: frame.at, position: frame.position } : state.turn,
  }
}

/**
 * The state after one message. A new song starts afresh, and the same song
 * sent again (its notes or lyrics arrived) keeps the trail and the score;
 * idle forgets everything.
 */
export function applyTvStageMessage(
  state: TvStageState,
  message: TvStageMessage,
): TvStageState {
  switch (message.kind) {
    case 'song':
      return state.song?.title === message.title
        ? { ...state, song: message }
        : { song: message, clock: null, trail: [], score: null, turn: LONG_AGO }
    case 'frame':
      return applyFrame(state, message)
    case 'idle':
      return EMPTY_TV_STAGE
  }
}
