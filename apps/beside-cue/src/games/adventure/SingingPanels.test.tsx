// Singing panel contracts — one replay path, reactive note state and disclosed lesson controls.
import { fireEvent, render, screen, within } from '@solidjs/testing-library'
import type { ComponentProps } from 'solid-js'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { glassMelody } from '../../../../../packages/glass-game/src/content/melodies'
import { compileMelody } from '../../../../../packages/glass-game/src/core/melody-contour'
import { MelodyChallengePanel } from '../../../../../packages/glass-game/src/ui/MelodyChallengePanel'
import { VoiceChallengePanel } from '../../../../../packages/glass-game/src/ui/VoiceChallengePanel'

function voiceProps(): ComponentProps<typeof VoiceChallengePanel> {
  return {
    label: 'The first glass',
    mode: 'singing',
    message: 'Hold it gently.',
    hint: 'Sing or hum the note you hear.',
    target: 61,
    pitch: null,
    charge: 0,
    pair: false,
    steps: ['comfortable'],
    stepIndex: 0,
    onCancel: vi.fn(),
    onReplay: vi.fn(),
    onRefind: vi.fn(),
  }
}

function melodyProps(): ComponentProps<typeof MelodyChallengePanel> {
  return {
    label: 'The first melody',
    challengeKind: 'melody-anchor',
    mode: 'setup',
    message: 'Choose your key.',
    hint: 'Follow the ribbon in your own voice.',
    target: 58,
    pitch: null,
    charge: 0,
    contour: null,
    judge: null,
    timelineSeconds: 0,
    comfortableMidi: 60,
    rootMidi: 58,
    pace: 1.25,
    allowedPaces: [0.8, 1, 1.25],
    frozen: false,
    needsFreshAttempt: false,
    onBegin: vi.fn(),
    onHear: vi.fn(),
    onReplay: vi.fn(),
    onChangeKey: vi.fn(),
    onChangePace: vi.fn(),
    onStartFresh: vi.fn(),
    onCancel: vi.fn(),
  }
}

