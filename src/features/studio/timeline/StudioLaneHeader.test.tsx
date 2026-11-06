// Studio lane header pieces — the lane's instrument chip says what the lane plays (its pick, else its name and role) on its family's hue, and the arm button arms, moves and disarms through the recorder.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { StudioRecordPhase } from '@/lib/studio/record/studio-recorder'
import { StudioArmButton, StudioLaneInstrument } from './StudioLaneHeader'

describe('Studio lane instrument', () => {
  it('names what a lane’s name says it plays, on its family’s hue', () => {
    render(() => (
      <StudioLaneInstrument
        track={{ name: 'Kick_In', role: 'other' }}
        size={28}
      />
    ))

    const chip = screen.getByRole('img', { name: 'Kick drum' })
    expect(chip.querySelector('svg')).toHaveAttribute('data-instrument', 'kick')
    expect(chip.style.getPropertyValue('--chip-hue')).toBe(
      'var(--studio-hue-violet)',
    )
  })

  it('draws the instrument the singer picked, and follows a change of it', () => {
    const [instrument, setInstrument] = createSignal<string | undefined>(
      'trumpet',
    )
    render(() => (
      <StudioLaneInstrument
        track={{ instrument: instrument(), name: 'Vox', role: 'voice' }}
        size={32}
      />
    ))
    expect(screen.getByRole('img', { name: 'Trumpet' })).toBeInTheDocument()

    setInstrument(undefined)

    expect(screen.getByRole('img', { name: 'Vocal' })).toHaveAttribute(
      'title',
      'Vocal',
    )
  })

  it('goes neutral on a silent lane, and stands bare where a phone has no room for a chip', () => {
    render(() => (
      <>
        <StudioLaneInstrument
          track={{ name: 'Bass DI', role: 'bass' }}
          size={28}
          silent
        />
        <StudioLaneInstrument
          track={{ name: 'Bass DI', role: 'bass' }}
          size="bare"
        />
      </>
    ))
    const [chip, bare] = screen.getAllByRole('img', { name: 'Bass guitar' })

    expect(chip).toHaveAttribute('data-silent', '')
    expect(bare).not.toHaveAttribute('data-silent')
    expect(bare.querySelector('svg')).toHaveAttribute('data-size', '16')
    expect(bare.style.getPropertyValue('--chip-hue')).toBe('')
  })
})

function arming(start: { phase: StudioRecordPhase; armed: string | null }) {
  const [phase, setPhase] = createSignal(start.phase)
  const [armed, setArmed] = createSignal(start.armed)
  const [canArm, setCanArm] = createSignal(true)
  const toggle = vi.fn()
  return {
    handle: {
      armedTrackId: armed,
      phase,
      canArm,
      toggle,
    },
    setPhase,
    setArmed,
    setCanArm,
    toggle,
  }
}

describe('Studio arm button', () => {
  it('arms its lane through the recorder, and says so', () => {
    const lanes = arming({ phase: 'idle', armed: null })
    render(() => (
      <StudioArmButton trackId="lane-1" name="Vocals" arming={lanes.handle} />
    ))
    const button = screen.getByRole('button', {
      name: 'Arm Vocals for recording',
    })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('title', 'Arm Vocals for recording')

    fireEvent.click(button)

    expect(lanes.toggle).toHaveBeenCalledExactlyOnceWith('lane-1')
  })

  it('lights while its lane is armed and stays lit, held, while the take records', () => {
    const lanes = arming({ phase: 'armed', armed: 'lane-1' })
    render(() => (
      <>
        <StudioArmButton trackId="lane-1" name="Vocals" arming={lanes.handle} />
        <StudioArmButton trackId="lane-2" name="Bass" arming={lanes.handle} />
      </>
    ))
    const vocals = screen.getByRole('button', { name: /Vocals/ })
    const bass = screen.getByRole('button', { name: /Bass/ })
    expect(vocals).toHaveAttribute('aria-pressed', 'true')
    expect(vocals.title).toBe(
      'Vocals is armed. Record (R) starts a take here. Press to disarm.',
    )
    expect(bass).toHaveAttribute('aria-pressed', 'false')
    expect(bass).toBeEnabled()

    lanes.setPhase('recording')

    expect(vocals).toHaveAttribute('aria-pressed', 'true')
    expect(vocals).toHaveAttribute('data-phase', 'recording')
    expect(vocals).toBeDisabled()
    expect(bass).toBeDisabled()
    expect(bass.title).toBe('Stop the take to arm another lane')
  })

  it('says its word beside the dot in a lane’s details, keeping its name', () => {
    const lanes = arming({ phase: 'idle', armed: null })
    render(() => (
      <StudioArmButton
        trackId="lane-1"
        name="Vocals"
        arming={lanes.handle}
        caption="Arm"
        touch
      />
    ))

    const button = screen.getByRole('button', {
      name: 'Arm Vocals for recording',
    })
    expect(button).toHaveTextContent('Arm')
    fireEvent.click(button)
    expect(lanes.toggle).toHaveBeenCalledExactlyOnceWith('lane-1')
  })

  it('waits while the song cannot take a recording, unless its lane is the armed one', () => {
    const lanes = arming({ phase: 'idle', armed: null })
    lanes.setCanArm(false)
    render(() => (
      <StudioArmButton trackId="lane-1" name="Vocals" arming={lanes.handle} />
    ))
    const button = screen.getByRole('button', { name: /Vocals/ })
    expect(button).toBeDisabled()

    lanes.setPhase('armed')
    lanes.setArmed('lane-1')

    expect(button).toBeEnabled()
  })
})
