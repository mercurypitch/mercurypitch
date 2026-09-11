// Guitar backing controller exposes the shared transport as Solid route state.
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import { installAudioUnlock } from '@/lib/audio-unlock'
import { recordAnimationFrame } from '@/lib/device-tier'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import type { GuitarBackingLoadMode, GuitarBackingLoadProgress, GuitarBackingSession, GuitarBackingTrackState, GuitarBackingTransport, GuitarBackingTransportStatus, } from './guitar-backing-transport'
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
  const [loadProgress, setLoadProgress] =
    createSignal<GuitarBackingLoadProgress | null>(transport.getLoadProgress())
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
  const [backingMuted, setBackingMutedSignal] = createSignal(
    transport.getBackingMuted(),
  )
  const [tracks, setTracks] = createSignal<readonly GuitarBackingTrackState[]>(
    transport.getTrackStates(),
  )
  const [soloedTrackId, setSoloedTrackId] = createSignal<string | null>(
    transport.getSoloedTrackId(),
  )
  const [error, setError] = createSignal<string | null>(transport.getError())
  const [loopRange, setLoopRangeSignal] = createSignal<LoopSpan | null>(
    transport.getLoopRange(),
  )
  const [loopMode, setLoopMode] = createSignal<GuitarBackingLoadMode | null>(
    transport.getLoopMode(),
  )
  const [loopError, setLoopError] = createSignal<string | null>(
    transport.getLoopError(),
  )
  let frame: number | null = null

  const cancelFrame = (): void => {
    if (frame === null) return
    cancelAnimationFrame(frame)
    frame = null
  }

  // This is the room's only continuous animation frame while a song plays, so
  // it is the one place that can tell a phone it is struggling. Nothing in
  // Guitar Night fed the frame-health sampler before, which meant a room that
  // was visibly stuttering could never demote itself and never unlocked the
  // savings in performance-mode.css. One subtraction per frame.
  const updateClock = (timestampMs: number): void => {
    recordAnimationFrame(timestampMs)
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
    setLoadProgress(transport.getLoadProgress())
    setPositionSeconds(transport.getCurrentTime())
    setDurationSeconds(transport.getDuration())
    setPlaybackRateSignal(transport.getPlaybackRate())
    setMasterVolumeSignal(transport.getMasterVolume())
    setBackingMutedSignal(transport.getBackingMuted())
    setTracks(transport.getTrackStates())
    setSoloedTrackId(transport.getSoloedTrackId())
    setError(transport.getError())
    setLoopRangeSignal(transport.getLoopRange())
    setLoopMode(transport.getLoopMode())
    setLoopError(transport.getLoopError())
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

  const setBackingMuted = (muted: boolean): void => {
    transport.setBackingMuted(muted)
    sync()
  }

  const setLoopRange = (range: LoopSpan | null): boolean => {
    const accepted = transport.setLoopRange(range)
    sync()
    return accepted
  }

  const setElectricAmpParameters = (
    parameters: GuitarElectricAmpParameters,
  ): void => {
    transport.setElectricAmpParameters(parameters)
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

  const setTrackLevelDb = (id: string, db: number): void => {
    transport.setTrackLevelDb(id, db)
    sync()
  }

  const toggleTrackSolo = (id: string): void => {
    transport.toggleTrackSolo(id)
    sync()
  }

  const resetTrackLevels = (): void => {
    transport.resetTrackLevels()
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
    loadProgress,
    positionSeconds,
    durationSeconds,
    playbackRate,
    masterVolume,
    backingMuted,
    tracks,
    soloedTrackId,
    error,
    loopRange,
    loopMode,
    loopError,
    configure,
    activate,
    play,
    pause,
    stop,
    seek,
    setLoopRange,
    setPlaybackRate,
    setMasterVolume,
    setBackingMuted,
    setElectricAmpParameters,
    setTrackMuted,
    setTrackLevelDb,
    toggleTrackSolo,
    resetTrackLevels,
    getAudioGraph,
  }
}

export type GuitarBackingTransportController = ReturnType<
  typeof useGuitarBackingTransportController
>
