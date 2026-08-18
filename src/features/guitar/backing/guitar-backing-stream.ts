// Guitar backing stream keeps memory-heavy local stems aligned without decoding whole songs to PCM.
// ============================================================

import type { GuitarBackingTrack } from './guitar-backing-transport'

interface StreamedTrack {
  track: GuitarBackingTrack
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
  /** Trim currently applied on top of the base rate, as a fraction of it. */
  trim: number
  onEnded: () => void
  onError: () => void
  onSeeked: () => void
  onPause: () => void
}

/**
 * How far ahead or behind the master a stem may run before the servo does
 * anything, and how it closes the gap when it must.
 *
 * The first version of this seeked any stem more than the tolerance away
 * straight to the master's clock — and could never converge. Setting
 * `currentTime` on a PLAYING element is asynchronous and stalls its output
 * while the pipeline re-primes; by the time the correction lands the master
 * has moved on by exactly that latency, so the stem is behind again, by more
 * than the tolerance, and the next tick re-seeks it. On a phone, where that
 * latency comfortably exceeds 60 ms, the room re-seeks a stem every 400 ms
 * forever and the player hears a hole every 400 ms. That is the stutter.
 *
 * A rate trim closes the same gap without a hole: running a stem 2% fast for
 * a second recovers 20 ms of lag and is inaudible with `preservesPitch` on.
 * It is a servo, so a stem whose clock genuinely runs slightly slow simply
 * holds a small permanent trim instead of being seeked over and over.
 */
const RATE_TRIM_MAX = 0.04
/** Drift at which the trim reaches full scale. */
const RATE_TRIM_FULL_SCALE_SECONDS = 0.25
/**
 * Past this a stem is not drifting, it was interrupted — the OS paused it,
 * the tab was backgrounded, a decoder stalled. A 4% trim would need minutes
 * to close a gap that size, so the seek (and its hole) is the lesser evil.
 */
const HARD_SEEK_SECONDS = 0.75
/**
 * No correction for this long after any seek. The elements are still
 * re-priming, their clocks disagree wildly while they do, and correcting
 * against that noise is what turned one seek into seconds of stutter.
 */
const SEEK_SETTLE_MS = 700
/** Give up waiting for `seeked` after this; some engines never fire it. */
const SEEK_TIMEOUT_MS = 1_200

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export interface GuitarBackingStreamStart {
  playableTrackIds: readonly string[]
  durationSeconds: number
}

export interface GuitarBackingStreamEngine {
  load(
    context: AudioContext,
    destination: AudioNode,
    tracks: readonly GuitarBackingTrack[],
    targetGain: (trackId: string) => number,
  ): readonly string[]
  play(
    offsetSeconds: number,
    targetGain: (trackId: string) => number,
  ): Promise<GuitarBackingStreamStart | null>
  pause(delayMs?: number): void
  /** Resolves once every element has finished seeking, or timed out trying. */
  seek(seconds: number): Promise<void>
  setPlaybackRate(rate: number): void
  setTrackGain(trackId: string, gain: number, fadeSeconds: number): void
  getCurrentTime(): number | null
  dispose(): void
}

interface GuitarBackingStreamOptions {
  createMediaElement: () => HTMLAudioElement
  syncIntervalMs: number
  driftToleranceSeconds: number
  onEnded: () => void
  onTrackError: (
    trackId: string,
    state: { fatal: boolean; currentTime: number },
  ) => void
  /**
   * A stem stopped without being asked to. Each stem is its own media element
   * and therefore its own OS media session: on iOS the Now Playing control
   * pauses whichever one it attached to and leaves the rest playing. The room
   * has to hear about it, or half the song keeps going while the transport
   * still says it is playing.
   */
  onInterrupted?: (trackId: string, currentTime: number) => void
  /** Wall clock, injectable so the settle window is testable. */
  now?: () => number
}

function setElementTime(element: HTMLMediaElement, seconds: number): void {
  try {
    element.currentTime = seconds
  } catch {
    // Browsers can reject a seek until metadata arrives. play() performs a
    // second alignment pass after the element becomes usable.
  }
}

function mediaDuration(streamed: StreamedTrack): number {
  const declared = streamed.track.durationSeconds
  if (declared !== undefined && Number.isFinite(declared) && declared > 0) {
    return declared
  }
  return Number.isFinite(streamed.element.duration) &&
    streamed.element.duration > 0
    ? streamed.element.duration
    : 0
}

