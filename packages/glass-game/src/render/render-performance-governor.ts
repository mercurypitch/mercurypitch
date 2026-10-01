// Mobile render governor — one-way, evidence-based relief for sustained slow render loops.

import type { GlassRenderQualityPreference, GlassRenderQualityProfile, } from './render-quality'

export const ADAPTIVE_PIXEL_RATIO = 1
export const ADAPTIVE_SHADOW_FRAME_INTERVAL = 4 as const
export const PERFORMANCE_SAMPLE_COUNT = 24
export const PERFORMANCE_SLOW_SAMPLE_COUNT = 6
export const PERFORMANCE_SLOW_FRAME_SECONDS = 1 / 24
export const PERFORMANCE_MINIMUM_WINDOW_SECONDS = 1
export const PERFORMANCE_MAXIMUM_SAMPLE_SECONDS = 0.25

export interface RenderPerformanceGovernorMetrics {
  readonly adapted: boolean
  readonly active: boolean
  readonly sampleCount: number
  readonly sampleWindowSeconds: number
  readonly slowSampleCount: number
}

/**
 * Observe visible render-loop intervals without treating RAF cadence as a GPU
 * timer. A pause, hidden tab, loading work or one isolated hitch cannot make
 * both the slow-tail and whole-window budgets by itself.
 */
export function createRenderPerformanceGovernor(
  preference: GlassRenderQualityPreference,
  profile: GlassRenderQualityProfile,
) {
  let currentPreference = preference
  let currentProfile = profile
  let active = false
  let adapted = false
  let disposed = false
  let sampleCount = 0
  let slowSampleCount = 0
  let sampleWindowSeconds = 0

  const clearWindow = (): void => {
    sampleCount = 0
    slowSampleCount = 0
    sampleWindowSeconds = 0
  }

  const eligibleProfile = (): boolean =>
    currentProfile === 'balanced' && currentPreference !== 'high'

  return {
    activate(): void {
      if (disposed) return
      active = true
      clearWindow()
    },
    configure(
      nextPreference: GlassRenderQualityPreference,
      nextProfile: GlassRenderQualityProfile,
    ): void {
      if (disposed) return
      const changed =
        nextPreference !== currentPreference || nextProfile !== currentProfile
      currentPreference = nextPreference
      currentProfile = nextProfile
      if (changed || !eligibleProfile()) {
        adapted = false
        clearWindow()
      }
    },
    observe(deltaSeconds: number, eligible: boolean): boolean {
      if (disposed || !active || adapted || !eligibleProfile()) return false
      if (!eligible) {
        clearWindow()
        return false
      }
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
        clearWindow()
        return false
      }
      const boundedDelta = Math.min(
        deltaSeconds,
        PERFORMANCE_MAXIMUM_SAMPLE_SECONDS,
      )
      sampleCount++
      sampleWindowSeconds += boundedDelta
      if (deltaSeconds >= PERFORMANCE_SLOW_FRAME_SECONDS) slowSampleCount++
      if (sampleCount < PERFORMANCE_SAMPLE_COUNT) return false

      if (
        slowSampleCount >= PERFORMANCE_SLOW_SAMPLE_COUNT &&
        sampleWindowSeconds >= PERFORMANCE_MINIMUM_WINDOW_SECONDS
      ) {
        adapted = true
        return true
      }
      clearWindow()
      return false
    },
    metrics(): RenderPerformanceGovernorMetrics {
      return {
        adapted,
        active: active && !disposed,
        sampleCount,
        sampleWindowSeconds,
        slowSampleCount,
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      active = false
      clearWindow()
    },
  }
}
