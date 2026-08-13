// ============================================================
// Guitar Night tuner experience — adapts the shared tuner controller to the Velvet surface
// ============================================================
//
// Targets remain identified by their stage string index even though the tuner
// rail presents them from the lowest string to the highest string. Runtime
// effects stay behind the controller so every host shares the same lifecycle.

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import type { TunerTarget } from '@/lib/guitar/tuner'
import type { MicPermissionState } from '@/lib/jam/media-errors'
import { micPermissionState } from '@/lib/jam/media-errors'
import type { GuitarNightTunerInputProfile, GuitarNightTunerPitchState, GuitarNightTunerPreset, GuitarNightTunerProps, GuitarNightTunerString, GuitarNightTunerSurfaceMode, GuitarNightTunerTargetMode, } from './GuitarNightTuner'
import { GuitarNightTuner } from './GuitarNightTuner'
import type { GuitarNightTunerController } from './useGuitarNightTunerController'
import { GUITAR_NIGHT_TUNING_PRESETS } from './useGuitarNightTunerController'

interface GuitarNightTunerExperienceProps {
  controller: GuitarNightTunerController
  tuning: Accessor<InstrumentTuning>
  detectedFrequencyHz: Accessor<number | null>
  detectedNoteLabel: Accessor<string | null>
  surfaceMode?: GuitarNightTunerSurfaceMode
  showTuningPresets?: Accessor<boolean>
  recoveryActionLabel?: Accessor<string | null>
  onRecoveryAction?(): void
  onBack(): void
}

interface DisplayString {
  stringIndex: number
  value: GuitarNightTunerString
}

const EMPTY_PRESETS: readonly GuitarNightTunerPreset[] = []
const TUNING_PRESETS: readonly GuitarNightTunerPreset[] =
  GUITAR_NIGHT_TUNING_PRESETS.map((preset) => ({
    id: preset,
    label: preset,
  }))

function stringId(stringIndex: number): string {
  return `string-${stringIndex}`
}

/** Split names such as F#1 and C-1 without assuming a one-digit octave. */
function pitchParts(
  stringName: string,
  targetMidi: number,
): Pick<GuitarNightTunerString, 'noteName' | 'octave'> {
  const trimmed = stringName.trim()
  const match = /^(.+?)(-?\d+)$/.exec(trimmed)
  const fallbackOctave = Math.floor(targetMidi / 12) - 1
  if (match === null) {
    return {
      noteName: trimmed === '' ? '?' : trimmed,
      octave: fallbackOctave,
    }
  }

  const octave = Number.parseInt(match[2], 10)
  return {
    noteName: match[1].trim() || '?',
    octave: Number.isInteger(octave) ? octave : fallbackOctave,
  }
}

function displayString(target: TunerTarget): DisplayString {
  return {
    stringIndex: target.stringIndex,
    value: {
      id: stringId(target.stringIndex),
      stringNumber: target.stringIndex + 1,
      ...pitchParts(target.stringName, target.targetMidi),
      frequencyHz: target.targetHz,
    },
  }
}

function inputLabel(
  profile: ReturnType<GuitarNightTunerController['inputProfile']>,
): string {
  if (profile === 'interface') return 'Plugged in'
  if (profile === 'microphone') return 'Room mic'
  return 'Choose Room mic or Plugged in'
}

/**
 * Present one controller identically as a standalone preflight or a room-owned
 * overlay. Mounting prepares the room silently; leaving always closes capture
 * and reference sound before handing navigation back to the host.
 */
