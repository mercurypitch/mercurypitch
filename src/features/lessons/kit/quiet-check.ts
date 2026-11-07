// ============================================================
// Quiet check — two seconds of the drone, and nothing heard
// ============================================================
//
// Before a set of holds over a drone, the page plays the drone alone for
// two seconds at the holds' level while the microphone listens, and the
// learner stays quiet (Lesson 24 WEB-SPEC, Toys 6, state 6). Through
// headphones the microphone should hear nothing; through a speaker it may
// hear the drone, and a hold read over it could find a note that nobody
// sang (Lesson 24 FACTS 52). The check cannot tell the drone from a voice,
// a hum or a television, so it fails on any voiced run of 0.3 s or more, at
// any pitch, and passes otherwise; its line says what it heard and what to
// do, and names no cause it cannot know.
//
// Pure: the frames are read as the hold reader reads them, through Voice
// Mirror's own preprocessing (`preprocess`, which drops what is unvoiced or
// unsure and smooths each voiced run), and split into runs where the voice
// breaks for longer than Voice Mirror's own gap. The page plays the drone
// and gathers the frames (kit/listen.ts, `framesFor`); Lesson 26 asks the
// same.

import type { F0Frame } from '@/lib/mirror/metrics'
import { preprocess } from '@/lib/mirror/metrics'
import { DEFAULT_VOICED_RUN_GAP_SEC, estimateFrameHop, } from '@/lib/pitch-measurements'

/** Seconds of the drone the check listens over. */
export const QUIET_SEC = 2
/** A voiced run this long, or longer, fails the check. */
export const HEARD_RUN_SEC = 0.3

/** The check's line before it runs, the learner's cue to stay quiet. */
export const QUIET_LINE =
  "First, stay quiet for two seconds while the drone plays: the page checks that the microphone can't hear it."

/** The check's line when it heard a note: what it heard, and what to do. */
export const HEARD_LINE =
  'The microphone heard a note during the drone. Check your headphones, then press Start again and stay quiet.'

/** The longest voiced run among the frames, seconds: from its first frame to its last, and a frame's hop; and that hop. */
export function longestRun(frames: readonly F0Frame[]): {
  readonly seconds: number
  readonly hop: number
} {
  const hop = estimateFrameHop(frames)
  const voiced = preprocess(frames)
  if (voiced.length === 0) return { seconds: 0, hop }
  let start = voiced[0].t
  let longest = 0
  for (let i = 1; i <= voiced.length; i++) {
    const gap = i < voiced.length ? voiced[i].t - voiced[i - 1].t : Infinity
    if (gap <= DEFAULT_VOICED_RUN_GAP_SEC) continue
    longest = Math.max(longest, voiced[i - 1].t - start + hop)
    if (i < voiced.length) start = voiced[i].t
  }
  return { seconds: longest, hop }
}

/**
 * Whether the check passed: no voiced run of 0.3 s or more, at any pitch.
 * Frames sample the voice a hop apart, so a run 0.3 s long can show one
 * frame fewer than 0.3 s holds, whichever way the frames fall: a run counts
 * as heard once its frames cover more than 0.3 s less a hop.
 */
export function heardNothing(frames: readonly F0Frame[]): boolean {
  const run = longestRun(frames)
  return run.seconds <= HEARD_RUN_SEC - run.hop
}
