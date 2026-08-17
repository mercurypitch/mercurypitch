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
