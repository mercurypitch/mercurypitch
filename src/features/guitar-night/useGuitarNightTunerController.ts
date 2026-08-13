// Guitar Night tuner control reuses one room input and one guide bus without owning either runtime.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarVoice } from '@/lib/guitar/guitar-synth'
import { createBassVoice, createGuitarVoice } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import type { TunerReading, TuningPreset } from '@/lib/guitar/tuner'
import { classifyPitchAgainstTarget, findNearestTunerTarget, getTunerTargets, instrumentTuningForPreset, isTuningSignal, } from '@/lib/guitar/tuner'
import type { GuitarListeningStartOptions, GuitarListeningStatus, } from './useGuitarListeningController'

const READY_READING_COUNT = 6
const REFERENCE_TONE_LIFETIME_MS = 2200

export const GUITAR_NIGHT_TUNING_PRESETS = [
  'Standard',
  'Drop D',
  'Half Step Down',
  'Open G',
  'DADGAD',
] as const satisfies readonly TuningPreset[]

export interface GuitarTunerListeningPort {
  status: Accessor<GuitarListeningStatus>
  error: Accessor<string | null>
  canTakeOverInput: Accessor<boolean>
  inputTakeoverPending: Accessor<boolean>
  inputProfile: Accessor<GuitarInputProfileKind>
  detectedFrequency: Accessor<number | null>
  clarity: Accessor<number>
  pitchRevision: Accessor<number>
  start(options?: GuitarListeningStartOptions): Promise<boolean>
  cancel(options?: { preserveNotice?: boolean }): void
  selectInputProfile(kind: GuitarInputProfileKind): Promise<void>
}

interface GuitarNightTunerControllerOptions {
  tuning: Accessor<InstrumentTuning>
  listening: GuitarTunerListeningPort
  activateAudio(): Promise<boolean>
  getAudioGraph(): GuitarSessionAudioGraph | null
  /** Pauses a backing or authored-score clock without resetting its position. */
  pausePlayback?(): void
  /** Keeps stage rows and tuner targets on the same physical tuning. */
  onTuning?(tuning: InstrumentTuning): void
}

function tuningIdentity(tuning: InstrumentTuning): string {
  return [
    tuning.instrument,
    tuning.stringCount,
    tuning.openMidi.join(','),
    tuning.capo ?? 0,
  ].join(':')
}

function matchingPreset(tuning: InstrumentTuning): TuningPreset | null {
  if (
    tuning.instrument !== 'guitar' ||
    tuning.stringCount !== 6 ||
    (tuning.capo ?? 0) !== 0
  ) {
    return null
  }
  for (const preset of GUITAR_NIGHT_TUNING_PRESETS) {
    const candidate = instrumentTuningForPreset(preset)
    if (
      candidate.openMidi.every((midi, index) => midi === tuning.openMidi[index])
    ) {
      return preset
    }
  }
  return null
}

function tunerDisplayName(tuning: InstrumentTuning): string {
  const sourceName = tuning.name?.trim()
  const base =
    sourceName !== undefined && sourceName.length > 0
      ? sourceName
      : `${tuning.stringCount}-string ${tuning.instrument}`
  return (tuning.capo ?? 0) > 0 ? `${base} · capo ${tuning.capo}` : base
}

function captureIsActive(status: GuitarListeningStatus): boolean {
  return (
    status === 'requesting' ||
    status === 'listening' ||
    status === 'calibrating'
  )
}

