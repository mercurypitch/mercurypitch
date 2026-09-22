// ── Jam input control tests ──────────────────────────────────────────
// This control decides what a room transmits, and one of its two choices
// turns echo cancellation off. So the cases that matter are the ones where
// a wrong press is expensive: the label naming the wrong hardware, the
// choice being hidden, and the combination that howls going unremarked --
// an unprocessed default input, which is a built-in microphone, while
// speakers are playing the room back.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
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
})

// ── Where the menu opens ─────────────────────────────────────────────
// The first version opened upward, on a rule borrowed from Guitar Night's
// bottom toolbar. This control is not in one, so the menu opened off the
// top of the page and could not be seen at all -- the control worked and
// looked broken. Geometry is testable, so it is tested.

describe('menuPosition', () => {
  const VW = 1280
  const VH = 800

  it('opens downward when there is room, which is the usual case here', () => {
    // The control sits in a header, not a footer.
    const at = menuPosition({ top: 60, bottom: 96, left: 400 }, VW, VH)
    expect(at.top).toBe(102)
  })

  it('opens upward when the button is near the bottom', () => {
    // Guitar Night's case, and still the right answer there.
    const at = menuPosition({ top: 740, bottom: 776, left: 400 }, VW, VH)
    expect(at.top).toBeLessThan(740)
  })

  it('never leaves the menu off the top of the page', () => {
    // The reported bug: invisible, not merely awkward.
    const at = menuPosition({ top: 10, bottom: 46, left: 400 }, VW, 200)
    expect(at.top).toBeGreaterThanOrEqual(8)
  })

  it('keeps the whole menu on screen near the right edge', () => {
    const at = menuPosition({ top: 60, bottom: 96, left: 1260 }, VW, VH)
    expect(at.left + 248).toBeLessThanOrEqual(VW)
  })

  it('does not go negative on a viewport narrower than the menu', () => {
    // A phone in portrait is narrower than the menu is wide.
    const at = menuPosition({ top: 60, bottom: 96, left: 4 }, 320, 640)
    expect(at.left).toBeGreaterThanOrEqual(0)
  })

  it('follows the button horizontally when there is room', () => {
    const at = menuPosition({ top: 60, bottom: 96, left: 500 }, VW, VH)
    expect(at.left).toBe(500)
  })
})
