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
 */
export function createStemMixerFrameScheduler(
  maxAnalysisFramesPerSecond: number,
): StemMixerFrameScheduler {
  const analysisLimiter = createFrameRateLimiter(maxAnalysisFramesPerSecond)

  return {
    next(nowSeconds: number): StemMixerFrameDecision {
      if (!Number.isFinite(nowSeconds)) {
        return { present: false, analyze: false }
      }
      return {
        present: true,
        analyze: analysisLimiter.shouldRun(nowSeconds),
      }
    },
    reset(): void {
      analysisLimiter.reset()
    },
  }
}
