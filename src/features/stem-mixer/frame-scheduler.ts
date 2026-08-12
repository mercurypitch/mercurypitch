import { createFrameRateLimiter } from '@/lib/frame-rate-limiter'

export interface StemMixerFrameDecision {
  /** Presentation follows every browser animation frame for smooth motion. */
  present: boolean
  /** Pitch detection and scoring run at a bounded cadence. */
  analyze: boolean
}

export interface StemMixerFrameScheduler {
  next: (nowSeconds: number) => StemMixerFrameDecision
  reset: () => void
}

/**
 * Keep visual presentation independent from expensive audio analysis.
 *
 * Firefox can drive requestAnimationFrame at 60 Hz or above. Limiting the
 * analysis work protects the main thread, but limiting presentation as well
 * makes the playhead visibly step between frames.
 *
 * That reasoning holds only while the device can actually meet the display's
 * deadline. On a television it cannot: four canvases per frame at 60 Hz starves
 * the thread that also feeds Web Audio, and the audio stutter is far more
 * noticeable than a playhead moving in 33 ms steps. So presentation takes a cap
 * too when one is supplied — `Infinity` (the default) keeps the old behaviour
 * exactly, with no limiter in the path.
 */
export function createStemMixerFrameScheduler(
  maxAnalysisFramesPerSecond: number,
  maxPresentationFramesPerSecond: number = Number.POSITIVE_INFINITY,
): StemMixerFrameScheduler {
  const analysisLimiter = createFrameRateLimiter(maxAnalysisFramesPerSecond)
  const presentationLimiter = Number.isFinite(maxPresentationFramesPerSecond)
    ? createFrameRateLimiter(maxPresentationFramesPerSecond)
    : null

  return {
    next(nowSeconds: number): StemMixerFrameDecision {
      if (!Number.isFinite(nowSeconds)) {
        return { present: false, analyze: false }
      }
      const present = presentationLimiter?.shouldRun(nowSeconds) ?? true
      return {
        present,
        // A frame that is not presented has nothing to score against, and
        // running the FFT anyway is the cost this cap exists to avoid.
        analyze: present && analysisLimiter.shouldRun(nowSeconds),
      }
    },
    reset(): void {
      analysisLimiter.reset()
      presentationLimiter?.reset()
    },
  }
}
