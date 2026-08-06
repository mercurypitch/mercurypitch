// Guitar backing controller exposes the shared transport as Solid route state.
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import { installAudioUnlock } from '@/lib/audio-unlock'
import type { GuitarBackingSession, GuitarBackingTrackState, GuitarBackingTransport, GuitarBackingTransportStatus, } from './guitar-backing-transport'
import { createGuitarBackingTransport } from './guitar-backing-transport'

interface GuitarBackingTransportControllerOptions {
  createTransport?: () => GuitarBackingTransport
}

export function useGuitarBackingTransportController(
  options: GuitarBackingTransportControllerOptions = {},
) {
  const transport =
    options.createTransport?.() ?? createGuitarBackingTransport()
  const [status, setStatus] = createSignal<GuitarBackingTransportStatus>(
    transport.getStatus(),
  )
  const [positionSeconds, setPositionSeconds] = createSignal(
    transport.getCurrentTime(),
  )
  const [durationSeconds, setDurationSeconds] = createSignal(
    transport.getDuration(),
  )
  const [tracks, setTracks] = createSignal<readonly GuitarBackingTrackState[]>(
    transport.getTrackStates(),
  )
  const [error, setError] = createSignal<string | null>(transport.getError())
  let frame: number | null = null

  const cancelFrame = (): void => {
    if (frame === null) return
    cancelAnimationFrame(frame)
    frame = null
  }

  const updateClock = (): void => {
    setPositionSeconds(transport.getCurrentTime())
    if (transport.getStatus() !== 'playing') {
      frame = null
      return
    }
    frame = requestAnimationFrame(updateClock)
  }

  const sync = (): void => {
    const nextStatus = transport.getStatus()
    setStatus(nextStatus)
    setPositionSeconds(transport.getCurrentTime())
    setDurationSeconds(transport.getDuration())
    setTracks(transport.getTrackStates())
    setError(transport.getError())
    if (nextStatus === 'playing' && frame === null) {
      frame = requestAnimationFrame(updateClock)
    } else if (nextStatus !== 'playing') {
      cancelFrame()
    }
  }

  const unsubscribe = transport.subscribe(sync)
  const uninstallAudioUnlock = installAudioUnlock(() =>
    transport.getAudioContext(),
  )

  const configure = (session: GuitarBackingSession | null): void => {
    transport.configure(session)
    sync()
  }

  const play = async (): Promise<boolean> => {
    const started = await transport.play()
    sync()
    return started
  }

  const pause = (): void => {
    transport.pause()
    sync()
  }

  const stop = (): void => {
    transport.stop()
    sync()
  }

  const seek = (seconds: number): void => {
    transport.seek(seconds)
    sync()
  }

  const setMasterVolume = (position: number): void => {
    transport.setMasterVolume(position)
    sync()
  }

  const setTrackMuted = (id: string, muted: boolean): void => {
    transport.setTrackMuted(id, muted)
    sync()
  }

  onCleanup(() => {
    cancelFrame()
    uninstallAudioUnlock()
    unsubscribe()
    void transport.dispose()
  })

  return {
    status,
    positionSeconds,
    durationSeconds,
    tracks,
    error,
    configure,
    play,
    pause,
    stop,
    seek,
    setMasterVolume,
    setTrackMuted,
  }
}

export type GuitarBackingTransportController = ReturnType<
  typeof useGuitarBackingTransportController
>