export function useGuitarNightTunerController(
  options: GuitarNightTunerControllerOptions,
) {
  const [manualTargetIndex, setManualTargetIndex] = createSignal<number | null>(
    null,
  )
  const [readyStringIndices, setReadyStringIndices] = createSignal<
    readonly number[]
  >([])
  const [referenceStringIndex, setReferenceStringIndex] = createSignal<
    number | null
  >(null)
  const [localError, setLocalError] = createSignal<string | null>(null)
  const targets = createMemo(() => getTunerTargets(options.tuning()))
  /**
   * Ungated display evidence keeps a physical-tuner direction visible even
   * before Auto is close enough to claim that it acquired an open string.
   */
  const evidenceReading = createMemo<TunerReading | null>(() => {
    if (options.listening.inputProfile() === 'midi') return null
    const frequency = options.listening.detectedFrequency()
    if (frequency === null) return null
    const targetStringIndex = manualTargetIndex()
    const target =
      targetStringIndex === null
        ? findNearestTunerTarget(frequency, targets())
        : (targets()[targetStringIndex] ?? null)
    if (target === null) return null
    return classifyPitchAgainstTarget(
      frequency,
      options.listening.clarity(),
      target,
    )
  })
  const reading = createMemo<TunerReading | null>(() => {
    const evidence = evidenceReading()
    if (evidence === null) return null
    return manualTargetIndex() !== null || isTuningSignal(evidence)
      ? evidence
      : null
  })
  const activePreset = createMemo(() => matchingPreset(options.tuning()))
  const tuningName = createMemo(
    () => activePreset() ?? tunerDisplayName(options.tuning()),
  )
  const isListening = createMemo(
    () => options.listening.status() === 'listening',
  )
  const isOpeningInput = createMemo(
    () => options.listening.status() === 'requesting',
  )
  const error = createMemo(() => localError() ?? options.listening.error())

  let referenceVoice: GuitarVoice | null = null
  let referenceTimer = 0
  let referenceGeneration = 0
  let lastTuningIdentity = tuningIdentity(options.tuning())
  let lastRevision = options.listening.pitchRevision()
  let stableTargetIndex: number | null = null
  let stableReadingCount = 0

  const stopReferenceTone = (): void => {
    referenceGeneration += 1
    if (referenceTimer !== 0) window.clearTimeout(referenceTimer)
    referenceTimer = 0
    referenceVoice?.dispose()
    referenceVoice = null
    setReferenceStringIndex(null)
  }

  const cancelInputLifetime = (): void => {
    if (
      captureIsActive(options.listening.status()) ||
      options.listening.canTakeOverInput() ||
      options.listening.inputTakeoverPending()
    ) {
      options.listening.cancel()
    }
  }

  const prepare = (): void => {
    options.pausePlayback?.()
    stopReferenceTone()
    cancelInputLifetime()
    setLocalError(null)
  }

  const close = (): void => {
    stopReferenceTone()
    cancelInputLifetime()
    setLocalError(null)
  }

  const startListening = async (): Promise<boolean> => {
    const profile = options.listening.inputProfile()
    options.pausePlayback?.()
    stopReferenceTone()
    setLocalError(null)
    if (profile === 'midi') {
      setLocalError('Choose Room mic or Plugged in to measure tuning.')
      return false
    }
    return options.listening.start({ purpose: 'tuner' })
  }

  const stopListening = (): void => {
    cancelInputLifetime()
  }

  const selectInputProfile = async (
    profile: Extract<GuitarInputProfileKind, 'microphone' | 'interface'>,
  ): Promise<void> => {
    const selectedProfile = profile
    setLocalError(null)
    stopReferenceTone()
    await options.listening.selectInputProfile(selectedProfile)
  }

  const selectTarget = (stringIndex: number | null): void => {
    if (
      stringIndex !== null &&
      (!Number.isInteger(stringIndex) || targets()[stringIndex] === undefined)
    ) {
      return
    }
    stableTargetIndex = null
    stableReadingCount = 0
    setManualTargetIndex(stringIndex)
  }

  const selectPreset = (preset: TuningPreset): void => {
    if (!GUITAR_NIGHT_TUNING_PRESETS.includes(preset)) return
    const nextTuning = instrumentTuningForPreset(preset)
    setManualTargetIndex(null)
    setReadyStringIndices([])
    options.onTuning?.(nextTuning)
  }

  const playReference = async (stringIndex: number): Promise<boolean> => {
    const target = targets()[stringIndex]
    const instrument = options.tuning().instrument
    if (target === undefined) return false

    options.pausePlayback?.()
    cancelInputLifetime()
    stopReferenceTone()
    setLocalError(null)
    const generation = referenceGeneration
    const activated = await options.activateAudio()
    if (generation !== referenceGeneration) return false
    if (!activated) {
      setLocalError('The reference string could not sound. Try again.')
      return false
    }
    const graph = options.getAudioGraph()
    if (generation !== referenceGeneration) return false
    if (graph === null) {
      setLocalError('The room audio path is unavailable.')
      return false
    }

    const voice =
      instrument === 'bass'
        ? createBassVoice(graph.context, target.targetHz, 1800)
        : createGuitarVoice(graph.context, target.targetHz, 1800, 'acoustic')
    voice.gain.connect(graph.buses.guide)
    referenceVoice = voice
    setReferenceStringIndex(stringIndex)
    referenceTimer = window.setTimeout(() => {
      if (generation !== referenceGeneration) return
      stopReferenceTone()
    }, REFERENCE_TONE_LIFETIME_MS)
    return true
  }

  createEffect(() => {
    const identity = tuningIdentity(options.tuning())
    if (identity === lastTuningIdentity) return
    lastTuningIdentity = identity
    stableTargetIndex = null
    stableReadingCount = 0
    lastRevision = options.listening.pitchRevision()
    setManualTargetIndex(null)
    setReadyStringIndices([])
    stopReferenceTone()
  })

  createEffect(() => {
    const revision = options.listening.pitchRevision()
    const currentReading = reading()
    if (revision === lastRevision) return
    lastRevision = revision
    if (revision === 0) {
      stableTargetIndex = null
      stableReadingCount = 0
      return
    }
    if (currentReading === null || !currentReading.inTune) {
      stableTargetIndex = currentReading?.stringIndex ?? null
      stableReadingCount = 0
      return
    }
    if (stableTargetIndex === currentReading.stringIndex) {
      stableReadingCount += 1
    } else {
      stableTargetIndex = currentReading.stringIndex
      stableReadingCount = 1
    }
    if (stableReadingCount < READY_READING_COUNT) return
    setReadyStringIndices((current) =>
      current.includes(currentReading.stringIndex)
        ? current
        : [...current, currentReading.stringIndex],
    )
  })

  onCleanup(() => {
    stopReferenceTone()
    cancelInputLifetime()
  })

  return {
    targets,
    reading,
    evidenceReading,
    tuningName,
    activePreset,
    manualTargetIndex,
    readyStringIndices,
    referenceStringIndex,
    isListening,
    isOpeningInput,
    error,
    inputProfile: options.listening.inputProfile,
    prepare,
    close,
    startListening,
    stopListening,
    selectInputProfile,
    selectTarget,
    selectPreset,
    playReference,
    stopReferenceTone,
  }
}

export type GuitarNightTunerController = ReturnType<
  typeof useGuitarNightTunerController
>
