// ============================================================
// Guitar Night tuner experience tests — protect controller-to-surface mapping
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import { standardTuning } from '@/lib/guitar/instrument-tuning'
import type { TunerReading, TunerTarget } from '@/lib/guitar/tuner'
import type { GuitarNightTunerProps } from './GuitarNightTuner'
import { GuitarNightTunerExperience } from './GuitarNightTunerExperience'
import type { GuitarNightTunerController } from './useGuitarNightTunerController'

const tunerSurface = vi.hoisted(() => ({
  props: null as GuitarNightTunerProps | null,
}))

vi.mock('./GuitarNightTuner', () => ({
  GuitarNightTuner: (props: GuitarNightTunerProps) => {
    return (
      <div
        ref={(element) => {
          void element
          tunerSurface.props = { ...props }
        }}
        data-testid="tuner-surface"
        data-surface-mode={props.surfaceMode ?? 'standalone'}
      />
    )
  },
}))

interface ControllerHarness {
  controller: GuitarNightTunerController
  setReading(reading: TunerReading | null): void
  setListening(listening: boolean): void
  setOpening(opening: boolean): void
  setError(error: string | null): void
  setInputProfile(profile: GuitarInputProfileKind): void
}

function standardTargets(): TunerTarget[] {
  return [
    {
      stringIndex: 0,
      stringName: 'E4',
      stringLabel: 'e',
      targetMidi: 64,
      targetHz: 329.63,
    },
    {
      stringIndex: 1,
      stringName: 'B3',
      stringLabel: 'B',
      targetMidi: 59,
      targetHz: 246.94,
    },
    {
      stringIndex: 2,
      stringName: 'G3',
      stringLabel: 'G',
      targetMidi: 55,
      targetHz: 196,
    },
    {
      stringIndex: 3,
      stringName: 'D3',
      stringLabel: 'D',
      targetMidi: 50,
      targetHz: 146.83,
    },
    {
      stringIndex: 4,
      stringName: 'A2',
      stringLabel: 'A',
      targetMidi: 45,
      targetHz: 110,
    },
    {
      stringIndex: 5,
      stringName: 'E2',
      stringLabel: 'E',
      targetMidi: 40,
      targetHz: 82.41,
    },
  ]
}

function createControllerHarness(
  suppliedTargets: readonly TunerTarget[] = standardTargets(),
): ControllerHarness {
  const [manualTargetIndex, setManualTargetIndex] = createSignal<number | null>(
    null,
  )
  const [reading, setReading] = createSignal<TunerReading | null>(null)
  const [isListening, setListening] = createSignal(false)
  const [isOpeningInput, setOpening] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [inputProfile, setInputProfile] =
    createSignal<GuitarInputProfileKind>('microphone')
  const selectTarget = vi.fn((index: number | null) =>
    setManualTargetIndex(index),
  )
  const controller = {
    targets: () => suppliedTargets,
    reading,
    tuningName: () => 'Standard',
    activePreset: () => 'Standard',
    manualTargetIndex,
    readyStringIndices: () => [5],
    referenceStringIndex: () => 4,
    isListening,
    isOpeningInput,
    error,
    inputProfile,
    prepare: vi.fn(),
    close: vi.fn(),
    startListening: vi.fn(async () => true),
    stopListening: vi.fn(),
    selectInputProfile: vi.fn(async (profile) => setInputProfile(profile)),
    selectTarget,
    selectPreset: vi.fn(),
    playReference: vi.fn(async () => true),
    stopReferenceTone: vi.fn(),
  } as unknown as GuitarNightTunerController

  return {
    controller,
    setReading,
    setListening,
    setOpening,
    setError,
    setInputProfile,
  }
}

function currentSurface(): GuitarNightTunerProps {
  const props = tunerSurface.props
  if (props === null) throw new Error('The tuner surface was not rendered.')
  return props
}

afterEach(() => {
  cleanup()
  tunerSurface.props = null
})

