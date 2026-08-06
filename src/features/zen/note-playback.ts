// ============================================================
// Zen guide-note scheduler — which targets sound at this sample
// ============================================================
//
// Pure timing, no audio. The stage samples it once per pitch frame and hands
// whatever comes back to the tone player, which makes the whole thing
// testable in jsdom where nothing can actually sound.
//
// Two mistakes are baked out of it, both paid for in owner testing:
//
//  1. Lap identity cannot come from elapsed time. The session resets
//     `elapsedSec` at every seam, so `floor(elapsed / loopDuration)` is
//     permanently 0 and a per-lap dedupe key built from it collides with lap
//     one forever — notes sounded on the first pass and never again. The lap
//     index is passed in from the session's own counter instead.
//
//  2. Sampling "is a target active right now" drops notes. At tempo, a
//     sixteenth is shorter than a heavy frame, and the mic frames that drive
//     this arrive at most every ~33 ms and stall under load. Selection is by
//     *start crossing* — anything whose start lies in the gap since the last
//     sample fires — which is the same back-fill `lib/playback-runtime.ts`
//     uses for the piano roll.
//
// The mirror-image failure is replaying a whole lap at once (the [A,B] bug
// c38b8cc0 fixed for the piano). Hence: never back-fill across a
// discontinuity. A seam, a pause, a resume and an unmute all re-arm, and a
// re-armed scheduler fires either nothing or only what is under the playhead.

import type { ResolvedZenTarget } from './types'

/** Shortest guide tone worth hearing; below this it reads as a click. */
const MIN_TONE_SEC = 0.3
/** Longest, so a held target does not drone over the singer's own note. */
const MAX_TONE_SEC = 1.2
/** Elapsed may jitter by a hair without meaning the clock went backwards. */
const REWIND_EPSILON_SEC = 1e-6

export interface ZenNoteCue {
  target: ResolvedZenTarget
  /** Seconds of tone to sound for this target. */
  durationSec: number
}

export interface ZenNoteSample {
  /** Position within the current lap, seconds. */
  elapsedSec: number
  /** The session's lap counter — `loopsCompleted()`, never derived from time. */
  loopIndex: number
  targets: readonly ResolvedZenTarget[]
}

export interface ZenNoteScheduler {
  /** The targets that must sound at this sample, in start order. */
  sample: (input: ZenNoteSample) => ZenNoteCue[]
  /**
   * Mark a discontinuity. The next sample fires nothing (`soundCurrent`
   * false) or only the target under the playhead (`soundCurrent` true) —
   * never the lap so far.
   */
  rearm: (options?: { soundCurrent?: boolean }) => void
}

export function zenToneDurationSec(target: ResolvedZenTarget): number {
  return Math.min(
    MAX_TONE_SEC,
    Math.max(MIN_TONE_SEC, target.endSec - target.startSec),
  )
}

const cue = (target: ResolvedZenTarget): ZenNoteCue => ({
  target,
  durationSec: zenToneDurationSec(target),
})

/**
 * What the next sample does. Every mode but `crossing` is one-shot.
 *
 * The distinction that matters: a lap seam and a re-arm are both
 * discontinuities, but they have different floors. A fresh lap back-fills
 * from its own start, so a target sitting at 0 sounds; a re-arm mid-lap has
 * nothing legitimately behind the playhead and must fire nothing.
 */
type SampleMode = 'crossing' | 'lap-start' | 'sound-current' | 'resync'

export function createZenNoteScheduler(): ZenNoteScheduler {
  let lastElapsedSec = 0
  let lastLoopIndex = -1
  let mode: SampleMode = 'lap-start'

  const rearm = (options?: { soundCurrent?: boolean }): void => {
    mode = options?.soundCurrent === true ? 'sound-current' : 'resync'
  }

  const inWindow = (
    targets: readonly ResolvedZenTarget[],
    elapsedSec: number,
  ): ZenNoteCue[] =>
    targets
      .filter(
        (target) => target.startSec <= elapsedSec && elapsedSec < target.endSec,
      )
      .map(cue)

  const crossing = (
    targets: readonly ResolvedZenTarget[],
    fromSec: number,
    toSec: number,
  ): ZenNoteCue[] =>
    targets
      .filter((target) => target.startSec > fromSec && target.startSec <= toSec)
      .slice()
      .sort((left, right) => left.startSec - right.startSec)
      .map(cue)

  const sample = ({
    elapsedSec,
    loopIndex,
    targets,
  }: ZenNoteSample): ZenNoteCue[] => {
    // A seam supersedes any pending re-arm: the new lap owes the singer its
    // notes from the top regardless of what happened just before it.
    if (loopIndex !== lastLoopIndex) {
      lastLoopIndex = loopIndex
      mode = 'lap-start'
    }

    const current = mode
    const previousElapsedSec = lastElapsedSec
    mode = 'crossing'
    lastElapsedSec = elapsedSec

    switch (current) {
      case 'sound-current':
        return inWindow(targets, elapsedSec)
      case 'resync':
        return []
      case 'lap-start':
        // Below every startSec, so anything already begun in this lap fires.
        return crossing(targets, -1, elapsedSec)
      default:
        break
    }

    // The clock was rebased under us (loop length changed, frames rewound
    // without a seam). Resync silently — replaying from here would double
    // every target still ahead of the old position.
    if (elapsedSec + REWIND_EPSILON_SEC < previousElapsedSec) return []
    return crossing(targets, previousElapsedSec, elapsedSec)
  }

  return { sample, rearm }
}