describe('held-note singing panel', () => {
  it('uses the central note as the single replay action and keeps target, detected pitch and resonance distinct', () => {
    const props = voiceProps()
    const [state, setState] = createSignal(props)
    render(() => <VoiceChallengePanel {...state()} />)
    const replay = screen.getByRole('button', { name: 'Hear example' })
    expect(
      within(replay).getByRole('img', { name: 'Target note: C♯4' }),
    ).toBeVisible()
    expect(replay).toHaveAccessibleDescription(
      'Hear the target again and restart this attempt.',
    )
    fireEvent.click(replay)
    expect(props.onReplay).toHaveBeenCalledTimes(1)
    setState({ ...props, pitch: 63, charge: 0.75 })
    expect(screen.getByText('You: E♭4')).toBeVisible()
    expect(
      screen.getByRole('progressbar', { name: 'Glass resonance' }),
    ).toHaveAttribute('aria-valuenow', '75')
    expect(
      within(replay).getByRole('img', { name: 'Target note: C♯4' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Change note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onRefind).toHaveBeenCalledTimes(1)
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })
  it.each(['permission', 'finding', 'reference', 'off'] as const)(
    'keeps the target visible but disables replay during %s',
    (mode) => {
      render(() => <VoiceChallengePanel {...voiceProps()} mode={mode} />)
      expect(
        screen.getByRole('button', { name: 'Hear example' }),
      ).toBeDisabled()
      expect(
        screen.getByRole('img', { name: 'Target note: C♯4' }),
      ).toBeVisible()
    },
  )
  it('disables an absent target and discloses help without replaying or cancelling', () => {
    const props = voiceProps()
    render(() => <VoiceChallengePanel {...props} target={null} />)
    expect(screen.getByRole('button', { name: 'Hear example' })).toBeDisabled()
    expect(screen.getByText(props.hint)).not.toBeVisible()
    const help = screen.getByRole('button', {
      name: 'Show singing instructions',
    })
    fireEvent.click(help)
    expect(help).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(props.hint)).toBeVisible()
    fireEvent.keyDown(help, { code: 'Escape' })
    expect(help).toHaveFocus()
    expect(help).toHaveAttribute('aria-expanded', 'false')
    expect(props.onReplay).not.toHaveBeenCalled()
    expect(props.onCancel).not.toHaveBeenCalled()
  })
  it('retains ordered pair and wave steps as the active step changes', () => {
    const [step, setStep] = createSignal(0)
    const [wave, setWave] = createSignal(false)
    render(() => (
      <VoiceChallengePanel
        {...voiceProps()}
        pair
        steps={['low', 'high']}
        stepIndex={step()}
        wave={wave()}
      />
    ))
    expect(
      within(screen.getByRole('list', { name: 'Note order' })).getByText(
        'Lower note',
      ),
    ).toHaveAttribute('aria-current', 'step')
    setStep(1)
    expect(screen.getByText('Higher note')).toHaveAttribute(
      'aria-current',
      'step',
    )
    setWave(true)
    expect(
      within(screen.getByRole('list', { name: 'Lesson steps' })).getByText(
        'Sway twice',
      ),
    ).toHaveAttribute('aria-current', 'step')
  })
})

describe('melody singing panel', () => {
  it('routes setup hearing and active replay through their existing callbacks', () => {
    const props = melodyProps()
    const [mode, setMode] = createSignal(props.mode)
    render(() => <MelodyChallengePanel {...props} mode={mode()} />)
    const hear = screen.getByRole('button', { name: 'Hear example' })
    fireEvent.click(hear)
    expect(props.onHear).toHaveBeenCalledTimes(1)
    expect(props.onReplay).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Start singing' }))
    expect(props.onBegin).toHaveBeenCalledTimes(1)
    setMode('reference')
    expect(hear).toBeDisabled()
    setMode('singing')
    fireEvent.click(hear)
    expect(props.onReplay).toHaveBeenCalledTimes(1)
    expect(props.onHear).toHaveBeenCalledTimes(1)
  })
  it('keeps key and pace available through disclosure, with frozen pace and fresh-attempt behavior intact', () => {
    const props = melodyProps()
    const [frozen, setFrozen] = createSignal(false)
    const [fresh, setFresh] = createSignal(false)
    render(() => (
      <MelodyChallengePanel
        {...props}
        frozen={frozen()}
        needsFreshAttempt={fresh()}
      />
    ))
    const details = screen.getByText('Key and pace').closest('details')!
    fireEvent.click(screen.getByText('Key and pace'))
    expect(details).toHaveAttribute('open')
    fireEvent.click(screen.getByRole('radio', { name: 'Brisk' }))
    expect(props.onChangePace).toHaveBeenCalledWith(0.8)
    setFrozen(true)
    expect(screen.getByRole('radio', { name: 'Natural' })).toBeDisabled()
    setFresh(true)
    expect(screen.queryByRole('button', { name: 'Start singing' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Hear example' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }))
    expect(props.onStartFresh).toHaveBeenCalledTimes(1)
  })
  it('keeps the contour visible with independent help, replay and change controls', () => {
    const props = melodyProps()
    render(() => (
      <MelodyChallengePanel
        {...props}
        challengeKind="melody-contour"
        mode="singing"
        contour={compileMelody(glassMelody('first-arc'), { rootMidi: 60 })}
      />
    ))
    expect(screen.getByRole('img', { name: /Melody ribbon/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Hear example' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change key' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Show singing instructions' }),
    )
    expect(screen.getByText(props.hint)).toBeVisible()
    expect(props.onReplay).toHaveBeenCalledTimes(1)
    expect(props.onChangeKey).toHaveBeenCalledTimes(1)
    expect(props.onHear).not.toHaveBeenCalled()
  })
})
