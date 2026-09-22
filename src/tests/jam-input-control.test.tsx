// ── Jam input control tests ──────────────────────────────────────────
// This control decides what a room transmits, and one of its two choices
// turns echo cancellation off. So the cases that matter are the ones where
// a wrong press is expensive: the label naming the wrong hardware, the
// choice being hidden, and the combination that howls going unremarked --
// an unprocessed default input, which is a built-in microphone, while
// speakers are playing the room back.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JamAudioProfile } from '@/lib/jam/jam-audio-source'

const room = vi.hoisted(() => ({
  profile: 'voice' as JamAudioProfile,
  muted: true,
  deviceId: null as string | null,
  label: null as string | null,
  devices: [] as { deviceId: string; label: string; isLoopback: boolean }[],
  toggled: 0,
  switched: 0,
  confirmed: true,
}))

vi.mock('@/stores/jam-store', () => ({
  jamAudioProfile: () => room.profile,
  jamIsMuted: () => room.muted,
  jamInputDeviceId: () => room.deviceId,
  jamInputDevices: () => room.devices,
  setJamAudioProfile: (p: JamAudioProfile) => {
    room.profile = p
  },
  setJamInputDeviceId: (id: string | null) => {
    room.deviceId = id
  },
  setJamInputDeviceLabel: (l: string | null) => {
    room.label = l
  },
  refreshJamInputDevices: async () => {},
  switchJamAudioSource: async () => {
    room.switched += 1
  },
  toggleJamMute: async () => {
    room.toggled += 1
  },
  jamSourceConfirmed: () => room.confirmed,
  setJamSourceConfirmed: (v: boolean) => {
    room.confirmed = v
  },
}))

const { JamInputControl, menuPosition } =
  await import('@/components/jam/JamInputControl')

afterEach(() => {
  cleanup()
  room.profile = 'voice'
  room.muted = true
  room.deviceId = null
  room.label = null
  room.devices = []
  room.toggled = 0
  room.switched = 0
  room.confirmed = true
})

const openMenu = () => {
  fireEvent.click(screen.getByLabelText('Choose what you are sending'))
}

describe('what the button says it will send', () => {
  it('does not call a DI a microphone', () => {
    // The complaint that produced this control: a guitarist with an
    // interface was told to turn their microphone on, and nothing was
    // being captured from a microphone.
    room.profile = 'instrument'
    render(() => <JamInputControl />)
    const send = screen.getByRole('button', { name: /start sending/i })
    expect(send.getAttribute('aria-label')).toContain('instrument')
    expect(send.getAttribute('aria-label')?.toLowerCase()).not.toContain('mic')
  })

  it('says what it is sending, not just that it is on', () => {
    room.profile = 'voice'
    room.muted = false
    render(() => <JamInputControl />)
    expect(screen.getByTestId('jam-send').getAttribute('aria-label')).toContain(
      'Currently sending voice',
    )
  })

  it('still transmits on the press people already aim at', () => {
    render(() => <JamInputControl />)
    fireEvent.click(screen.getByRole('button', { name: /start sending/i }))
    expect(room.toggled).toBe(1)
  })
})

describe('choosing the source', () => {
  it('offers both, with the sentence that makes them choosable', () => {
    render(() => <JamInputControl />)
    openMenu()
    // "Voice" and "Instrument" alone do not tell you which one feeds back,
    // and the sentences are only useful attached to the right option.
    expect(
      screen.getByRole('menuitemradio', { name: /Voice/i }).textContent,
    ).toContain('Safe with speakers')
    expect(
      screen.getByRole('menuitemradio', { name: /Instrument/i }).textContent,
    ).toContain('the room hears itself')
  })

  it('switches the live capture when the choice changes', () => {
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Instrument/i }))
    expect(room.profile).toBe('instrument')
    // A choice that did not re-capture would be a choice that did nothing.
    expect(room.switched).toBe(1)
  })

  it('does not re-capture when the same choice is pressed again', () => {
    // A re-capture costs an audible gap, so a no-op press must stay a no-op.
    room.profile = 'instrument'
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Instrument/i }))
    expect(room.switched).toBe(0)
  })

  it('opens from the main button too, by right click', () => {
    render(() => <JamInputControl />)
    fireEvent.contextMenu(
      screen.getByRole('button', { name: /start sending/i }),
    )
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
  })

  it('marks which one is live', () => {
    room.profile = 'instrument'
    render(() => <JamInputControl />)
    openMenu()
    expect(
      screen
        .getByRole('menuitemradio', { name: /Instrument/i })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen
        .getByRole('menuitemradio', { name: /Voice/i })
        .getAttribute('aria-checked'),
    ).toBe('false')
  })
})

