// ============================================================
// Drum Play-Along Stage tests — playable-kit semantics and prepared-audio truth
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DrumPlayAlongStage } from './DrumPlayAlongStage'

afterEach(cleanup)

function dispatchPointerDown(
  target: Element,
  init: {
    readonly button: number
    readonly isPrimary: boolean
    readonly pressure: number
  },
): void {
  const event = new Event('pointerdown', { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    button: { value: init.button },
    isPrimary: { value: init.isPrimary },
    pressure: { value: init.pressure },
  })
  fireEvent(target, event)
}

describe('DrumPlayAlongStage', () => {
  it('keeps six semantic strike surfaces in separated-audio Pocket view', () => {
    const onStrike = vi.fn()
    render(() => (
      <DrumPlayAlongStage
        title="Night Drive"
        mixKind="separated"
        view="pocket"
        positionSeconds={67}
        durationSeconds={184}
        recentPadId="snare"
        onStrike={onStrike}
      />
    ))

    expect(screen.getByRole('heading', { name: 'Night Drive' })).toBeVisible()
    expect(screen.getByText('Drums separated')).toBeVisible()
    expect(
      screen.getByText('Source Drums and Backing are independent audio.'),
    ).toBeVisible()
    expect(
      screen.getByRole('group', { name: 'Pocket playable drum kit' }),
    ).toBeVisible()
    expect(screen.getAllByRole('button')).toHaveLength(6)
    expect(screen.getByLabelText('Backing position')).toHaveTextContent(
      '1:07/ 3:04',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Play Snare drum' }))
    expect(onStrike).toHaveBeenCalledWith('snare', 100)
    expect(
      screen.getByRole('button', { name: 'Play Snare drum' }),
    ).toHaveAttribute('data-active', 'true')
  })

  it('keeps Seat playable without claiming authored target evidence', () => {
    const onStrike = vi.fn()
    render(() => (
      <DrumPlayAlongStage
        title="Live Room"
        mixKind="two-stem"
        view="seat"
        onStrike={onStrike}
      />
    ))

    const ride = screen.getByRole('button', { name: 'Play Ride cymbal' })
    dispatchPointerDown(ride, {
      button: 0,
      isPrimary: true,
      pressure: 0.5,
    })
    expect(onStrike).toHaveBeenCalledWith('ride', 88)
    expect(screen.queryByText(/authored target now/i)).not.toBeInTheDocument()
  })

  it('uses Score for explicit audio-only truth and authored-source recovery', () => {
    const onOpenAuthoredScore = vi.fn()
    render(() => (
      <DrumPlayAlongStage
        title="Night Drive"
        mixKind="two-stem"
        view="score"
        onOpenAuthoredScore={onOpenAuthoredScore}
      />
    ))

    expect(screen.getByText('Drums in backing')).toBeVisible()
    expect(screen.getByText(/drums remain inside Backing/i)).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'No drum score was created' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('group', { name: /playable drum kit/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Open MIDI or Guitar Pro' }),
    )
    expect(onOpenAuthoredScore).toHaveBeenCalledOnce()
  })
})