export function GuitarNightTunerExperience(
  props: GuitarNightTunerExperienceProps,
) {
  let closed = false
  const [microphonePermission, setMicrophonePermission] =
    createSignal<MicPermissionState>('unknown')
  const displayStrings = createMemo<readonly DisplayString[]>(() =>
    [...props.controller.targets()].reverse().map(displayString),
  )
  const strings = createMemo<readonly GuitarNightTunerString[]>(() =>
    displayStrings().map((target) => target.value),
  )
  const stringIndicesById = createMemo(
    () =>
      new Map(
        displayStrings().map(
          (target) => [target.value.id, target.stringIndex] as const,
        ),
      ),
  )
  const validStringId = (stringIndex: number | null): string | null => {
    if (stringIndex === null) return null
    const id = stringId(stringIndex)
    return stringIndicesById().has(id) ? id : null
  }
  const targetMode = createMemo<GuitarNightTunerTargetMode>(() =>
    props.controller.manualTargetIndex() === null ? 'auto' : 'manual',
  )
  const targetStringId = createMemo(() =>
    validStringId(
      props.controller.manualTargetIndex() ??
        props.controller.reading()?.stringIndex ??
        null,
    ),
  )
  const readyStringIds = createMemo<readonly string[]>(() =>
    props.controller.readyStringIndices().flatMap((stringIndex) => {
      const id = validStringId(stringIndex)
      return id === null ? [] : [id]
    }),
  )
  const referenceStringId = createMemo(() =>
    validStringId(props.controller.referenceStringIndex()),
  )
  const listeningState = createMemo<
    ReturnType<GuitarNightTunerProps['listeningState']>
  >(() => {
    if (props.controller.isOpeningInput()) return 'starting'
    if (props.controller.isListening()) return 'listening'
    return 'idle'
  })
  const pitchState = createMemo<GuitarNightTunerPitchState>(() => {
    if (props.controller.error() !== null) return 'error'
    if (props.controller.isOpeningInput()) return 'searching'
    if (!props.controller.isListening()) return 'idle'

    const evidence = props.controller.evidenceReading()
    if (evidence === null) {
      const detectedFrequency = props.detectedFrequencyHz()
      return detectedFrequency !== null &&
        Number.isFinite(detectedFrequency) &&
        detectedFrequency > 0
        ? 'unsteady'
        : 'searching'
    }
    if (evidence.inTune) return 'in-tune'
    if (evidence.centsDeviation < 0) return 'low'
    if (evidence.centsDeviation > 0) return 'high'
    return 'unsteady'
  })
  const instrumentLabel = createMemo(() => {
    const tuning = props.tuning()
    return `${tuning.stringCount}-string ${tuning.instrument}`
  })
  const selectedInputProfile = createMemo<GuitarNightTunerInputProfile | null>(
    () => {
      const profile = props.controller.inputProfile()
      return profile === 'midi' ? null : profile
    },
  )
  const selectedInputLabel = createMemo(() =>
    inputLabel(props.controller.inputProfile()),
  )
  const tuningPresets = createMemo<readonly GuitarNightTunerPreset[]>(() => {
    if (props.showTuningPresets?.() === false) return EMPTY_PRESETS
    const tuning = props.tuning()
    return tuning.instrument === 'guitar' &&
      tuning.stringCount === 6 &&
      (tuning.capo ?? 0) === 0
      ? TUNING_PRESETS
      : EMPTY_PRESETS
  })

  const selectTargetMode = (mode: GuitarNightTunerTargetMode): void => {
    if (mode === 'auto') {
      props.controller.selectTarget(null)
      return
    }
    if (props.controller.manualTargetIndex() !== null) return
    const fallback = displayStrings()[0]?.stringIndex ?? null
    props.controller.selectTarget(
      props.controller.reading()?.stringIndex ?? fallback,
    )
  }

  const selectTargetString = (id: string): void => {
    const stringIndex = stringIndicesById().get(id)
    if (
      stringIndex !== undefined &&
      props.controller.manualTargetIndex() !== stringIndex
    ) {
      props.controller.selectTarget(stringIndex)
    }
  }

  const startReference = (target: GuitarNightTunerString): void => {
    const stringIndex = stringIndicesById().get(target.id)
    if (stringIndex !== undefined) {
      void props.controller.playReference(stringIndex)
    }
  }

  const selectTuningPreset = (presetId: string): void => {
    const preset = GUITAR_NIGHT_TUNING_PRESETS.find(
      (candidate) => candidate === presetId,
    )
    if (preset !== undefined) props.controller.selectPreset(preset)
  }

  const refreshMicrophonePermission = async (): Promise<void> => {
    const state = await micPermissionState()
    if (!closed) setMicrophonePermission(state)
  }

  const closeController = (): void => {
    if (closed) return
    closed = true
    props.controller.close()
  }
  const back = (): void => {
    closeController()
    props.onBack()
  }

  onMount(() => {
    props.controller.prepare()
    void refreshMicrophonePermission()
  })
  onCleanup(closeController)

  return (
    <GuitarNightTuner
      surfaceMode={props.surfaceMode ?? 'standalone'}
      instrumentLabel={instrumentLabel}
      tuningLabel={props.controller.tuningName}
      inputLabel={selectedInputLabel}
      strings={strings}
      readyStringIds={readyStringIds}
      targetMode={targetMode}
      targetStringId={targetStringId}
      listeningState={listeningState}
      pitchState={pitchState}
      detectedNoteLabel={props.detectedNoteLabel}
      detectedFrequencyHz={props.detectedFrequencyHz}
      cents={() => props.controller.evidenceReading()?.centsDeviation ?? null}
      statusDetail={props.controller.error}
      referenceStringId={referenceStringId}
      inputProfile={selectedInputProfile}
      microphonePermission={microphonePermission}
      onInputProfileChange={(profile) => {
        void props.controller.selectInputProfile(profile)
      }}
      tuningPresets={tuningPresets}
      activeTuningPreset={props.controller.activePreset}
      onTuningPresetChange={selectTuningPreset}
      recoveryActionLabel={props.recoveryActionLabel}
      onRecoveryAction={props.onRecoveryAction}
      onBack={back}
      onTargetModeChange={selectTargetMode}
      onTargetStringChange={selectTargetString}
      onStartListening={() => {
        void props.controller.startListening().then((started) => {
          if (closed) return
          if (started) {
            setMicrophonePermission('granted')
            return
          }
          void refreshMicrophonePermission()
        })
      }}
      onStopListening={() => props.controller.stopListening()}
      onStartReference={startReference}
      onStopReference={() => props.controller.stopReferenceTone()}
    />
  )
}