describe('the combination that howls', () => {
  it('warns when an unprocessed default input is live', () => {
    // Instrument turns echo cancellation off; the default input on a
    // laptop is its built-in microphone. Together, with speakers, the
    // room hears itself -- which is exactly the state somebody testing
    // with a second device beside them lands in.
    room.profile = 'instrument'
    room.muted = false
    room.deviceId = null
    render(() => <JamInputControl />)
    openMenu()
    expect(screen.getByText(/will\s+feed\s+back/i).textContent).toContain(
      'built-in microphone',
    )
  })

  it('stays quiet once a real interface is chosen', () => {
    // A DI'd guitar through a named interface is the case this profile
    // exists for. Warning there would train people to ignore it.
    room.profile = 'instrument'
    room.muted = false
    room.deviceId = 'scarlett'
    render(() => <JamInputControl />)
    openMenu()
    expect(screen.queryByText(/will\s+feed\s+back/i)).toBeNull()
  })

  it('stays quiet while nothing is being sent', () => {
    // Muted is not dangerous, whatever is selected.
    room.profile = 'instrument'
    room.muted = true
    room.deviceId = null
    render(() => <JamInputControl />)
    openMenu()
    expect(screen.queryByText(/will\s+feed\s+back/i)).toBeNull()
  })

  it('stays quiet on voice, which is cancelled', () => {
    room.profile = 'voice'
    room.muted = false
    room.deviceId = null
    render(() => <JamInputControl />)
    openMenu()
    expect(screen.queryByText(/will\s+feed\s+back/i)).toBeNull()
  })
})

describe('the first press asks before it puts you on air', () => {
  it('opens the chooser instead of transmitting', () => {
    // Sending the wrong source is not a small mistake: `instrument` has
    // no echo cancellation, so a wrong first press with speakers on is a
    // feedback loop in a room with other people in it.
    room.confirmed = false
    render(() => <JamInputControl />)
    fireEvent.click(screen.getByRole('button', { name: /start sending/i }))
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
    expect(room.toggled).toBe(0)
  })

  it('goes live once the source is chosen, honouring the press', () => {
    room.confirmed = false
    render(() => <JamInputControl />)
    fireEvent.click(screen.getByRole('button', { name: /start sending/i }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Instrument/i }))
    expect(room.profile).toBe('instrument')
    expect(room.toggled).toBe(1)
    expect(room.confirmed).toBe(true)
  })

  it('does not ask twice', () => {
    room.confirmed = true
    render(() => <JamInputControl />)
    fireEvent.click(screen.getByRole('button', { name: /start sending/i }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(room.toggled).toBe(1)
  })

  it('does not go live when the menu was opened just to look', () => {
    // Opened from the badge, not from the send button: choosing here is
    // changing a setting, not asking to be heard.
    room.confirmed = false
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Instrument/i }))
    expect(room.profile).toBe('instrument')
    expect(room.toggled).toBe(0)
  })

  it('drops the pending send when the chooser is dismissed', () => {
    // Pressing send, thinking better of it, and pressing Escape must not
    // leave an intent that fires on the next unrelated choice.
    room.confirmed = false
    render(() => <JamInputControl />)
    fireEvent.click(screen.getByRole('button', { name: /start sending/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Instrument/i }))
    expect(room.toggled).toBe(0)
  })

  it('drops the pending send when the chooser is shut from the badge', () => {
    // Every way out must disarm, not just Escape and a press elsewhere:
    // shut from the badge, the send press was left waiting and fired on
    // the next choice made just to look.
    room.confirmed = false
    render(() => <JamInputControl />)
    fireEvent.click(screen.getByRole('button', { name: /start sending/i }))
    openMenu() // the badge again: shuts it
    openMenu() // and opens it, just looking
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Instrument/i }))
    expect(room.profile).toBe('instrument')
    expect(room.toggled).toBe(0)
  })

  it('stops asking after a choice, even one that changed nothing', () => {
    room.confirmed = false
    room.profile = 'voice'
    render(() => <JamInputControl />)
    fireEvent.click(screen.getByRole('button', { name: /start sending/i }))
    // Picking the profile already selected is still a deliberate answer.
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Voice/i }))
    expect(room.confirmed).toBe(true)
    expect(room.switched).toBe(0)
    expect(room.toggled).toBe(1)
  })
})

