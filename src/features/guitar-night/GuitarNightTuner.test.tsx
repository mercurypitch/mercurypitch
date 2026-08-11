// Guitar Night tuner tests protect explicit side effects and truthful tuning feedback.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNightTunerInputProfile, GuitarNightTunerListeningState, GuitarNightTunerPitchState, GuitarNightTunerPreset, GuitarNightTunerString, GuitarNightTunerSurfaceMode, GuitarNightTunerTargetMode, } from './GuitarNightTuner'
import { clampTunerCents, GuitarNightTuner } from './GuitarNightTuner'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const STANDARD_STRINGS: readonly GuitarNightTunerString[] = [
  { id: 'e2', stringNumber: 6, noteName: 'E', octave: 2, frequencyHz: 82.41 },
  { id: 'a2', stringNumber: 5, noteName: 'A', octave: 2, frequencyHz: 110 },
  { id: 'd3', stringNumber: 4, noteName: 'D', octave: 3, frequencyHz: 146.83 },
  { id: 'g3', stringNumber: 3, noteName: 'G', octave: 3, frequencyHz: 196 },
  { id: 'b3', stringNumber: 2, noteName: 'B', octave: 3, frequencyHz: 246.94 },
  { id: 'e4', stringNumber: 1, noteName: 'E', octave: 4, frequencyHz: 329.63 },
]

function TunerHarness(props: {
  onBack?: () => void
  onStartReference?: (target: GuitarNightTunerString) => void
  surfaceMode?: GuitarNightTunerSurfaceMode
  readyStringIds?: readonly string[]
  pitchState?: GuitarNightTunerPitchState
  pitchStateAccessor?: () => GuitarNightTunerPitchState
  statusDetail?: string
  recoveryActionLabel?: string
  onRecoveryAction?: () => void
}) {
  const [targetMode, setTargetMode] =
    createSignal<GuitarNightTunerTargetMode>('auto')
  const [targetStringId, setTargetStringId] = createSignal<string | null>(null)
  const [listeningState, setListeningState] =
    createSignal<GuitarNightTunerListeningState>('idle')
  const [referenceStringId, setReferenceStringId] = createSignal<string | null>(
    null,
  )

  return (
    <GuitarNightTuner
      surfaceMode={props.surfaceMode}
      instrumentLabel={() => '6-string guitar'}
      tuningLabel={() => 'Standard'}
      inputLabel={() => 'Room mic'}
      strings={() => STANDARD_STRINGS}
      targetMode={targetMode}
      targetStringId={targetStringId}
      listeningState={listeningState}
      pitchState={() =>
        props.pitchStateAccessor?.() ??
        props.pitchState ??
        (listeningState() === 'idle' ? 'idle' : 'searching')
      }
      detectedNoteLabel={() => null}
      detectedFrequencyHz={() => null}
      cents={() => null}
      statusDetail={() => props.statusDetail ?? null}
      referenceStringId={referenceStringId}
      readyStringIds={() => props.readyStringIds ?? []}
      recoveryActionLabel={() => props.recoveryActionLabel ?? null}
      autoFocusHeading={false}
      onBack={() => props.onBack?.()}
      onTargetModeChange={setTargetMode}
      onTargetStringChange={setTargetStringId}
      onStartListening={() => setListeningState('listening')}
      onStopListening={() => setListeningState('idle')}
      onStartReference={(target) => {
        props.onStartReference?.(target)
        setReferenceStringId(target.id)
      }}
      onStopReference={() => setReferenceStringId(null)}
      onRecoveryAction={() => props.onRecoveryAction?.()}
    />
  )
}

const TUNING_PRESETS: readonly GuitarNightTunerPreset[] = [
  { id: 'standard', label: 'Standard', detail: 'E A D G B E' },
  { id: 'drop-d', label: 'Drop D', detail: 'D A D G B E' },
]

function TunerSetupHarness(props: {
  onInputProfileChange: (profile: GuitarNightTunerInputProfile) => void
  onTuningPresetChange: (presetId: string) => void
  initialInputProfile?: GuitarNightTunerInputProfile | null
}) {
  const initialInputProfile =
    props.initialInputProfile === undefined
      ? 'microphone'
      : props.initialInputProfile
  const [inputProfile, setInputProfile] =
    createSignal<GuitarNightTunerInputProfile | null>(initialInputProfile)
  const [activePreset, setActivePreset] = createSignal<string | null>(
    'standard',
  )

  return (
    <GuitarNightTuner
      instrumentLabel={() => '6-string guitar'}
      tuningLabel={() => 'Standard'}
      strings={() => STANDARD_STRINGS}
      targetMode={() => 'auto'}
      targetStringId={() => null}
      listeningState={() => 'idle'}
      pitchState={() => 'idle'}
      detectedNoteLabel={() => null}
      detectedFrequencyHz={() => null}
      cents={() => null}
      referenceStringId={() => null}
      readyStringIds={() => ['e2', 'a2']}
      inputProfile={inputProfile}
      tuningPresets={() => TUNING_PRESETS}
      activeTuningPreset={activePreset}
      autoFocusHeading={false}
      onBack={() => undefined}
      onTargetModeChange={() => undefined}
      onTargetStringChange={() => undefined}
      onStartListening={() => undefined}
      onStopListening={() => undefined}
      onStartReference={() => undefined}
      onStopReference={() => undefined}
      onInputProfileChange={(profile) => {
        props.onInputProfileChange(profile)
        setInputProfile(profile)
      }}
      onTuningPresetChange={(presetId) => {
        props.onTuningPresetChange(presetId)
        setActivePreset(presetId)
      }}
    />
  )
}

