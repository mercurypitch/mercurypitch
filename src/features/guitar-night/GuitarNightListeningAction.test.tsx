// Both room Sessions expose the same explicit start, stop and cancel action.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightListeningAction } from './GuitarNightListeningAction'
import type { GuitarListeningStatus } from './useGuitarListeningController'

afterEach(cleanup)

describe('GuitarNightListeningAction', () => {
  it.each<[GuitarListeningStatus, boolean, string]>([
    ['off', false, 'Turn on Listening'],
    ['listening', true, 'Stop Listening'],
    ['requesting', true, 'Cancel opening input'],
    ['calibrating', true, 'Stop calibration'],
  ])(
    'keeps %s actionable without changing route configuration',
    (status, listening, label) => {
      const toggle = vi.fn()
      render(() => (
        <GuitarNightListeningAction
          status={status}
          listening={listening}
          onToggle={toggle}
        />
      ))
      const action = screen.getByRole('button', { name: label })
      expect(action).toBeEnabled()
      expect(action).toHaveAttribute('aria-pressed', String(listening))
      fireEvent.click(action)
      expect(toggle).toHaveBeenCalledOnce()
    },
  )

  it('prevents a second start while configuration is pending', () => {
    const toggle = vi.fn()
    render(() => (
      <GuitarNightListeningAction
        status="off"
        listening={false}
        disabled
        onToggle={toggle}
      />
    ))
    expect(
      screen.getByRole('button', { name: 'Turn on Listening' }),
    ).toBeDisabled()
  })

  it.each(['requesting', 'listening', 'calibrating'] as const)(
    'does not disable cancellation while %s',
    (status) => {
      render(() => (
        <GuitarNightListeningAction
          status={status}
          listening
          disabled
          onToggle={vi.fn()}
        />
      ))
      expect(screen.getByRole('button')).toBeEnabled()
    },
  )
})
