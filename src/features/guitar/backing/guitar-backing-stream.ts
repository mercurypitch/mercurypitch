// Guitar backing stream keeps memory-heavy local stems aligned without decoding whole songs to PCM.
// ============================================================

import type { GuitarBackingTrack } from './guitar-backing-transport'

interface StreamedTrack {
  track: GuitarBackingTrack
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
  onEnded: () => void
  onError: () => void
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
  seek(seconds: number): void
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

  const applyPlaybackRate = (element: HTMLMediaElement): void => {
    element.playbackRate = playbackRate
    element.preservesPitch = true
    if ('webkitPreservesPitch' in element) {
      ;(
        element as HTMLMediaElement & { webkitPreservesPitch: boolean }
      ).webkitPreservesPitch = true
    }
  }

  const clearTimers = (): void => {
    if (syncTimer !== null) clearInterval(syncTimer)
    if (pauseTimer !== null) clearTimeout(pauseTimer)
    syncTimer = null
    pauseTimer = null
  }

  const pauseNow = (): void => {
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
        if (
          Math.abs(streamed.element.currentTime - primaryTime) >
          options.driftToleranceSeconds
        ) {
          setElementTime(streamed.element, primaryTime)
        }
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
          const streamed: StreamedTrack = {
            track,
            element,
            source,
            gain,
            onEnded,
            onError,
          }
          element.addEventListener('ended', onEnded)
          element.addEventListener('error', onError)
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
      beginSync()
      return {
        playableTrackIds: [...playableIds],
        durationSeconds: Math.max(...playable.map(mediaDuration)),
      }
    },

    pause(delayMs = 0) {
      generation += 1
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

    seek(seconds) {
      for (const streamed of streamedTracks) {
        setElementTime(streamed.element, seconds)
      }
    },

    setPlaybackRate(rate) {
      playbackRate = rate
      for (const streamed of streamedTracks) {
        applyPlaybackRate(streamed.element)
      }
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
