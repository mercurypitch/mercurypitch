// ============================================================
// TV stage model — what the stage knows, from the messages it got
// ============================================================
//
// The stage page keeps one state and folds every message into it
// (protocol.ts): the song, the last clock reading, the singer's recent
// pitch and the score. Between frames the song's position runs on from the
// last reading by the wall clock, so the lane moves at the display's rate
// while the room sends twenty frames a second.
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

export interface TvStageState {
  readonly song: TvStageSong | null
  readonly clock: TvStageClock | null
  /** The singer's recent pitch, oldest first. */
  readonly trail: readonly TvStageReading[]
  readonly score: TvStageScore | null
}

export const EMPTY_TV_STAGE: TvStageState = {
  song: null,
  clock: null,
  trail: [],
  score: null,
}

/** How much of the singer's pitch the trail keeps behind the position, in seconds. */
export const TRAIL_SECONDS = 6

/** The most readings the trail holds, whatever the rate they came at. */
export const TRAIL_LIMIT = 1200

/** A jump back of more than this, in seconds, is a seek rather than jitter. */
const JUMP_BACK_SECONDS = 0.25

/** The song's position at `nowMs`, run on from the last reading. */
export function tvStagePosition(state: TvStageState, nowMs: number): number {
  const clock = state.clock
  if (clock === null) return 0
  if (!clock.playing) return clock.position
  const ran = Math.max(0, nowMs - clock.at) / 1000
  return clock.position + ran * clock.rate
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
        : { song: message, clock: null, trail: [], score: null }
    case 'frame':
      return applyFrame(state, message)
    case 'idle':
      return EMPTY_TV_STAGE
  }
}
