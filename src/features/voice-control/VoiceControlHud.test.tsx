// The pill has two homes, and the menu has to open away from the nearer edge.
// ============================================================
//
// As a floating overlay the pill clears `--tabbar-total` and sits bottom-left.
// Guitar Night has no tab bar, so on the owner's iPhone the pill landed on top
// of the primary action — "Start count-in" — and made the intro lesson
// unusable. A host that has chrome of its own can dock it there instead.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceControlController } from './useVoiceControlController'
import { dockedMenuRightGap, VoiceControlHud } from './VoiceControlHud'

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

describe('the docked menu holds still', () => {
  it('keeps the pill the shape it had when the menu opened', () => {
    // Docked, an expanding pill takes the whole header row, which moves the
    // group the menu hangs off and slides the open menu sideways under the
    // finger. Reported as a settings popup that walks left as the pill
    // replaces the app title.
    const [talking, setTalking] = createSignal(false)
    render(() => (
      <VoiceControlHud
        placement="docked"
        controller={createController({
          enabled: () => true,
          hasSomethingToSay: talking,
        })}
      />
    ))
    const pill = screen.getByTestId('voice-control-pill')
    expect(pill).toHaveAttribute('data-talking', 'false')

    fireEvent.click(screen.getByLabelText('Voice engine and commands'))
    setTalking(true)

    expect(pill).toHaveAttribute('data-talking', 'false')

    // Closed again, the pill catches up with whatever the ear is doing.
    fireEvent.click(screen.getByLabelText('Voice engine and commands'))
    expect(pill).toHaveAttribute('data-talking', 'true')
  })

  it('places the menu against the viewport, not the moving pill', () => {
    render(() => (
      <VoiceControlHud
        placement="docked"
        controller={createController({ enabled: () => true })}
      />
    ))

    fireEvent.click(screen.getByLabelText('Voice engine and commands'))

    // The measurement the stylesheet positions against; jsdom reports 0 for
    // every rect, so the presence of the custom property is the contract.
    const menu = screen.getByRole('menu')
    expect(menu.style.getPropertyValue('--voice-menu-top')).toBe('0px')
    expect(menu.style.getPropertyValue('--voice-menu-right')).not.toBe('')
  })

  describe('dockedMenuRightGap', () => {
    // Reported on a tablet: "only in guitar night it seems to open on the
    // right side of screen instead of under the around middle positioned
    // voice command toggle". Guitar Night docks its pill mid-header, and the
    // menu was pinned to the viewport's right margin outright.
    it('opens under the cog when the pill sits mid-header', () => {
      expect(dockedMenuRightGap(800, 1440)).toBe(640)
    })

    it('keeps the phone margin when the pill spans the row', () => {
      // A docked pill on a phone reaches the right margin itself, so following
      // it and keeping the margin are the same answer.
      expect(dockedMenuRightGap(382, 390)).toBe(8)
      expect(dockedMenuRightGap(390, 390)).toBe(8)
    })

    it('never pushes its own left edge off the screen', () => {
      // A cog near the left edge would otherwise put the menu's 16rem body
      // past x = 0. 1440 - 256 - 8 is as far right as the gap may go.
      expect(dockedMenuRightGap(200, 1440)).toBe(1176)
    })

    it('falls back to the margin on a screen narrower than the menu', () => {
      // Below 16rem plus its margins there is no room to follow the cog at
      // all, so both clamps meet at the margin and `max-width` handles the
      // rest. Every cog position gives the same answer.
      expect(dockedMenuRightGap(100, 240)).toBe(8)
      expect(dockedMenuRightGap(238, 240)).toBe(8)
    })
  })
})

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

  it('does not expand for the engine menu', () => {
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

    // The menu overlays the page from its absolute position. Expanding the
    // docked pill instead hands it the header row — the title steps aside,
    // the account cluster moves — for a menu that needs none of it.
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByTestId('voice-control-pill')).toHaveAttribute(
      'data-talking',
      'false',
    )
    expect(screen.queryByTestId('voice-control-status')).toBeNull()
  })
})

// ============================================================
// The engine menu on a touch screen
// ============================================================
//
// `onMouseLeave` closed the menu for a pointer with a hover state. A finger
// has none, so on a phone the menu stayed up until something inside it was
// tapped — and the pill's status line, which only the open menu had shown,
// went with the pinning.

describe('VoiceControlHud engine menu on a touch screen', () => {
  const openMenu = () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Voice engine and commands' }),
    )
    expect(screen.getByRole('menu')).toBeInTheDocument()
  }

  it('closes on a tap outside it', () => {
    render(() => (
      <VoiceControlHud controller={createController({ enabled: () => true })} />
    ))
    openMenu()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('stays open for a tap inside it', () => {
    render(() => (
      <VoiceControlHud controller={createController({ enabled: () => true })} />
    ))
    openMenu()

    fireEvent.pointerDown(
      screen.getByRole('menuitemradio', { name: 'Browser' }),
    )

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('carries the status line the collapsed pill does not show', () => {
    render(() => (
      <VoiceControlHud
        controller={createController({
          enabled: () => true,
          listenerState: () => 'idle',
          suspendedForSinging: () => true,
          hasSomethingToSay: () => false,
        })}
      />
    ))
    expect(screen.queryByTestId('voice-control-status')).toBeNull()
    openMenu()

    expect(screen.getByTestId('voice-control-menu-status')).toHaveTextContent(
      'Voice paused while you sing',
    )
  })
})

// ============================================================
// The ear dozing between touches
// ============================================================
//
// After a stretch of silence the Web Speech listener stops respawning and
// waits for the next touch anywhere. Nothing is wrong, so the pill must not
// expand — on a phone that re-lays out the header — and must not pulse as if
// it were hearing; the tooltip says what a tap does.

describe('VoiceControlHud while the ear dozes', () => {
  it('rests without expanding, and says what a tap will do', () => {
    render(() => (
      <VoiceControlHud
        controller={createController({
          enabled: () => true,
          listenerState: () => 'dozing',
          hasSomethingToSay: () => false,
        })}
        placement="docked"
      />
    ))

    expect(screen.queryByTestId('voice-control-status')).toBeNull()
    expect(screen.getByTestId('voice-control-pill')).toHaveAttribute(
      'data-talking',
      'false',
    )
    const mic = screen.getByRole('button', { name: /tap to resume/i })
    expect(mic).toHaveAttribute('aria-pressed', 'true')
  })
})
