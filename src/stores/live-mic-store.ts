// ============================================================
// Live mic store — what the singing room's microphone heard, for others
// ============================================================
//
// The stem mixer's microphone keeps its own pitch readings and works out its
// own score (useStemMixerMicController.ts). A reader outside the mixer, a TV
// that draws the Karaoke room's stage (useKaraokeTvStage.ts), reads them here
// rather than reaching into the mixer: the mixer publishes them while it is
// up and takes them back as it goes. Null while no mixer is up.
//
// Tests: src/stores/live-mic-store.test.ts.

import { createSignal } from 'solid-js'
import type { FeedReading, FeedScore } from '@/lib/tv-stage/feed'

export interface LiveMicFeed {
  /** The readings, oldest first, as the microphone kept them. */
  readonly readings: () => readonly FeedReading[]
  /**
   * How far behind the song the readings run: the round trip the latency
   * calibration measured, and any delay on the way out (the key shifter's).
   */
  readonly readingLagSec: () => number
  /** The score so far. */
  readonly score: () => FeedScore
}

const [feed, setFeed] = createSignal<LiveMicFeed | null>(null)

/** The microphone of the mixer that is up, or null for none. */
export const liveMicFeed = feed

/** Publish a mixer's microphone. Returns the taking back. */
export function publishLiveMic(next: LiveMicFeed): () => void {
  setFeed(() => next)
  return () => {
    setFeed((current) => (current === next ? null : current))
  }
}