describe('GuitarNightTuner', () => {
  it('stays silent until listening or a reference is explicitly requested', () => {
    const startReference = vi.fn()

    render(() => <TunerHarness onStartReference={startReference} />)

    expect(startReference).not.toHaveBeenCalled()
    expect(screen.getByTestId('guitar-night-tuner')).toHaveAttribute(
      'data-surface-mode',
      'standalone',
    )
    expect(
      screen.getByRole('button', { name: 'Start listening' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', {
        name: 'Choose a string to hear its reference',
      }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }))
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }))
    expect(
      screen.getByRole('button', { name: 'Start listening' }),
    ).toBeEnabled()
  })

  it('turns a selected string into a manual target and controls its reference', () => {
    const startReference = vi.fn()

    render(() => <TunerHarness onStartReference={startReference} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'String 6, E2, 82.41 Hz' }),
    )

    expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'String 6, E2, 82.41 Hz' }),
    ).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Hear E2 reference' }))
    expect(startReference).toHaveBeenCalledWith(STANDARD_STRINGS[0])
    expect(
      screen.getByRole('button', { name: 'Stop E2 reference' }),
    ).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Stop E2 reference' }))
    expect(
      screen.getByRole('button', { name: 'Hear E2 reference' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('announces direction separately from exact professional evidence', () => {
    render(() => (
      <GuitarNightTuner
        instrumentLabel={() => '6-string guitar'}
        tuningLabel={() => 'Drop D'}
        strings={() => STANDARD_STRINGS}
        targetMode={() => 'manual'}
        targetStringId={() => 'e2'}
        listeningState={() => 'listening'}
        pitchState={() => 'low'}
        detectedNoteLabel={() => 'E2'}
        detectedFrequencyHz={() => 81.93}
        cents={() => -10.2}
        referenceStringId={() => null}
        autoFocusHeading={false}
        onBack={() => undefined}
        onTargetModeChange={() => undefined}
        onTargetStringChange={() => undefined}
        onStartListening={() => undefined}
        onStopListening={() => undefined}
        onStartReference={() => undefined}
        onStopReference={() => undefined}
      />
    ))

    expect(screen.getByRole('status')).toHaveTextContent('Pitch low')
    expect(screen.getByLabelText('Detected frequency')).toHaveTextContent(
      '81.93 Hz',
    )
    expect(screen.getByLabelText('Pitch offset in cents')).toHaveTextContent(
      '−10 cents',
    )
    expect(screen.getByRole('meter', { name: 'Pitch offset' })).toHaveAttribute(
      'aria-valuenow',
      '-10.2',
    )
    expect(screen.getByRole('meter', { name: 'Pitch offset' })).toHaveAttribute(
      'aria-valuetext',
      '−10 cents. Pitch low.',
    )
  })

  it('renders every target for an eight-string instrument', () => {
    const extendedStrings: readonly GuitarNightTunerString[] = [
      ...STANDARD_STRINGS,
      {
        id: 'b1',
        stringNumber: 7,
        noteName: 'B',
        octave: 1,
        frequencyHz: 61.74,
      },
      {
        id: 'f-sharp-1',
        stringNumber: 8,
        noteName: 'F#',
        octave: 1,
        frequencyHz: 46.25,
      },
    ]

    render(() => (
      <GuitarNightTuner
        instrumentLabel={() => '8-string guitar'}
        tuningLabel={() => 'Standard extended'}
        strings={() => extendedStrings}
        targetMode={() => 'auto'}
        targetStringId={() => null}
        listeningState={() => 'idle'}
        pitchState={() => 'idle'}
        detectedNoteLabel={() => null}
        detectedFrequencyHz={() => null}
        cents={() => null}
        referenceStringId={() => null}
        autoFocusHeading={false}
        onBack={() => undefined}
        onTargetModeChange={() => undefined}
        onTargetStringChange={() => undefined}
        onStartListening={() => undefined}
        onStopListening={() => undefined}
        onStartReference={() => undefined}
        onStopReference={() => undefined}
      />
    ))

    expect(
      screen.getByRole('group', { name: '8-string tuning targets' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'String 8, F#1, 46.25 Hz' }),
    ).toBeInTheDocument()
  })

  it('keeps the gauge inside its supported cent range', () => {
    expect(clampTunerCents(-88)).toBe(-50)
    expect(clampTunerCents(63)).toBe(50)
    expect(clampTunerCents(Number.NaN)).toBeNull()
    expect(clampTunerCents(null)).toBeNull()
  })

  it('returns through the explicit Back control', () => {
    const back = vi.fn()
    render(() => <TunerHarness onBack={back} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(back).toHaveBeenCalledOnce()
  })

  it('returns on Escape and removes the shortcut when unmounted', () => {
    const back = vi.fn()
    const mounted = render(() => <TunerHarness onBack={back} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(back).toHaveBeenCalledOnce()

    mounted.unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(back).toHaveBeenCalledOnce()
  })

  it('fills its containing stage and exposes dialog semantics in overlay mode', () => {
    render(() => <TunerHarness surfaceMode="overlay" />)

    const dialog = screen.getByRole('dialog', {
      name: 'Tune before the room.',
    })
    expect(dialog).toHaveAttribute('data-surface-mode', 'overlay')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('keeps keyboard focus inside the overlay dialog', () => {
    render(() => <TunerHarness surfaceMode="overlay" />)

    const back = screen.getByRole('button', { name: 'Back' })
    const listen = screen.getByRole('button', { name: 'Start listening' })

    listen.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(back).toHaveFocus()

    back.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(listen).toHaveFocus()
  })

  it('keeps the two audio routes explicit and callback-owned', () => {
    const changeInput = vi.fn()

    render(() => (
      <TunerSetupHarness
        onInputProfileChange={changeInput}
        onTuningPresetChange={() => undefined}
      />
    ))

    expect(screen.getByRole('button', { name: 'Room mic' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Plugged in' }))
    expect(changeInput).toHaveBeenCalledWith('interface')
    expect(screen.getByRole('button', { name: 'Plugged in' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('leaves both physical input profiles unselected for another input route', () => {
    render(() => (
      <TunerSetupHarness
        initialInputProfile={null}
        onInputProfileChange={() => undefined}
        onTuningPresetChange={() => undefined}
      />
    ))

    expect(screen.getByRole('button', { name: 'Room mic' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Plugged in' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('marks completed strings and keeps tuning presets in a disclosure', async () => {
    const changePreset = vi.fn()

    render(() => (
      <TunerSetupHarness
        onInputProfileChange={() => undefined}
        onTuningPresetChange={changePreset}
      />
    ))

    const readyTarget = screen.getByRole('button', {
      name: 'String 6, E2, 82.41 Hz, ready',
    })
    expect(readyTarget).toHaveAttribute('data-ready', 'true')
    expect(readyTarget.querySelector('svg')).not.toBeNull()

    const disclosure = screen.getByLabelText('Tuning presets, Standard')
    fireEvent.click(disclosure)
    expect(disclosure.parentElement).toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: /Drop D/ }))
    await Promise.resolve()

    expect(changePreset).toHaveBeenCalledWith('drop-d')
    expect(disclosure.parentElement).not.toHaveAttribute('open')
    expect(screen.getByLabelText('Tuning presets, Drop D')).toBeInTheDocument()
    expect(disclosure).toHaveFocus()
  })

  it('does not expose an automatic target as a pressed manual choice', () => {
    render(() => (
      <GuitarNightTuner
        instrumentLabel={() => '6-string guitar'}
        tuningLabel={() => 'Standard'}
        strings={() => STANDARD_STRINGS}
        targetMode={() => 'auto'}
        targetStringId={() => 'e2'}
        listeningState={() => 'listening'}
        pitchState={() => 'in-tune'}
        detectedNoteLabel={() => 'E2'}
        detectedFrequencyHz={() => 82.41}
        cents={() => 0}
        referenceStringId={() => null}
        autoFocusHeading={false}
        onBack={() => undefined}
        onTargetModeChange={() => undefined}
        onTargetStringChange={() => undefined}
        onStartListening={() => undefined}
        onStopListening={() => undefined}
        onStartReference={() => undefined}
        onStopReference={() => undefined}
      />
    ))

    expect(
      screen.getByRole('button', { name: 'String 6, E2, 82.41 Hz' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('announces only a pitch direction that remains stable', () => {
    vi.useFakeTimers()
    const [pitchState, setPitchState] =
      createSignal<GuitarNightTunerPitchState>('idle')
    render(() => <TunerHarness pitchStateAccessor={pitchState} />)

    const liveStatus = screen.getAllByRole('status').at(-1)
    expect(liveStatus).toHaveTextContent('Ready to tune')

    setPitchState('low')
    vi.advanceTimersByTime(200)
    setPitchState('high')
    vi.advanceTimersByTime(200)
    expect(liveStatus).toHaveTextContent('Ready to tune')

    setPitchState('low')
    vi.advanceTimersByTime(420)
    expect(liveStatus).toHaveTextContent('Pitch low')
  })

  it('keeps one compact recovery action beside an input error', () => {
    const recover = vi.fn()
    render(() => (
      <TunerHarness
        pitchState="error"
        statusDetail="This input is already being used in another tab."
        recoveryActionLabel="Use it here"
        onRecoveryAction={recover}
      />
    ))

    expect(screen.getByRole('alert')).toHaveTextContent('Listening unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Use it here' }))
    expect(recover).toHaveBeenCalledOnce()
  })
})
