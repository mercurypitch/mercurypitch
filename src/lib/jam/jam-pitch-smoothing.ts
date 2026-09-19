// ── jam-pitch-smoothing ──────────────────────────────────────────────
// Display smoothing for jam's mic frames.
//
// The jam detector handed raw per-frame YIN output straight to the
// canvas and the network. The app's own voice path has never done
// that: pitch-f0-stream.ts puts a median over the last few VOICED
// readings in front of anything a singer looks at, and holds the last
// pitch across a short gap, so a consonant does not collapse the trail
// and a stray octave flicker does not jump it. Same policy here, same
// constants, so a jam room and the mirror behave alike.
//
// Kept apart from the detector so it can be exercised frame by frame
// without an AudioContext.

import type { DetectedPitch } from '@/lib/pitch-detector'
import { freqToNote } from '@/lib/scale-data'

/** Readings a median is taken over. Odd, so there is a middle. */
export const MEDIAN_WINDOW = 5
/** Frames the last pitch survives silence. About 130 ms at 60 fps. */
export const BRIDGE_FRAMES = 8
/** Below this a frame is breath or room noise, not a note. */
export const SMOOTH_MIN_CLARITY = 0.5

export interface PitchSmoother {
  /**
   * Feed one detector frame; get back what should be shown, or null
   * while there is nothing to show.
   */
  push: (frame: DetectedPitch | null) => DetectedPitch | null
  /** Forget everything -- a new take, or the mic going away. */
  reset: () => void
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

export function createPitchSmoother(): PitchSmoother {
  let voiced: number[] = []
  let bridgeLeft = 0
  let held: DetectedPitch | null = null

  return {
    push(frame) {
      const isVoiced =
        frame !== null &&
        frame.frequency > 0 &&
        frame.clarity >= SMOOTH_MIN_CLARITY

      if (isVoiced) {
        voiced.push(frame.frequency)
        if (voiced.length > MEDIAN_WINDOW) voiced.shift()
        const freq = median(voiced)
        // Rebuild the note fields from the smoothed frequency rather
        // than carrying the raw ones across: a name and a cents offset
        // that describe a different pitch from the one being drawn is
        // how a readout ends up disagreeing with the dot beside it.
        const note = freqToNote(freq)
        held = {
          ...frame,
          frequency: freq,
          noteName: note.name,
          octave: note.octave,
          cents: note.cents,
          midi: note.midi,
        }
        bridgeLeft = BRIDGE_FRAMES
        return held
      }

      if (bridgeLeft > 0 && held !== null) {
        bridgeLeft--
        return held
      }

      voiced = []
      held = null
      return null
    },
    reset() {
      voiced = []
      bridgeLeft = 0
      held = null
    },
  }
}
