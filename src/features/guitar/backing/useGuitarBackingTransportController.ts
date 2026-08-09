// Guitar backing controller exposes the shared transport as Solid route state.
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import { installAudioUnlock } from '@/lib/audio-unlock'
import type { GuitarBackingLoadMode, GuitarBackingSession, GuitarBackingTrackState, GuitarBackingTransport, GuitarBackingTransportStatus, } from './guitar-backing-transport'
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
  const [loadMode, setLoadMode] = createSignal<GuitarBackingLoadMode | null>(
    transport.getLoadMode(),
  )
  const [positionSeconds, setPositionSeconds] = createSignal(
    transport.getCurrentTime(),
  )
  const [durationSeconds, setDurationSeconds] = createSignal(
    transport.getDuration(),
  )
  const [playbackRate, setPlaybackRateSignal] = createSignal(
    transport.getPlaybackRate(),
  )
  const [masterVolume, setMasterVolumeSignal] = createSignal(
    transport.getMasterVolume(),
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
    setLoadMode(transport.getLoadMode())
    setPositionSeconds(transport.getCurrentTime())
    setDurationSeconds(transport.getDuration())
    setPlaybackRateSignal(transport.getPlaybackRate())
    setMasterVolumeSignal(transport.getMasterVolume())
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

  const activate = async (): Promise<boolean> => {
    const activated = await transport.activate()
    sync()
    return activated
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

  const setPlaybackRate = async (rate: number): Promise<boolean> => {
    const changed = await transport.setPlaybackRate(rate)
    sync()
    return changed
  }

  const setTrackMuted = (id: string, muted: boolean): void => {
    transport.setTrackMuted(id, muted)
    sync()
  }

  const getAudioGraph = () => transport.getAudioGraph()

  onCleanup(() => {
    cancelFrame()
    uninstallAudioUnlock()
    unsubscribe()
    void transport.dispose()
  })

  return {
    status,
    loadMode,
    positionSeconds,
    durationSeconds,
    playbackRate,
    masterVolume,
    tracks,
    error,
    configure,
    activate,
    play,
    pause,
    stop,
    seek,
    setPlaybackRate,
    setMasterVolume,
    setTrackMuted,
    getAudioGraph,
  }
}

export type GuitarBackingTransportController = ReturnType<
  typeof useGuitarBackingTransportController
>
