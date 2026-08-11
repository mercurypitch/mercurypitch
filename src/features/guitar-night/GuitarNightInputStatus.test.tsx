// Guitar Night input status tests protect live feedback and one-action recovery.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightInputError } from './GuitarNightInputError'
import { GuitarNightInputHealth } from './GuitarNightInputHealth'

afterEach(() => cleanup())

describe('GuitarNightInputHealth', () => {
  it('announces usable input health politely', () => {
    render(() => (
      <GuitarNightInputHealth
        profile={() => 'microphone'}
        listening={() => true}
        calibrating={() => false}
        health={() => ({
          state: 'good',
          hint: 'Signal is clear.',
          inputLevel: 0.42,
          clipping: false,
          confidence: 0.91,
        })}
        timingSource={() => 'audio-clock'}
        latencyMs={() => 18}
        onCalibrate={() => undefined}
      />
    ))

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Signal is clear.')
    expect(
      screen.getByRole('button', { name: 'Calibrate timing' }),
    ).toBeEnabled()
  })

  it('announces clipping immediately', () => {
    render(() => (
      <GuitarNightInputHealth
        profile={() => 'interface'}
        listening={() => true}
        calibrating={() => false}
        health={() => ({
          state: 'clipping',
          hint: 'Input is clipping.',
          inputLevel: 1,
          clipping: true,
          confidence: 0.8,
        })}
        timingSource={() => 'audio-clock'}
        latencyMs={() => 0}
        onCalibrate={() => undefined}
      />
    ))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(alert).toHaveTextContent('Input is clipping.')
  })
})

describe('GuitarNightInputError', () => {
  it('offers a single takeover action when another tab owns the input', () => {
    const takeOver = vi.fn()

    render(() => (
      <GuitarNightInputError
        message={() => 'This input is already being used in another tab.'}
        canTakeOver={() => true}
        takeoverPending={() => false}
        onTakeOver={takeOver}
      />
    ))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This input is already being used in another tab.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Use it here' }))
    expect(takeOver).toHaveBeenCalledOnce()
  })

  it('does not suggest takeover for an unrecoverable input error', () => {
    render(() => (
      <GuitarNightInputError
        message={() => 'The selected input disconnected.'}
        canTakeOver={() => false}
        takeoverPending={() => false}
        onTakeOver={() => undefined}
      />
    ))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The selected input disconnected.',
    )
    expect(
      screen.queryByRole('button', { name: 'Use it here' }),
    ).not.toBeInTheDocument()
  })

  it('disables the recovery action while ownership is moving', () => {
    render(() => (
      <GuitarNightInputError
        message={() => 'This input is already being used in another tab.'}
        canTakeOver={() => true}
        takeoverPending={() => true}
        onTakeOver={() => undefined}
      />
    ))

    const button = screen.getByRole('button', { name: 'Moving input' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})
