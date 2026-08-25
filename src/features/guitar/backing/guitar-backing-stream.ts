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
/** A cold decoder must hold enough music to survive an ordinary network wobble. */
const PLAYABLE_WINDOW_SECONDS = 5
/** Do not leave a damaged element holding the room in its loading state forever. */
const PLAYABLE_WINDOW_TIMEOUT_MS = 15_000
const PLAYABLE_WINDOW_EVENTS = [
  'progress',
  'canplay',
  'canplaythrough',
  'loadeddata',
  'durationchange',
  'timeupdate',
  'seeked',
] as const

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
  /** Buffered music required ahead of a cold start or seek. */
  playableWindowSeconds?: number
  /** Escape hatch for media engines that never expose a usable range. */
  playableWindowTimeoutMs?: number
}

function setElementTime(element: HTMLMediaElement, seconds: number): boolean {
  try {
    element.currentTime = seconds
    return true
  } catch {
    // Browsers can reject a seek until metadata arrives. play() performs a
    // second alignment pass after the element becomes usable.
    return false
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

function bufferedAhead(element: HTMLMediaElement, seconds: number): number {
  const ranges = element.buffered
  if (ranges === undefined) return 0
  for (let index = 0; index < ranges.length; index += 1) {
    const start = ranges.start(index)
    const end = ranges.end(index)
    // Container timestamps can put the first decoded frame a few
    // milliseconds after the requested time. Treat that as the same range.
    if (seconds >= start - 0.05 && seconds <= end + 0.05) {
      return Math.max(0, end - seconds)
    }
  }
  return 0
}

function isAtTime(element: HTMLMediaElement, seconds: number): boolean {
  return (
    Number.isFinite(element.currentTime) &&
    Math.abs(element.currentTime - seconds) <= 0.05
  )
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
  const pendingMediaWaitCancels = new Set<() => void>()
  /**
   * Whether this engine believes the room should be sounding. A `pause` event
   * is queued as a task, so a flag set around our own `element.pause()` call
   * would already be cleared by the time the listener ran — intent has to be
   * held as state, not as a window in time.
   */
  let wantPlaying = false

  const now = options.now ?? (() => Date.now())
  const playableWindowSeconds = Math.max(
    0,
    options.playableWindowSeconds ?? PLAYABLE_WINDOW_SECONDS,
  )
  const playableWindowTimeoutMs = Math.max(
    0,
    options.playableWindowTimeoutMs ?? PLAYABLE_WINDOW_TIMEOUT_MS,
  )

  const hasPlayableWindow = (
    streamed: StreamedTrack,
    offsetSeconds: number,
  ): boolean => {
    const duration = mediaDuration(streamed)
    const remaining =
      duration > 0 ? Math.max(0, duration - offsetSeconds) : Infinity
    const required = Math.min(playableWindowSeconds, remaining)
    return (
      required <= 0.05 ||
      bufferedAhead(streamed.element, offsetSeconds) >= required - 0.05
    )
  }

  /**
   * `play()` resolves as soon as WebKit has begun trying to play. On iOS that
   * can be one decoded frame, while Chromium usually waits long enough that
   * the difference went unnoticed. Keep the room bus closed until the media
   * element reports a real near-term window around the requested position.
   */
  const waitForPlayableWindow = (
    streamed: StreamedTrack,
    offsetSeconds: number,
    deadlineMs: number,
  ): Promise<boolean> => {
    if (hasPlayableWindow(streamed, offsetSeconds)) return Promise.resolve(true)
    const timeoutMs = Math.max(0, deadlineMs - Date.now())
    if (timeoutMs === 0) {
      return Promise.resolve(streamed.element.readyState >= 4)
    }

    return new Promise<boolean>((resolve) => {
      const element = streamed.element
      let timer: ReturnType<typeof setTimeout> | null = null
      let finished = false

      const finish = (ready: boolean): void => {
        if (finished) return
        finished = true
        for (const event of PLAYABLE_WINDOW_EVENTS) {
          element.removeEventListener(event, inspect)
        }
        element.removeEventListener('error', fail)
        element.removeEventListener('abort', fail)
        if (timer !== null) clearTimeout(timer)
        pendingMediaWaitCancels.delete(cancel)
        resolve(ready)
      }
      const inspect = (): void => {
        if (hasPlayableWindow(streamed, offsetSeconds)) finish(true)
      }
      const fail = (): void => finish(false)
      const cancel = (): void => finish(false)

      pendingMediaWaitCancels.add(cancel)
      for (const event of PLAYABLE_WINDOW_EVENTS) {
        element.addEventListener(event, inspect)
      }
      element.addEventListener('error', fail, { once: true })
      element.addEventListener('abort', fail, { once: true })
      timer = setTimeout(() => {
        // HAVE_ENOUGH_DATA is the browser's own stronger promise that the
        // resource can continue. It is a safe fallback for engines that do
        // not expose byte ranges for an otherwise playable local blob.
        finish(
          hasPlayableWindow(streamed, offsetSeconds) || element.readyState >= 4,
        )
      }, timeoutMs)
      inspect()
    })
  }

  /**
   * Ask for the target without treating a slow, accepted seek as a failure.
   * Safari may need seconds to finish it; the buffer/settlement stages below
   * own that wait under the room's shared readiness deadline.
   */
  const waitForSeekRequest = (
    element: HTMLMediaElement,
    seconds: number,
    deadlineMs: number,
  ): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null
      let finished = false
      const finish = (accepted: boolean): void => {
        if (finished) return
        finished = true
        element.removeEventListener('loadedmetadata', request)
        element.removeEventListener('durationchange', request)
        element.removeEventListener('error', fail)
        element.removeEventListener('abort', fail)
        if (timer !== null) clearTimeout(timer)
        pendingMediaWaitCancels.delete(cancel)
        resolve(accepted)
      }
      const request = (): void => {
        if (setElementTime(element, seconds)) finish(true)
      }
      const fail = (): void => finish(false)
      const cancel = (): void => finish(false)
      pendingMediaWaitCancels.add(cancel)
      element.addEventListener('loadedmetadata', request)
      element.addEventListener('durationchange', request)
      element.addEventListener('error', fail, { once: true })
      element.addEventListener('abort', fail, { once: true })
      timer = setTimeout(
        () => finish(false),
        Math.max(0, deadlineMs - Date.now()),
      )
      request()
    })

  /**
   * Hold until the requested target really lands. When play() already asked
   * for this target, reuse its in-flight seek instead of restarting Safari's
   * decoder. If the hidden warm-up advanced after landing, request one final
   * alignment under the same readiness deadline.
   */
  const waitForSeekSettlement = (
    element: HTMLMediaElement,
    seconds: number,
    deadlineMs: number,
    targetAlreadyRequested: boolean,
  ): Promise<boolean> => {
    if (!element.seeking && isAtTime(element, seconds)) {
      return Promise.resolve(true)
    }
    const timeoutMs = Math.max(0, deadlineMs - Date.now())
    if (timeoutMs === 0) return Promise.resolve(false)

    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null
      let finished = false
      let reuseInFlight = targetAlreadyRequested
      const finish = (settled: boolean): void => {
        if (finished) return
        finished = true
        element.removeEventListener('seeked', settle)
        element.removeEventListener('loadedmetadata', request)
        element.removeEventListener('durationchange', request)
        element.removeEventListener('error', fail)
        element.removeEventListener('abort', fail)
        if (timer !== null) clearTimeout(timer)
        pendingMediaWaitCancels.delete(cancel)
        resolve(settled)
      }
      const settle = (): void => {
        if (isAtTime(element, seconds)) finish(true)
        else request()
      }
      const request = (): void => {
        if (reuseInFlight && element.seeking) return
        reuseInFlight = false
        if (!setElementTime(element, seconds)) return
        // A seek to where the element already sits fires nothing.
        if (!element.seeking) finish(isAtTime(element, seconds))
      }
      const fail = (): void => finish(false)
      const cancel = (): void => finish(false)
      pendingMediaWaitCancels.add(cancel)
      element.addEventListener('seeked', settle)
      element.addEventListener('loadedmetadata', request)
      element.addEventListener('durationchange', request)
      element.addEventListener('error', fail, { once: true })
      element.addEventListener('abort', fail, { once: true })
      timer = setTimeout(() => finish(false), timeoutMs)
      request()
    })
  }

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
    for (const cancel of [...pendingMediaWaitCancels]) cancel()
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
      const targetRequests = new Map<StreamedTrack, boolean>()
      const starts = streamedTracks.map((streamed) => {
        targetRequests.set(
          streamed,
          setElementTime(streamed.element, offsetSeconds),
        )
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

      const started = streamedTracks.filter((streamed, index) => {
        if (settled[index].status === 'fulfilled') return true
        streamed.element.pause()
        return false
      })
      const readinessDeadlineMs = Date.now() + playableWindowTimeoutMs
      // iOS can reject `currentTime = offset` until play() has opened the
      // element and metadata exists. Ask again *before* waiting on a range at
      // that offset; otherwise a forward seek can buffer from zero forever
      // while the room waits for bytes the browser was never asked to fetch.
      const aligned = await Promise.all(
        started.map((streamed) => {
          if (targetRequests.get(streamed) === true) return true
          return waitForSeekRequest(
            streamed.element,
            offsetSeconds,
            readinessDeadlineMs,
          )
        }),
      )
      if (disposed || currentGeneration !== generation) {
        pauseNow()
        return null
      }
      const alignedStarted = started.filter((streamed, index) => {
        if (aligned[index]) return true
        streamed.element.pause()
        return false
      })

      const ready = await Promise.all(
        alignedStarted.map((streamed) =>
          waitForPlayableWindow(streamed, offsetSeconds, readinessDeadlineMs),
        ),
      )
      if (disposed || currentGeneration !== generation) {
        pauseNow()
        return null
      }

      const playable = alignedStarted.filter((streamed, index) => {
        if (ready[index]) return true
        streamed.element.pause()
        return false
      })
      // The hidden warm-up above may have advanced while its buffer filled.
      // Align once more, and this time wait for WebKit's asynchronous seek to
      // land before the transport opens the room bus.
      const realigned = await Promise.all(
        playable.map((streamed) =>
          waitForSeekSettlement(
            streamed.element,
            offsetSeconds,
            readinessDeadlineMs,
            true,
          ),
        ),
      )
      if (disposed || currentGeneration !== generation) {
        pauseNow()
        return null
      }

      const settledPlayable = playable.filter((streamed, index) => {
        if (realigned[index]) return true
        streamed.element.pause()
        return false
      })

      playableIds = new Set(
        settledPlayable.map((streamed) => streamed.track.id),
      )
      if (settledPlayable.length === 0) return null

      master = settledPlayable.reduce((longest, candidate) =>
        mediaDuration(candidate) > mediaDuration(longest) ? candidate : longest,
      )
      wantPlaying = true
      // Every element was just re-primed from a cold start; hold the servo
      // off until their clocks mean something again.
      settleUntilMs = now() + SEEK_SETTLE_MS
      beginSync()
      return {
        playableTrackIds: [...playableIds],
        durationSeconds: Math.max(...settledPlayable.map(mediaDuration)),
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
      const deadlineMs = Date.now() + SEEK_TIMEOUT_MS
      await Promise.all(
        streamedTracks.map((streamed) =>
          waitForSeekSettlement(streamed.element, seconds, deadlineMs, false),
        ),
      )
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
