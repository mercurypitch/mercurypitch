// The pill has two homes, and the menu has to open away from the nearer edge.
// ============================================================
//
// As a floating overlay the pill clears `--tabbar-total` and sits bottom-left.
// Guitar Night has no tab bar, so on the owner's iPhone the pill landed on top
// of the primary action — "Start count-in" — and made the intro lesson
// unusable. A host that has chrome of its own can dock it there instead.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceControlController } from './useVoiceControlController'
import { VoiceControlHud } from './VoiceControlHud'

afterEach(cleanup)

function createController(
  overrides: Partial<VoiceControlController> = {},
): VoiceControlController {
  return {
    isSupported: true,
    enabled: () => false,
    listenerState: () => 'idle',
    errorDetail: () => null,
    interim: () => '',
    feedback: () => null,
    lastLatencyMs: () => null,
    toggle: vi.fn(),
    turnOff: vi.fn(),
    ...overrides,
  } as VoiceControlController
}

describe('VoiceControlHud placement', () => {
  it('floats by default', () => {
    render(() => <VoiceControlHud controller={createController()} />)

    expect(screen.getByTestId('voice-control-pill')).toHaveAttribute(
      'data-placement',
      'floating',
    )
  })

  it('docks when a host places it in its own chrome', () => {
    render(() => (
      <VoiceControlHud controller={createController()} placement="docked" />
    ))

    expect(screen.getByTestId('voice-control-pill')).toHaveAttribute(
      'data-placement',
      'docked',
    )
  })

  it('keeps the engine menu reachable from either home', () => {
    render(() => (
      <VoiceControlHud
        controller={createController({ enabled: () => true })}
        placement="docked"
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Voice engine and commands' }),
    )

    // Docking moves the pill to the top of the screen, so the menu that opens
    // upward for the floating pill has to open downward here. The variant
    // carries that; a bare class on the host would not.
    const pill = screen.getByTestId('voice-control-pill')
    expect(pill).toHaveAttribute('data-placement', 'docked')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})

// ============================================================
// The stopped pill can be acted on, and put away, from a phone
// ============================================================
//
// Enabled but not listening, the status read "press V twice" — a key a phone
// does not have, asked for twice because the first press only turned an
// already-silent listener off. Nothing else in the expanded pill closed it
// either, so on a phone it stayed pinned over the page's own controls.

describe('VoiceControlHud on a device with no keyboard', () => {
  it('asks for the mic rather than a key when the listener has stopped', () => {
    render(() => (
      <VoiceControlHud
        controller={createController({
          enabled: () => true,
          listenerState: () => 'idle',
        })}
      />
    ))

    const status = screen.getByTestId('voice-control-status')
    expect(status).toHaveTextContent(/tap the mic/i)
    // The specific regression: no instruction that needs a keyboard.
    expect(status.textContent ?? '').not.toMatch(/\bV\b/)
    expect(status.textContent ?? '').not.toMatch(/twice/i)
  })

  it('can be dismissed without touching the mic', () => {
    const turnOff = vi.fn()
    render(() => (
      <VoiceControlHud
        controller={createController({
          enabled: () => true,
          listenerState: () => 'idle',
          turnOff,
        })}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Turn voice control off' }),
    )

    // turnOff, not toggle: from a stopped listener `toggle` now restarts, so
    // wiring dismiss to it would have re-opened the mic instead of closing.
    expect(turnOff).toHaveBeenCalledTimes(1)
  })

  it('offers no dismiss while the pill is collapsed', () => {
    // Collapsed it is a single icon button, not something in the way.
    render(() => <VoiceControlHud controller={createController()} />)

    expect(
      screen.queryByRole('button', { name: 'Turn voice control off' }),
    ).toBeNull()
  })
})
