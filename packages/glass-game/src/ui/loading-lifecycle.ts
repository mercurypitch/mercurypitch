// Adventure loading lifecycle — gate one stable installed frame behind an initial presentation deadline.

export type AdventureLoadingPhase =
  | 'loading-assets'
  | 'awaiting-first-frame'
  | 'ready'
  | 'error'

export interface AdventureLoadingState {
  generation: number
  phase: AdventureLoadingPhase
  error: string | null
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
  let disposed = false

  const state = (): AdventureLoadingState => ({ generation, phase, error })
  const publish = () => options.onChange(state())

  return {
    state,
    beginAttempt(): number {
      generation++
      phase = 'loading-assets'
      error = null
      publish()
      return generation
    },
    isCurrent(attempt: number): boolean {
      return !disposed && attempt === generation
    },
    assetsInstalled(attempt: number): boolean {
      if (disposed || attempt !== generation || phase !== 'loading-assets')
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