export function createGuitarBackingStreamEngine(
  options: GuitarBackingStreamOptions,
): GuitarBackingStreamEngine {
  let context: AudioContext | null = null
  let streamedTracks: StreamedTrack[] = []
  let playableIds = new Set<string>()
  let master: StreamedTrack | null = null
  let syncTimer: ReturnType<typeof setInterval> | null = null
  let pauseTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0
  let playbackRate = 1
  let disposed = false
  let settleUntilMs = 0
  /**
   * Whether this engine believes the room should be sounding. A `pause` event
   * is queued as a task, so a flag set around our own `element.pause()` call
   * would already be cleared by the time the listener ran — intent has to be
   * held as state, not as a window in time.
   */
  let wantPlaying = false

  const now = options.now ?? (() => Date.now())

  const applyPlaybackRate = (element: HTMLMediaElement): void => {
    element.playbackRate = playbackRate
    element.preservesPitch = true
    if ('webkitPreservesPitch' in element) {
      ;(
        element as HTMLMediaElement & { webkitPreservesPitch: boolean }
      ).webkitPreservesPitch = true
    }
  }

  /** Run a stem slightly off the base rate to close a small gap. */
  const applyTrim = (streamed: StreamedTrack, trim: number): void => {
    if (streamed.trim === trim) return
    streamed.trim = trim
    streamed.element.playbackRate = playbackRate * (1 + trim)
  }

  const clearTrims = (): void => {
    for (const streamed of streamedTracks) {
      streamed.trim = 0
      applyPlaybackRate(streamed.element)
    }
  }

  const clearTimers = (): void => {
    if (syncTimer !== null) clearInterval(syncTimer)
    if (pauseTimer !== null) clearTimeout(pauseTimer)
    syncTimer = null
    pauseTimer = null
  }

  const pauseNow = (): void => {
    wantPlaying = false
    for (const streamed of streamedTracks) streamed.element.pause()
  }

  const currentTime = (): number | null => {
    const time = master?.element.currentTime
    return time !== undefined && Number.isFinite(time) ? time : null
  }

  const beginSync = (): void => {
    if (syncTimer !== null) clearInterval(syncTimer)
    syncTimer = null
    if (options.syncIntervalMs <= 0 || streamedTracks.length < 2) return

    syncTimer = setInterval(() => {
      const primary = master
      if (primary === null || primary.element.paused) return
      // Mid-seek the element clocks are meaningless, and correcting against
      // them is what turned one seek into seconds of stutter. Read the
      // elements' own live flag rather than counting events: a `seeking` whose
      // `seeked` never arrives would otherwise disable the servo for good.
      if (now() < settleUntilMs) return
      if (streamedTracks.some((candidate) => candidate.element.seeking)) return
      const primaryTime = primary.element.currentTime
      if (!Number.isFinite(primaryTime)) return
      for (const streamed of streamedTracks) {
        if (
          streamed === primary ||
          streamed.element.paused ||
          !playableIds.has(streamed.track.id)
        ) {
          continue
        }
        const drift = streamed.element.currentTime - primaryTime
        if (!Number.isFinite(drift)) continue
        if (Math.abs(drift) > HARD_SEEK_SECONDS) {
          applyTrim(streamed, 0)
          setElementTime(streamed.element, primaryTime)
          settleUntilMs = now() + SEEK_SETTLE_MS
          continue
        }
        if (Math.abs(drift) <= options.driftToleranceSeconds) {
          applyTrim(streamed, 0)
          continue
        }
        // Ahead of the master runs slow, behind it runs fast.
        const pull = clamp(drift / RATE_TRIM_FULL_SCALE_SECONDS, -1, 1)
        applyTrim(streamed, -pull * RATE_TRIM_MAX)
      }
    }, options.syncIntervalMs)
  }

  const disconnectTracks = (): void => {
    clearTimers()
    pauseNow()
    master = null
    playableIds.clear()
    for (const streamed of streamedTracks) {
      streamed.element.removeEventListener('ended', streamed.onEnded)
      streamed.element.removeEventListener('error', streamed.onError)
      streamed.element.removeEventListener('seeked', streamed.onSeeked)
      streamed.element.removeEventListener('pause', streamed.onPause)
      streamed.element.removeAttribute('src')
      streamed.element.load()
      streamed.source.disconnect()
      streamed.gain.disconnect()
    }
    streamedTracks = []
  }

  return {
    load(nextContext, destination, tracks, targetGain) {
      generation += 1
      disconnectTracks()
      context = nextContext
      disposed = false
      const loaded: StreamedTrack[] = []

      for (const track of tracks) {
        try {
          const element = options.createMediaElement()
          element.preload = 'auto'
          // Set before `src`, and unconditionally: a cross-origin stem
          // (the remote demo song) that is not requested with CORS taints
          // the element, and a tainted element feeds a
          // MediaElementAudioSourceNode nothing but silence. Same-origin
          // and blob: sources are unaffected by the attribute.
          element.crossOrigin = 'anonymous'
          element.src = track.url
          applyPlaybackRate(element)
          const source = nextContext.createMediaElementSource(element)
          const gain = nextContext.createGain()
          source.connect(gain)
          gain.connect(destination)

          const onEnded = (): void => {
            if (!disposed && master === streamed) options.onEnded()
          }
          const onError = (): void => {
            playableIds.delete(track.id)
            if (master === streamed) {
              master =
                streamedTracks.find(
                  (candidate) =>
                    candidate !== streamed &&
                    playableIds.has(candidate.track.id) &&
                    !candidate.element.paused,
                ) ?? null
            }
            options.onTrackError(track.id, {
              fatal: master === null,
              currentTime: currentTime() ?? element.currentTime ?? 0,
            })
          }
          const onSeeked = (): void => {
            settleUntilMs = now() + SEEK_SETTLE_MS
          }
          const onPause = (): void => {
            // Reaching the end pauses the element too; that is `onEnded`'s.
            if (!wantPlaying || disposed || element.ended) return
            // Nobody here asked for this: the OS media control, an audio
            // interruption, or the element running dry.
            wantPlaying = false
            options.onInterrupted?.(track.id, element.currentTime)
          }
          const streamed: StreamedTrack = {
            track,
            element,
            source,
            gain,
            trim: 0,
            onEnded,
            onError,
            onSeeked,
            onPause,
          }
          element.addEventListener('ended', onEnded)
          element.addEventListener('error', onError)
          element.addEventListener('seeked', onSeeked)
          element.addEventListener('pause', onPause)
          gain.gain.value = targetGain(track.id)
          loaded.push(streamed)
        } catch {
          // The facade marks a track unavailable when it is absent here.
        }
      }

      streamedTracks = loaded
      return loaded.map((streamed) => streamed.track.id)
    },

    async play(offsetSeconds, targetGain) {
      const currentGeneration = ++generation
      clearTimers()
      pauseNow()
      clearTrims()
      const starts = streamedTracks.map((streamed) => {
        setElementTime(streamed.element, offsetSeconds)
        applyPlaybackRate(streamed.element)
        streamed.gain.gain.value = targetGain(streamed.track.id)
        try {
          return Promise.resolve(streamed.element.play())
        } catch (cause) {
          return Promise.reject(cause)
        }
      })
      const settled = await Promise.allSettled(starts)
      if (disposed || currentGeneration !== generation) {
        pauseNow()
        return null
      }

      playableIds = new Set(
        streamedTracks.flatMap((streamed, index) => {
          if (settled[index].status !== 'fulfilled') {
            streamed.element.pause()
            return []
          }
          setElementTime(streamed.element, offsetSeconds)
          return [streamed.track.id]
        }),
      )
      const playable = streamedTracks.filter((streamed) =>
        playableIds.has(streamed.track.id),
      )
      if (playable.length === 0) return null

      master = playable.reduce((longest, candidate) =>
        mediaDuration(candidate) > mediaDuration(longest) ? candidate : longest,
      )
      wantPlaying = true
      // Every element was just re-primed from a cold start; hold the servo
      // off until their clocks mean something again.
      settleUntilMs = now() + SEEK_SETTLE_MS
      beginSync()
      return {
        playableTrackIds: [...playableIds],
        durationSeconds: Math.max(...playable.map(mediaDuration)),
      }
    },

    pause(delayMs = 0) {
      generation += 1
      // Claimed up front: a scheduled pause is still this engine's doing, so
      // the element going quiet must not be read as an interruption.
      wantPlaying = false
      clearTimers()
      if (delayMs <= 0) {
        pauseNow()
        return
      }
      pauseTimer = setTimeout(() => {
        pauseTimer = null
        pauseNow()
      }, delayMs)
    },

    async seek(seconds) {
      settleUntilMs = now() + SEEK_SETTLE_MS
      const arrivals = streamedTracks.map(
        async (streamed) =>
          new Promise<void>((resolve) => {
            const element = streamed.element
            let timer: ReturnType<typeof setTimeout> | null = null
            const finish = (): void => {
              element.removeEventListener('seeked', finish)
              if (timer !== null) clearTimeout(timer)
              resolve()
            }
            element.addEventListener('seeked', finish, { once: true })
            timer = setTimeout(finish, SEEK_TIMEOUT_MS)
            setElementTime(element, seconds)
            // A seek to where the element already sits fires nothing.
            if (!element.seeking) finish()
          }),
      )
      await Promise.all(arrivals)
      settleUntilMs = now() + SEEK_SETTLE_MS
    },

    setPlaybackRate(rate) {
      playbackRate = rate
      clearTrims()
    },

    setTrackGain(trackId, gain, fadeSeconds) {
      const streamed = streamedTracks.find(
        (candidate) => candidate.track.id === trackId,
      )
      const currentContext = context
      if (streamed === undefined || currentContext === null) return
      const now = currentContext.currentTime
      streamed.gain.gain.cancelScheduledValues(now)
      streamed.gain.gain.setValueAtTime(streamed.gain.gain.value, now)
      streamed.gain.gain.linearRampToValueAtTime(gain, now + fadeSeconds)
    },

    getCurrentTime: currentTime,

    dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      disconnectTracks()
      context = null
    },
  }
}
