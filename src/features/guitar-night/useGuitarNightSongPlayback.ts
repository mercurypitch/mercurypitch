// Song playback policy permits explicit Direct-input jamming without opening or monitoring input.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, onCleanup, untrack } from 'solid-js'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarListeningController } from './useGuitarListeningController'

interface GuitarNightSongPlaybackOptions {
  transport: Accessor<
    Pick<GuitarBackingTransportController, 'status' | 'play' | 'pause'>
  >
  listening: Pick<
    GuitarListeningController,
    | 'status'
    | 'inputProfile'
    | 'take'
    | 'start'
    | 'stop'
    | 'useInputHere'
    | 'inputTakeoverPending'
    | 'canTakeOverInput'
    | 'calibrate'
    | 'selectInputProfile'
    | 'selectAudioInput'
    | 'selectMidiInput'
  >
  /** Tuner and suspending sheets own their own input lifecycle. */
  blocked: Accessor<boolean>
  sourceIdentity: Accessor<unknown>
}

export function useGuitarNightSongPlayback(
  options: GuitarNightSongPlaybackOptions,
) {
  const inputActive = createMemo(() => {
    const status = options.listening.status()
    return (
      status === 'requesting' ||
      status === 'listening' ||
      status === 'calibrating'
    )
  })
  const fallbackInput = createMemo(() => {
    const input = options.listening.take()?.input
    return (
      options.listening.status() === 'listening' &&
      input?.kind === 'interface' &&
      input.requestedDeviceId !== null &&
      input.requestedDeviceId !== input.activeDeviceId
    )
  })
  const directInput = createMemo(
    () => options.listening.inputProfile() === 'interface' && !fallbackInput(),
  )
  const transportActive = (): boolean => {
    const status = options.transport().status()
    return status === 'playing' || status === 'loading'
  }
  const pauseBacking = (): void => {
    if (transportActive()) options.transport().pause()
  }
  const stopAll = (): void => {
    options.listening.stop()
    options.transport().pause()
  }
  const play = async (): Promise<boolean> => {
    if (options.blocked() || options.listening.status() === 'calibrating')
      return false
    if (
      !directInput() &&
      (inputActive() ||
        options.listening.inputTakeoverPending() ||
        options.listening.canTakeOverInput())
    ) {
      options.listening.stop()
    }
    return options.transport().play()
  }
  const togglePlayback = (): void => {
    if (options.blocked()) return
    if (transportActive()) options.transport().pause()
    else void play()
  }
  const startListening = async (): Promise<boolean> => {
    if (options.blocked() || options.listening.status() === 'calibrating')
      return false
    if (!directInput()) pauseBacking()
    return options.listening.start()
  }
  const toggleListening = (): void => {
    if (options.blocked()) return
    if (inputActive() || options.listening.inputTakeoverPending())
      options.listening.stop()
    else void startListening()
  }
  const useInputHere = async (): Promise<boolean> => {
    if (options.blocked()) return false
    if (!directInput()) pauseBacking()
    return options.listening.useInputHere()
  }
  const calibrate = async (): Promise<boolean> => {
    if (options.blocked()) return false
    pauseBacking()
    return options.listening.calibrate()
  }
  // A device change ends the current input/monitor in the existing controller.
  // Park its accompaniment too; neither one silently resumes on the new route.
  const parkInputChange = (): void => {
    if (inputActive() || options.listening.inputTakeoverPending())
      pauseBacking()
  }
  const selectInputProfile = async (
    kind: GuitarInputProfileKind,
  ): Promise<void> => {
    if (options.blocked()) return
    if (kind !== options.listening.inputProfile()) parkInputChange()
    await options.listening.selectInputProfile(kind)
  }
  const selectAudioInput = async (id: string | null): Promise<void> => {
    if (options.blocked()) return
    parkInputChange()
    await options.listening.selectAudioInput(id)
  }
  const selectMidiInput = async (id: string | null): Promise<void> => {
    if (options.blocked()) return
    parkInputChange()
    await options.listening.selectMidiInput(id)
  }

  let previousInputActive = false
  createEffect(() => {
    const active = inputActive()
    const status = options.listening.status()
    const profile = options.listening.inputProfile()
    const blocked = options.blocked()
    // An unavailable saved interface may resolve to the built-in microphone.
    // The existing notice names it; it is not a safe concurrent DI route.
    const fallback = fallbackInput()
    const lostInput = previousInputActive && status === 'error'
    previousInputActive = active
    if (
      blocked ||
      status === 'calibrating' ||
      lostInput ||
      fallback ||
      (active && profile !== 'interface')
    ) {
      // Read transport truth too, so a pending start cannot reopen the backing
      // after a calibration, fallback or non-DI recovery has taken ownership.
      pauseBacking()
    }
  })

  let sourceIdentity = untrack(options.sourceIdentity)
  createEffect(() => {
    const next = options.sourceIdentity()
    if (next === sourceIdentity) return
    sourceIdentity = next
    untrack(stopAll)
  })
  onCleanup(stopAll)

  return {
    play,
    togglePlayback,
    toggleListening,
    startListening,
    useInputHere,
    calibrate,
    selectInputProfile,
    selectAudioInput,
    selectMidiInput,
    stopAll,
  }
}
