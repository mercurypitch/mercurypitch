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
  devices: [] as { deviceId: string; label: string; isLoopback: boolean }[],
  toggled: 0,
  switched: 0,
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
  setJamInputDeviceLabel: () => {},
  refreshJamInputDevices: async () => {},
  switchJamAudioSource: async () => {
    room.switched += 1
  },
  toggleJamMute: async () => {
    room.toggled += 1
  },
}))

const { JamInputControl } = await import('@/components/jam/JamInputControl')

afterEach(() => {
  cleanup()
  room.profile = 'voice'
  room.muted = true
  room.deviceId = null
  room.devices = []
  room.toggled = 0
  room.switched = 0
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

  it('but not on a press inside itself', () => {
    // Closing on the device select would make it unusable.
    render(() => <JamInputControl />)
    openMenu()
    fireEvent.pointerDown(screen.getByRole('menu'))
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
  })
})