describe('GuitarNightTunerExperience', () => {
  it('presents targets low-to-high while keeping stage string identities', () => {
    const harness = createControllerHarness()
    const tuning = standardTuning('guitar')

    render(() => (
      <GuitarNightTunerExperience
        controller={harness.controller}
        tuning={() => tuning}
        detectedFrequencyHz={() => null}
        detectedNoteLabel={() => null}
        onBack={() => undefined}
      />
    ))

    const surface = currentSurface()
    expect(surface.strings().map((target) => target.id)).toEqual([
      'string-5',
      'string-4',
      'string-3',
      'string-2',
      'string-1',
      'string-0',
    ])
    expect(surface.strings()[0]).toMatchObject({
      stringNumber: 6,
      noteName: 'E',
      octave: 2,
    })
    expect(surface.readyStringIds?.()).toEqual(['string-5'])
    expect(surface.referenceStringId()).toBe('string-4')

    surface.onTargetStringChange('string-3')
    expect(harness.controller.selectTarget).toHaveBeenLastCalledWith(3)
    surface.onTargetModeChange('auto')
    expect(harness.controller.selectTarget).toHaveBeenLastCalledWith(null)
  })

  it('parses a negative octave and gives Manual a current or low-string target', () => {
    const targets = standardTargets()
    targets[5] = {
      stringIndex: 5,
      stringName: 'C-1',
      stringLabel: 'C',
      targetMidi: 0,
      targetHz: 8.18,
    }
    const harness = createControllerHarness(targets)
    const tuning = standardTuning('guitar')

    render(() => (
      <GuitarNightTunerExperience
        controller={harness.controller}
        tuning={() => tuning}
        detectedFrequencyHz={() => null}
        detectedNoteLabel={() => null}
        onBack={() => undefined}
      />
    ))

    const surface = currentSurface()
    expect(surface.strings()[0]).toMatchObject({ noteName: 'C', octave: -1 })

    surface.onTargetModeChange('manual')
    expect(harness.controller.selectTarget).toHaveBeenLastCalledWith(5)

    harness.controller.selectTarget(null)
    harness.setReading({
      frequency: 110,
      stringIndex: 4,
      stringName: 'A2',
      stringLabel: 'A',
      targetMidi: 45,
      targetHz: 110,
      centsDeviation: 0,
      inTune: true,
      close: true,
      midi: 45,
      clarity: 0.9,
    })
    surface.onTargetModeChange('manual')
    expect(harness.controller.selectTarget).toHaveBeenLastCalledWith(4)
  })

  it('derives live states and forwards every action through the controller', async () => {
    const harness = createControllerHarness()
    const tuning = standardTuning('guitar')
    const [frequency, setFrequency] = createSignal<number | null>(109.4)
    const [showPresets, setShowPresets] = createSignal(true)
    const back = vi.fn()
    const recover = vi.fn()
    harness.setListening(true)
    harness.setReading({
      frequency: 109.4,
      stringIndex: 4,
      stringName: 'A2',
      stringLabel: 'A',
      targetMidi: 45,
      targetHz: 110,
      centsDeviation: -9.47,
      inTune: false,
      close: true,
      midi: 45,
      clarity: 0.9,
    })

    const rendered = render(() => (
      <GuitarNightTunerExperience
        controller={harness.controller}
        tuning={() => tuning}
        detectedFrequencyHz={frequency}
        detectedNoteLabel={() => 'A2'}
        surfaceMode="overlay"
        showTuningPresets={showPresets}
        recoveryActionLabel={() => 'Use it here'}
        onRecoveryAction={recover}
        onBack={back}
      />
    ))

    let surface = currentSurface()
    expect(harness.controller.prepare).toHaveBeenCalledOnce()
    expect(surface.surfaceMode).toBe('overlay')
    expect(surface.listeningState()).toBe('listening')
    expect(surface.pitchState()).toBe('low')
    expect(surface.targetMode()).toBe('auto')
    expect(surface.targetStringId()).toBe('string-4')
    expect(surface.cents()).toBe(-9.47)
    expect(surface.inputLabel?.()).toBe('Room mic')
    expect(surface.tuningPresets?.()).toHaveLength(5)
    expect(surface.recoveryActionLabel?.()).toBe('Use it here')

    harness.setOpening(true)
    expect(surface.listeningState()).toBe('starting')
    expect(surface.pitchState()).toBe('searching')
    harness.setOpening(false)
    harness.setReading(null)
    expect(surface.pitchState()).toBe('unsteady')
    setFrequency(null)
    expect(surface.pitchState()).toBe('searching')
    harness.setError('The microphone is held in another tab.')
    expect(surface.pitchState()).toBe('error')

    surface.onStartListening()
    surface.onStopListening()
    surface.onStartReference(surface.strings()[0])
    surface.onStopReference()
    surface.onInputProfileChange?.('interface')
    surface.onTuningPresetChange?.('Drop D')
    surface.onRecoveryAction?.()
    await Promise.resolve()
    expect(harness.controller.startListening).toHaveBeenCalledOnce()
    expect(harness.controller.stopListening).toHaveBeenCalledOnce()
    expect(harness.controller.playReference).toHaveBeenCalledWith(5)
    expect(harness.controller.stopReferenceTone).toHaveBeenCalledOnce()
    expect(harness.controller.selectInputProfile).toHaveBeenCalledWith(
      'interface',
    )
    expect(harness.controller.selectPreset).toHaveBeenCalledWith('Drop D')
    expect(recover).toHaveBeenCalledOnce()

    setShowPresets(false)
    expect(surface.tuningPresets?.()).toEqual([])
    surface.onBack()
    expect(harness.controller.close).toHaveBeenCalledOnce()
    expect(back).toHaveBeenCalledOnce()

    rendered.unmount()
    surface = currentSurface()
    expect(harness.controller.close).toHaveBeenCalledOnce()
  })
})
