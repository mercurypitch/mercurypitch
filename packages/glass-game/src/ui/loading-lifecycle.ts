// Adventure loading lifecycle — gate one stable installed frame behind an initial presentation deadline.

import type { LoadingProgress } from '../loading-progress'

export type AdventureLoadingPhase =
  | 'loading-assets'
  | 'awaiting-first-frame'
  | 'ready'
  | 'error'

export interface AdventureLoadingState {
  generation: number
  phase: AdventureLoadingPhase
  error: string | null
  progress: LoadingProgress
}

interface AdventureLoadingLifecycleOptions {
  minimumVisibleMs: number
  now?: () => number
  onChange: (state: AdventureLoadingState) => void
}

export function createAdventureLoadingLifecycle(
  options: AdventureLoadingLifecycleOptions,
) {
  const now = options.now ?? (() => performance.now())
  const enteredAt = now()
  let generation = 0
  let phase: AdventureLoadingPhase = 'loading-assets'
  let error: string | null = null
  let progress: LoadingProgress = { completedUnits: 0, totalUnits: 0 }
  let disposed = false

  const state = (): AdventureLoadingState => ({
    generation,
    phase,
    error,
    progress,
  })
  const publish = () => options.onChange(state())

  return {
    state,
    beginAttempt(): number {
      generation++
      phase = 'loading-assets'
      error = null
      progress = { completedUnits: 0, totalUnits: 0 }
      publish()
      return generation
    },
    isCurrent(attempt: number): boolean {
      return !disposed && attempt === generation
    },
    reportProgress(attempt: number, next: LoadingProgress): boolean {
      if (
        disposed ||
        attempt !== generation ||
        phase !== 'loading-assets' ||
        !Number.isSafeInteger(next.completedUnits) ||
        !Number.isSafeInteger(next.totalUnits) ||
        next.completedUnits < progress.completedUnits ||
        next.totalUnits < 0 ||
        next.completedUnits > next.totalUnits ||
        (progress.totalUnits !== 0 && next.totalUnits !== progress.totalUnits)
      )
        return false
      if (
        next.completedUnits === progress.completedUnits &&
        next.totalUnits === progress.totalUnits
      )
        return true
      progress = {
        completedUnits: next.completedUnits,
        totalUnits: next.totalUnits,
      }
      publish()
      return true
    },
    assetsInstalled(attempt: number): boolean {
      if (
        disposed ||
        attempt !== generation ||
        phase !== 'loading-assets' ||
        (progress.totalUnits > 0 &&
          progress.completedUnits !== progress.totalUnits)
      )
        return false
      phase = 'awaiting-first-frame'
      publish()
      return true
    },
    frameRendered(attempt: number): boolean {
      if (
        disposed ||
        attempt !== generation ||
        phase !== 'awaiting-first-frame'
      )
        return false
      if (now() < enteredAt + options.minimumVisibleMs) return true
      phase = 'ready'
      publish()
      return true
    },
    fail(attempt: number, message: string): boolean {
      if (disposed || attempt !== generation || phase === 'error') return false
      phase = 'error'
      error = message
      publish()
      return true
    },
    dispose(): void {
      if (disposed) return
      disposed = true
    },
  }
}
