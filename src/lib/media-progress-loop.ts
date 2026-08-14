// ============================================================
// Media Progress Loop — frame-synchronised progress for audio playback
// ============================================================

export interface MediaProgressClock {
  currentTime: number
  duration: number
  paused: boolean
  ended: boolean
}

export interface MediaFrameScheduler {
  request: (callback: FrameRequestCallback) => number
  cancel: (id: number) => void
}

export interface MediaProgressLoop {
  /** Follow one playing media element until it pauses, ends, or is replaced. */
  start: (media: MediaProgressClock) => void
  /** Sample the current element outside rAF (for background-tab events). */
  sample: (media: MediaProgressClock) => void
  /** Invalidate every queued frame and stop following the current element. */
  stop: () => void
}

/** A resolved `play()` is stale if another control paused or ended the media. */
export function isMediaPlaybackActive(media: MediaProgressClock): boolean {
  return !media.paused && !media.ended
}

/** Convert a pointer position on a media timeline to a clamped 0–1 seek. */
export function mediaProgressFromPointer(
  clientX: number,
  left: number,
  width: number,
): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(left) || width <= 0) {
    return 0
  }
  return Math.max(0, Math.min(1, (clientX - left) / width))
}

const browserScheduler: MediaFrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
}

function readProgress(media: MediaProgressClock): number | null {
  if (
    !Number.isFinite(media.currentTime) ||
    !Number.isFinite(media.duration) ||
    media.duration <= 0
  ) {
    return null
  }
  return Math.max(0, Math.min(1, media.currentTime / media.duration))
}

/**
 * Drive visual playback from rAF instead of the deliberately coarse
 * `timeupdate` event. `sample()` remains useful when a background tab pauses
 * animation frames but the media element still emits a final progress event.
 */
export function createMediaProgressLoop(
  onProgress: (progress: number) => void,
  scheduler: MediaFrameScheduler = browserScheduler,
): MediaProgressLoop {
  let media: MediaProgressClock | null = null
  let frame: number | null = null
  let generation = 0

  const emit = (candidate: MediaProgressClock): void => {
    const progress = readProgress(candidate)
    if (progress !== null) onProgress(progress)
  }

  const schedule = (request: number): void => {
    frame = scheduler.request(() => {
      frame = null
      const current = media
      if (request !== generation || current === null) return
      emit(current)
      if (!current.paused && !current.ended) schedule(request)
    })
  }

  const stop = (): void => {
    generation += 1
    media = null
    if (frame !== null) scheduler.cancel(frame)
    frame = null
  }

  return {
    start: (nextMedia) => {
      stop()
      media = nextMedia
      const request = generation
      emit(nextMedia)
      if (!nextMedia.paused && !nextMedia.ended) schedule(request)
    },
    sample: (candidate) => {
      if (candidate === media) emit(candidate)
    },
    stop,
  }
}
