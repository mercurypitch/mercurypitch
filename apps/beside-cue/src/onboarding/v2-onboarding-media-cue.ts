// V2 media dialogue cue — a cancellable audio-start hold on the video clock.

export interface V2OnboardingMediaCue {
  readonly ready: Promise<unknown>
  cancel(): void
}

interface MediaCueOptions {
  readonly element: HTMLVideoElement
  readonly startSeconds: number
  readonly canRun: () => boolean
  readonly pause: () => void
  readonly resume: () => void
  readonly cue: () => V2OnboardingMediaCue | undefined
}

/** Audio may need a cold fetch/decode. Hold the picture until it starts, but
 * cancel a stalled start before releasing the picture so speech cannot lag it. */
export function createV2OnboardingMediaCue(options: MediaCueOptions) {
  let disposed = false
  let playing = false
  let consumed = false
  let waiting = false
  let frame: number | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let pending: V2OnboardingMediaCue | undefined

  function stopObserving(): void {
    playing = false
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }

  function finish(cancel: boolean): void {
    if (!waiting) return
    waiting = false
    if (deadline !== undefined) clearTimeout(deadline)
    deadline = undefined
    const cue = pending
    pending = undefined
    try {
      if (cancel) cue?.cancel()
    } finally {
      if (!disposed && options.canRun()) options.resume()
    }
  }

  function inspect(): void {
    if (disposed || consumed || !playing || !options.canRun()) return
    if (options.element.currentTime < options.startSeconds) return
    consumed = true
    waiting = true
    stopObserving()
    options.pause()
    try {
      const cue = options.cue()
      if (disposed) {
        cue?.cancel()
        return
      }
      pending = cue
      if (cue === undefined) {
        finish(false)
        return
      }
      deadline = setTimeout(() => finish(true), 3_000)
      void cue.ready.then(
        () => finish(false),
        () => finish(false),
      )
    } catch {
      finish(false)
    }
  }

  function observe(): void {
    frame = undefined
    inspect()
    if (!disposed && !consumed && playing && options.canRun()) {
      frame = requestAnimationFrame(observe)
    }
  }

  return {
    isWaiting: () => waiting,
    playing() {
      if (disposed || consumed) return
      playing = true
      inspect()
      if (!consumed && frame === undefined && options.canRun()) {
        frame = requestAnimationFrame(observe)
      }
    },
    timeupdate: inspect,
    pause: stopObserving,
    dispose() {
      if (disposed) return
      disposed = true
      stopObserving()
      finish(true)
    },
  }
}