describe('choosing the device', () => {
  it('remembers the id and the label, and re-captures', () => {
    // The label is the fallback key: a deviceId carries the PipeWire
    // profile suffix, so switching a Scarlett to Pro Audio changes it.
    room.devices = [
      { deviceId: 'scarlett', label: 'Scarlett 4i4', isLoopback: false },
    ]
    render(() => <JamInputControl />)
    openMenu()
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'scarlett' } })
    expect(room.deviceId).toBe('scarlett')
    expect(room.label).toBe('Scarlett 4i4')
    expect(room.switched).toBe(1)
  })

  it('goes back to the default input, clearing the remembered label', () => {
    room.devices = [
      { deviceId: 'scarlett', label: 'Scarlett 4i4', isLoopback: false },
    ]
    room.deviceId = 'scarlett'
    room.label = 'Scarlett 4i4'
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    expect(room.deviceId).toBeNull()
    // A stale label would resolve back to the device just abandoned.
    expect(room.label).toBeNull()
    expect(room.switched).toBe(1)
  })

  it('marks a loopback as playback, because picking one feeds the room back', () => {
    // PipeWire lists one capture device per OUTPUT. Sending it puts the
    // room's own sound back into the room.
    room.devices = [
      { deviceId: 'mon', label: 'Monitor of Built-in', isLoopback: true },
    ]
    render(() => <JamInputControl />)
    openMenu()
    expect(screen.getByRole('combobox').textContent).toContain('(playback)')
  })
})

describe('reaching the menu without a mouse', () => {
  it('opens on a long press, and does not transmit', () => {
    // Touch has no right click, and the caret badge is 15px. Holding is
    // the gesture people already know.
    vi.useFakeTimers()
    render(() => <JamInputControl />)
    const send = screen.getByRole('button', { name: /start sending/i })
    fireEvent.pointerDown(send)
    vi.advanceTimersByTime(500)
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
    // The click that follows a long press must not also toggle sending.
    fireEvent.click(send)
    expect(room.toggled).toBe(0)
    vi.useRealTimers()
  })

  it('leaves a short press alone', () => {
    vi.useFakeTimers()
    render(() => <JamInputControl />)
    const send = screen.getByRole('button', { name: /start sending/i })
    fireEvent.pointerDown(send)
    vi.advanceTimersByTime(120)
    fireEvent.pointerUp(send)
    vi.advanceTimersByTime(600)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(send)
    expect(room.toggled).toBe(1)
    vi.useRealTimers()
  })

  it('does not swallow the next press after a long press that ended elsewhere', () => {
    // A long press whose finger lifts off the button never produces the
    // click that consumes the suppression flag. Left set, it ate the next
    // real press -- a button that ignores every other tap.
    vi.useFakeTimers()
    render(() => <JamInputControl />)
    const send = screen.getByRole('button', { name: /start sending/i })
    fireEvent.pointerDown(send)
    vi.advanceTimersByTime(500)
    fireEvent.pointerLeave(send)
    fireEvent.keyDown(document, { key: 'Escape' })

    fireEvent.pointerDown(send)
    vi.advanceTimersByTime(50)
    fireEvent.pointerUp(send)
    fireEvent.click(send)
    expect(room.toggled).toBe(1)
    vi.useRealTimers()
  })

  it('keeps the menu a long press opened when a context menu follows it', () => {
    // Android sends a context menu after a long press; with a longer hold
    // delay set it lands after the timer has opened the menu, and toggled
    // it shut again.
    vi.useFakeTimers()
    render(() => <JamInputControl />)
    const send = screen.getByRole('button', { name: /start sending/i })
    fireEvent.pointerDown(send)
    vi.advanceTimersByTime(500)
    fireEvent.contextMenu(send)
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
    vi.useRealTimers()
  })

  it('opens once on a held right button, not open and then shut', () => {
    // Windows fires the context menu on release, so a held right button
    // opened the menu on the long-press timer and then shut it.
    vi.useFakeTimers()
    render(() => <JamInputControl />)
    const send = screen.getByRole('button', { name: /start sending/i })
    fireEvent.pointerDown(send, { button: 2 })
    vi.advanceTimersByTime(600)
    fireEvent.pointerUp(send, { button: 2 })
    fireEvent.contextMenu(send)
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
    vi.useRealTimers()
  })

  it('cancels when the finger slides off', () => {
    vi.useFakeTimers()
    render(() => <JamInputControl />)
    const send = screen.getByRole('button', { name: /start sending/i })
    fireEvent.pointerDown(send)
    vi.advanceTimersByTime(200)
    fireEvent.pointerLeave(send)
    vi.advanceTimersByTime(600)
    expect(screen.queryByRole('menu')).toBeNull()
    vi.useRealTimers()
  })
})

