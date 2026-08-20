// useDrumNightRuntime — one silent-first owner for live input and transport.
// ============================================================

import { createSignal, onCleanup, onMount } from 'solid-js'
import type { DrumMidiEnvironment, DrumMidiMappingStore, DrumMidiState, } from './drum-input'
import type { DrumMidiAccessPort } from './drum-input'
import { createDrumMidiInput, createLocalDrumMidiMappingStore, installDrumKeyboardInput, } from './drum-input'
import type { DrumLatencyCalibrationResult } from './drum-latency-calibration'
import { DrumLatencyCalibration } from './drum-latency-calibration'
import type { EssentialDrumPadId } from './drum-pad-layout'
import { essentialDrumPad, isGeneralMidiDrumKey } from './drum-pad-layout'
import type { DrumHitSource, DrumKitPlayerPort, DrumLiveHit, } from './drum-runtime-types'
import { createSilentDrumKitPlayer } from './drum-runtime-types'
import type { DrumLoopRange, DrumRecordedHit, DrumRuntimeClock, DrumTransportState, } from './drum-transport'
import { createBrowserDrumRuntimeClock, createDrumTransport, } from './drum-transport'

export interface DrumNightRuntimeOptions {
  readonly player?: DrumKitPlayerPort
  readonly clock?: DrumRuntimeClock
  readonly midiEnvironment?: DrumMidiEnvironment
  readonly midiMappingStore?: DrumMidiMappingStore | null
  readonly keyboardTarget?: Pick<
    Window,
    'addEventListener' | 'removeEventListener'
  > | null
  readonly documentTarget?: Pick<
    Document,
    'addEventListener' | 'removeEventListener' | 'visibilityState'
  > | null
  readonly reducedMotionQuery?: MediaQueryList | null
}

function browserMidiMappingStore(): DrumMidiMappingStore | null {
  try {
    return typeof localStorage === 'undefined'
      ? null
      : createLocalDrumMidiMappingStore(localStorage)
  } catch {
    return null
  }
}

function browserMidiEnvironment(clock: DrumRuntimeClock): DrumMidiEnvironment {
  const midiNavigator = globalThis.navigator as Navigator & {
    requestMIDIAccess?: () => Promise<MIDIAccess>
  }
  return {
    requestAccess:
      typeof midiNavigator?.requestMIDIAccess === 'function'
        ? async () =>
            (await midiNavigator.requestMIDIAccess!()) as unknown as DrumMidiAccessPort
        : undefined,
    nowMs: clock.nowMs,
    timeOriginMs: () => performance.timeOrigin,
  }
}

function emptyMidiState(): DrumMidiState {
  return {
    status: 'idle',
    inputNames: [],
    availableInputs: [],
    selectedInputId: null,
    selectedInputName: null,
    hasReceivedHit: false,
    learningTargetGmKey: null,
    controllerValues: [],
    lastControllerChange: null,
    lastRawUnmappedNote: null,
    errorMessage: null,
  }
}

/**
 * Headless route controller. Creating it attaches no audio or MIDI resources;
 * those boundaries are crossed only by its user-action methods.
 */
