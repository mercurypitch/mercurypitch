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
    // The real rule lives in voice-hud-presence and is tested there. Here it
    // is a dial: the pill's job is to lay out around it, not to derive it.
    // `idle` is a talking state — it has a sentence and a way out — so the
    // default matches the default listener state above.
    hasSomethingToSay: () => true,
    suspendedForSinging: () => false,
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

describe('VoiceControlHud while the stage mic has the audio', () => {
  it('names the pause instead of asking for a tap that does nothing', () => {
    // The suspension sets the listener to `idle`, and `idle` otherwise means
    // the listener died under us and needs restarting. Here nothing is wrong,
    // the mic is being held off on purpose, and it comes back by itself.
    render(() => (
      <VoiceControlHud
        controller={createController({
          enabled: () => true,
          listenerState: () => 'idle',
          suspendedForSinging: () => true,
        })}
      />
    ))

    expect(screen.getByTestId('voice-control-status')).toHaveTextContent(
      'Voice paused while you sing',
    )
  })
})

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

// ============================================================
// Between phrases the pill is a mic and a cog
// ============================================================
//
// Expanded, this is a wide bar. Docked in a phone's header it ran straight
// across "MercuryPitch" and stayed there for the whole session — for the one
// second in ten that it had words, and the nine that it did not.

describe('VoiceControlHud when there is nothing to say', () => {
  it('keeps the mic and the engine cog, and drops the rest', () => {
    render(() => (
      <VoiceControlHud
        controller={createController({
          enabled: () => true,
          listenerState: () => 'listening',
          hasSomethingToSay: () => false,
        })}
        placement="docked"
      />
    ))

    expect(
      screen.getByRole('button', { name: 'Voice engine and commands' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /voice control o/i }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('voice-control-status')).toBeNull()
    expect(screen.getByTestId('voice-control-pill')).toHaveAttribute(
      'data-talking',
      'false',
    )
  })

  it('shows the words again as soon as there are any', () => {
    render(() => (
      <VoiceControlHud
        controller={createController({
          enabled: () => true,
          listenerState: () => 'listening',
          interim: () => 'go to karaoke night',
          hasSomethingToSay: () => true,
        })}
        placement="docked"
      />
    ))

    expect(screen.getByTestId('voice-control-status')).toHaveTextContent(
      'go to karaoke night',
    )
    expect(screen.getByTestId('voice-control-pill')).toHaveAttribute(
      'data-talking',
      'true',
    )
  })

  it('stays open while the engine menu is', () => {
    render(() => (
      <VoiceControlHud
        controller={createController({
          enabled: () => true,
          listenerState: () => 'listening',
          hasSomethingToSay: () => false,
        })}
        placement="docked"
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Voice engine and commands' }),
    )

    // A picker that closed itself three seconds after it was opened would be
    // unusable, so the menu pins the pill open for as long as it is up.
    expect(screen.getByTestId('voice-control-pill')).toHaveAttribute(
      'data-talking',
      'true',
    )
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})