describe('the menu closes', () => {
  it('on Escape, without transmitting anything', () => {
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(room.toggled).toBe(0)
  })

  it('on a press somewhere else', () => {
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('on a second right click', () => {
    render(() => <JamInputControl />)
    const send = screen.getByRole('button', { name: /start sending/i })
    fireEvent.contextMenu(send)
    fireEvent.contextMenu(send)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('on a second press of the caret', () => {
    render(() => <JamInputControl />)
    openMenu()
    openMenu()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('but not on a press inside itself', () => {
    // Closing on the device select would make it unusable.
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.pointerDown(screen.getByRole('menu'))
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
  })

  it('when the keyboard tabs out of it', () => {
    render(() => (
      <>
        <JamInputControl />
        <button type="button">Elsewhere</button>
      </>
    ))
    openMenu()
    fireEvent.focusOut(screen.getByRole('menuitemradio', { name: /Voice/ }), {
      relatedTarget: screen.getByRole('button', { name: 'Elsewhere' }),
    })
    expect(screen.queryAllByRole('menu')).toHaveLength(0)
  })

  it('but not when focus moves to its own send button', () => {
    // The portal put the menu somewhere else in the page; the button it
    // belongs to still counts as inside.
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.focusOut(screen.getByRole('menuitemradio', { name: /Voice/ }), {
      relatedTarget: screen.getByTestId('jam-send'),
    })
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
  })

  it('when the control goes, rather than hanging over the next screen', () => {
    const { unmount } = render(() => <JamInputControl />)
    openMenu()
    unmount()
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(0)
  })
})

// ── Drawn from the page root ─────────────────────────────────────────
// Inside the room, the phone tab bar was drawn over the menu whatever its
// z-index: the jam page is one stacking context and the bar is outside it.
// So the menu is portalled, and these are the things a portal takes away
// that have to be put back -- the room's theme, and a keyboard path in.

describe('the menu, drawn from the page root', () => {
  it('is not inside the room it was opened from', () => {
    render(() => (
      <div data-testid="room">
        <JamInputControl />
      </div>
    ))
    openMenu()
    const menu = screen.getByRole('menu', { name: 'What you are sending' })
    expect(screen.getByTestId('room').contains(menu)).toBe(false)
  })

  it("carries the room's theme with it", async () => {
    // The jam page sets its own --bg-secondary; out of the room the menu
    // would otherwise take the page's.
    render(() => (
      <div style={{ '--bg-secondary': 'rgb(1, 2, 3)' }}>
        <JamInputControl />
      </div>
    ))
    openMenu()
    await waitFor(() => {
      const menu = screen.getByRole('menu', { name: 'What you are sending' })
      expect(menu.style.getPropertyValue('--bg-secondary')).toBe('rgb(1, 2, 3)')
    })
  })

  it('takes focus to the current choice when it opens', () => {
    // No longer next to the caret in the tab order, so a keyboard user
    // would otherwise have no way in.
    room.profile = 'instrument'
    render(() => <JamInputControl />)
    openMenu()
    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', { name: /Instrument/ }),
    )
  })

  it('hands focus back to the caret on Escape', () => {
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(
      screen.getByLabelText('Choose what you are sending'),
    )
  })

  it('hands focus back to the caret after a choice', () => {
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Instrument/ }))
    expect(document.activeElement).toBe(
      screen.getByLabelText('Choose what you are sending'),
    )
  })

  it('moves between the choices with the arrow keys, wrapping', () => {
    render(() => <JamInputControl />)
    openMenu()
    const voice = screen.getByRole('menuitemradio', { name: /Voice/ })
    const instrument = screen.getByRole('menuitemradio', { name: /Instrument/ })
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(instrument)
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(voice)
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(instrument)
  })
})

// ── Where the menu opens ─────────────────────────────────────────────
// The first version opened upward, on a rule borrowed from Guitar Night's
// bottom toolbar. This control is not in one, so the menu opened off the
// top of the page and could not be seen at all -- the control worked and
// looked broken. Geometry is testable, so it is tested.

describe('menuPosition', () => {
  const VW = 1280
  const VH = 800
  /** The menu's real height with both options and the input row. */
  const MENU = 231

  it('opens downward when there is room, which is the usual case here', () => {
    // The control sits in a header, not a footer.
    const at = menuPosition({ top: 60, bottom: 96, left: 400 }, MENU, VW, VH)
    expect(at).toEqual({ side: 'below', top: 102, left: 400, maxHeight: 300 })
  })

  it('opens downward whenever the menu fits there, even with more room above', () => {
    // Judged on the 300px cap rather than the menu's real height, a 231px
    // menu was sent upward from a button with 250px free beneath it.
    const at = menuPosition({ top: 414, bottom: 450, left: 400 }, MENU, VW, 714)
    expect(at).toEqual({ side: 'below', top: 456, left: 400, maxHeight: 250 })
  })

  it('opens upward when the button is near the bottom', () => {
    // Guitar Night's case, and still the right answer there.
    const at = menuPosition({ top: 740, bottom: 776, left: 400 }, MENU, VW, VH)
    expect(at).toEqual({ side: 'above', bottom: 66, left: 400, maxHeight: 300 })
  })

  it('meets the button when it opens upward, however short it is', () => {
    // Placed by its top edge from the cap, a shorter menu stopped short of
    // the button and floated in the space above it. Anchored by its lower
    // edge it cannot: 800 - 66 = 734, the gap above the button's 740.
    const at = menuPosition({ top: 740, bottom: 776, left: 400 }, 120, VW, VH)
    expect(at).toMatchObject({ side: 'above', bottom: 66 })
  })

  it('never runs off the bottom of a short landscape screen', () => {
    // Measured on the PR preview at 667x320: the menu ended at 329, past
    // the edge -- and with the feedback warning showing, the part past the
    // edge is the warning. Capped to the room below, it ends at
    // 96 + 216 = 312 and scrolls.
    const at = menuPosition(
      { top: 54, bottom: 90, left: 401 },
      MENU + 50,
      667,
      320,
    )
    expect(at).toEqual({ side: 'below', top: 96, left: 401, maxHeight: 216 })
  })

  it('never leaves the menu off the top of the page', () => {
    // The reported bug: invisible, not merely awkward. Squeezed upward it
    // takes the room there is, so its highest top edge is
    // 150 - 56 - 86 = 8, the margin.
    const at = menuPosition({ top: 100, bottom: 136, left: 400 }, MENU, VW, 150)
    expect(at).toEqual({ side: 'above', bottom: 56, left: 400, maxHeight: 86 })
  })

  it('keeps the whole menu on screen near the right edge', () => {
    const at = menuPosition({ top: 60, bottom: 96, left: 1260 }, MENU, VW, VH)
    // The right margin, less the menu's 248px width.
    expect(at.left).toBe(VW - 8 - 248)
  })

  it('does not go negative on a viewport narrower than the menu', () => {
    // A split-screen window can be narrower than the menu is wide; it is
    // pinned to the left margin rather than pushed off the left edge.
    const at = menuPosition({ top: 60, bottom: 96, left: 4 }, MENU, 240, 640)
    expect(at.left).toBe(8)
  })

  it('follows the button horizontally when there is room', () => {
    const at = menuPosition({ top: 60, bottom: 96, left: 500 }, MENU, VW, VH)
    expect(at.left).toBe(500)
  })
})

// The component half: that the placement reaches the menu, and that it is
// worked out from the menu as rendered. The jam header only ever opens it
// downward, so a real layout would never catch the upward branch breaking.

describe('where the menu is put', () => {
  const at = (top: number): DOMRect =>
    ({
      top,
      bottom: top + 36,
      left: 400,
      right: 436,
      x: 400,
      y: top,
      width: 36,
      height: 36,
      toJSON: () => ({}),
    }) as DOMRect

  const openAt = (top: number): HTMLElement => {
    vi.stubGlobal('innerHeight', 800)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      at(top),
    )
    // What the rendered menu measures in a browser; jsdom lays nothing out.
    vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(231)
    render(() => <JamInputControl />)
    openMenu()
    return screen.getByRole('menu', { name: 'What you are sending' })
  }

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('measures the menu it is placing', () => {
    // 250px free below, 486 above: the 231px menu fits below, and only a
    // placement that measured it knows that -- the 300px cap would not.
    const menu = openAt(500)
    expect(menu.style.top).toBe('542px')
    expect(menu.style.bottom).toBe('')
  })

  it('hangs from its lower edge when it has to open upward', () => {
    const menu = openAt(740)
    expect(menu.style.bottom).toBe('66px')
    expect(menu.style.top).toBe('')
    expect(menu.style.maxHeight).toBe('300px')
  })
})