export function useDrumNightRuntime(options: DrumNightRuntimeOptions = {}) {
  const clock = options.clock ?? createBrowserDrumRuntimeClock()
  const player = options.player ?? createSilentDrumKitPlayer()
  const transport = createDrumTransport({ clock })
  const calibration = new DrumLatencyCalibration()
  const [transportState, setTransportState] = createSignal<DrumTransportState>(
    transport.state(),
  )
  const [recordedHits, setRecordedHits] = createSignal<
    readonly DrumRecordedHit[]
  >([])
  const [recentHit, setRecentHit] = createSignal<DrumLiveHit | null>(null)
  const [midiState, setMidiState] =
    createSignal<DrumMidiState>(emptyMidiState())
  const [midiMapping, setMidiMapping] = createSignal<
    ReadonlyMap<number, number>
  >(new Map())
  const [runtimeError, setRuntimeError] = createSignal<string | null>(null)
  const [latencyCompensationMs, setLatencyCompensationMs] = createSignal(0)
  const [latencyCompensationSourceId, setLatencyCompensationSourceId] =
    createSignal<string | null>(null)
  const [calibrationResult, setCalibrationResult] =
    createSignal<DrumLatencyCalibrationResult>(calibration.result())
  const [pageVisible, setPageVisible] = createSignal(
    options.documentTarget?.visibilityState !== 'hidden',
  )
  const [prefersReducedMotion, setPrefersReducedMotion] = createSignal(
    options.reducedMotionQuery?.matches ?? false,
  )
  let calibrationExpected: {
    readonly timestampMs: number
    readonly sourceId: string
  } | null = null
  let calibrationSourceId: string | null = null
  let appliedLatencyMs = 0
  let appliedLatencySourceId: string | null = null
  let playerActivated = false
  let playerActivation: Promise<boolean> | null = null
  let disposed = false

  const syncTransport = (): void => {
    setTransportState(transport.state())
    setRecordedHits(transport.recordedHits())
  }

  const resetLatencyCalibration = (): void => {
    calibrationExpected = null
    calibrationSourceId = null
    calibration.reset()
    setCalibrationResult(calibration.result())
    appliedLatencyMs = 0
    appliedLatencySourceId = null
    setLatencyCompensationMs(0)
    setLatencyCompensationSourceId(null)
  }

  const activatePlayer = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false)
    if (playerActivated) return Promise.resolve(true)
    if (playerActivation !== null) return playerActivation
    try {
      const activationResult = player.activate()
      playerActivation = Promise.resolve(activationResult)
        .then((result) => {
          if (disposed) return false
          playerActivated = result !== false
          if (!playerActivated) {
            setRuntimeError('Drum audio could not be started.')
          } else {
            setRuntimeError(null)
          }
          return playerActivated
        })
        .catch((error: unknown) => {
          if (disposed) return false
          setRuntimeError(
            error instanceof Error
              ? error.message
              : 'Drum audio could not be started.',
          )
          return false
        })
        .finally(() => {
          if (!playerActivated) playerActivation = null
        })
      return playerActivation
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'Drum audio could not be started.',
      )
      return Promise.resolve(false)
    }
  }

  const deliverHit = (rawHit: DrumLiveHit): void => {
    if (disposed) return
    if (
      rawHit.source === 'midi' &&
      rawHit.sourceId !== undefined &&
      calibrationExpected?.sourceId === rawHit.sourceId
    ) {
      calibration.addStrike(calibrationExpected.timestampMs, rawHit.timestampMs)
      calibrationExpected = null
      setCalibrationResult(calibration.result())
    }

    const hitLatencyMs =
      rawHit.source === 'midi' && rawHit.sourceId === appliedLatencySourceId
        ? appliedLatencyMs
        : 0
    const hit = Object.freeze({
      ...rawHit,
      timestampMs: rawHit.timestampMs - hitLatencyMs,
    })
    setRecentHit(hit)
    transport.captureHit(hit)
    syncTransport()
    void activatePlayer().then((activated) => {
      if (!activated || disposed) return
      player.trigger({
        gmKey: hit.gmKey,
        velocity: hit.velocity,
        sourceId: hit.sourceId ?? hit.source,
      })
    })
  }

  const midiInput = createDrumMidiInput({
    environment: options.midiEnvironment ?? browserMidiEnvironment(clock),
    mappingStore:
      options.midiMappingStore === undefined
        ? browserMidiMappingStore()
        : options.midiMappingStore,
    onHit: deliverHit,
  })
  setMidiState(midiInput.state())
  setMidiMapping(midiInput.mapping())

  const unsubscribeTransport = transport.subscribe(syncTransport)
  const unsubscribeMidi = midiInput.subscribe(() => {
    const nextState = midiInput.state()
    const nextSourceId =
      nextState.status === 'connected' ? nextState.selectedInputId : null
    if (
      (calibrationSourceId !== null && calibrationSourceId !== nextSourceId) ||
      (appliedLatencySourceId !== null &&
        appliedLatencySourceId !== nextSourceId)
    ) {
      resetLatencyCalibration()
    }
    setMidiState(nextState)
    setMidiMapping(midiInput.mapping())
  })

  const connectMidi = async (): Promise<boolean> => {
    // Both calls begin synchronously inside the button gesture. The permission
    // request is never made from construction, mount, or visibility recovery.
    const activation = activatePlayer()
    const connection = midiInput.connect()
    void activation
    const connected = await connection
    if (disposed) return false
    setMidiState(midiInput.state())
    return connected
  }

  const play = async (): Promise<boolean> => {
    const activated = await activatePlayer()
    if (!activated || disposed) return false
    transport.start()
    syncTransport()
    return true
  }

  const pause = (): void => {
    transport.pause()
    player.panic()
    syncTransport()
  }

  const stop = (): void => {
    transport.stop()
    player.panic()
    syncTransport()
  }

  const strikePad = (
    padId: EssentialDrumPadId,
    velocity = 100,
    source: Extract<DrumHitSource, 'touch' | 'keyboard'> = 'touch',
  ): void => {
    const pad = essentialDrumPad(padId)
    deliverHit({
      gmKey: pad.gmKey,
      velocity: Math.min(127, Math.max(1, Math.round(velocity))),
      timestampMs: clock.nowMs(),
      source,
      sourceId: pad.id,
    })
  }

  const strikeGeneralMidi = (
    gmKey: number,
    velocity = 100,
    source: Extract<DrumHitSource, 'touch' | 'keyboard'> = 'touch',
  ): boolean => {
    if (!isGeneralMidiDrumKey(gmKey)) return false
    deliverHit({
      gmKey,
      velocity: Math.min(127, Math.max(1, Math.round(velocity))),
      timestampMs: clock.nowMs(),
      source,
    })
    return true
  }

  onMount(() => {
    const keyboardTarget =
      options.keyboardTarget === undefined ? window : options.keyboardTarget
    const uninstallKeyboard =
      keyboardTarget === null
        ? () => undefined
        : installDrumKeyboardInput(deliverHit, {
            target: keyboardTarget,
            nowMs: clock.nowMs,
            timeOriginMs: () => performance.timeOrigin,
          })

    const documentTarget =
      options.documentTarget === undefined ? document : options.documentTarget
    const onVisibilityChange = (): void => {
      const visible = documentTarget?.visibilityState !== 'hidden'
      setPageVisible(visible)
      if (!visible) pause()
    }
    documentTarget?.addEventListener('visibilitychange', onVisibilityChange)
    onVisibilityChange()

    const reducedMotionQuery =
      options.reducedMotionQuery === undefined
        ? (window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null)
        : options.reducedMotionQuery
    const onReducedMotionChange = (): void => {
      setPrefersReducedMotion(reducedMotionQuery?.matches ?? false)
    }
    reducedMotionQuery?.addEventListener?.('change', onReducedMotionChange)
    onReducedMotionChange()

    onCleanup(() => {
      uninstallKeyboard()
      documentTarget?.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      )
      reducedMotionQuery?.removeEventListener?.('change', onReducedMotionChange)
    })
  })

  onCleanup(() => {
    disposed = true
    unsubscribeTransport()
    unsubscribeMidi()
    midiInput.dispose()
    transport.dispose()
    try {
      player.panic()
    } catch {
      // Teardown still owns disposal when a player panic implementation fails.
    }
    try {
      void Promise.resolve(player.dispose()).catch(() => undefined)
    } catch {
      // A synchronous disposal failure must not escape Solid cleanup.
    }
  })

  return {
    transportState,
    recordedHits,
    recentHit,
    midiState,
    midiMapping,
    runtimeError,
    latencyCompensationMs,
    latencyCompensationSourceId,
    calibrationResult,
    pageVisible,
    prefersReducedMotion,
    connectMidi,
    disconnectMidi: () => midiInput.disconnect(),
    selectMidiInput: (inputId: string) => midiInput.selectInput(inputId),
    beginMidiLearnForPad: (padId: EssentialDrumPadId) =>
      midiInput.beginLearn(essentialDrumPad(padId).gmKey),
    cancelMidiLearn: () => midiInput.cancelLearn(),
    clearMidiMapping: (sourceMidiKey?: number) =>
      midiInput.clearMapping(sourceMidiKey),
    play,
    pause,
    stop,
    seek: (beat: number) => transport.seek(beat),
    setTempoBpm: (tempoBpm: number) => transport.setTempoBpm(tempoBpm),
    setCountInBeats: (countInBeats: number) =>
      transport.setCountInBeats(countInBeats),
    setLoop: (loop: DrumLoopRange | null) => transport.setLoop(loop),
    setRecording: (recording: boolean) => transport.setRecording(recording),
    clearRecording: () => transport.clearRecording(),
    schedulingWindow: (lookaheadMs?: number) =>
      transport.schedulingWindow(lookaheadMs),
    strikePad,
    strikeGeneralMidi,
    expectCalibrationHit(expectedTimestampMs: number): boolean {
      const selectedInputId = midiState().selectedInputId
      if (!Number.isFinite(expectedTimestampMs) || selectedInputId === null) {
        calibrationExpected = null
        return false
      }
      if (
        calibrationSourceId !== null &&
        calibrationSourceId !== selectedInputId
      ) {
        resetLatencyCalibration()
      }
      calibrationSourceId = selectedInputId
      calibrationExpected = {
        timestampMs: expectedTimestampMs,
        sourceId: selectedInputId,
      }
      return true
    },
    resetLatencyCalibration,
    applyLatencyCalibration(): boolean {
      const result = calibration.result()
      setCalibrationResult(result)
      if (
        result.status !== 'ready' ||
        result.estimateMs === null ||
        calibrationSourceId === null ||
        midiState().selectedInputId !== calibrationSourceId
      ) {
        return false
      }
      appliedLatencyMs = result.estimateMs
      appliedLatencySourceId = calibrationSourceId
      setLatencyCompensationMs(result.estimateMs)
      setLatencyCompensationSourceId(calibrationSourceId)
      return true
    },
  }
}

export type DrumNightRuntimeController = ReturnType<typeof useDrumNightRuntime>
