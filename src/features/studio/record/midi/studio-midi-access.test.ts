// Studio MIDI access tests — MIDI is asked for once, from a press, and its ports follow the browser's as keyboards come and go; a denial reads apart from any other failure; and a browser without Web MIDI has none to ask.
import { describe, expect, it, vi } from 'vitest'
import { fakeMidiAccess, fakeMidiInput } from './fake-midi.fixture'
import { createStudioMidiAccess } from './studio-midi-access'

describe('the Studio MIDI access', () => {
  it('asks only when pressed, and once, then lists the connected ports as they come and go', async () => {
    // Arrange
    const keys = fakeMidiInput('keys', 'Keystation 49')
    const fake = fakeMidiAccess([keys])
    const request = vi.fn(() => Promise.resolve(fake.access))
    const access = createStudioMidiAccess({ request })
    const before = access.state()

    // Act
    await access.request()
    fake.plug(fakeMidiInput('pads', 'MPD218'))
    const plugged = access.ports().map((port) => port.name)
    fake.unplug('keys')
    await access.request()

    // Assert
    expect(before).toBe('idle')
    expect(request).toHaveBeenCalledOnce()
    expect(access.state()).toBe('granted')
    expect(plugged).toEqual(['Keystation 49', 'MPD218'])
    expect(access.ports()).toEqual([
      { id: 'pads', name: 'MPD218', manufacturer: null },
    ])
  })

  it('tells a denial apart from any other failure', async () => {
    // Arrange
    const denied = createStudioMidiAccess({
      request: () =>
        Promise.reject(new DOMException('Blocked', 'NotAllowedError')),
    })
    const failed = createStudioMidiAccess({
      request: () => Promise.reject(new Error('The service went away')),
    })

    // Act
    const deniedAccess = await denied.request()
    const failedAccess = await failed.request()

    // Assert
    expect(deniedAccess).toBeNull()
    expect(denied.state()).toBe('denied')
    expect(failedAccess).toBeNull()
    expect(failed.state()).toBe('failed')
  })

  it('says a browser without Web MIDI has none to ask', async () => {
    // Arrange
    const access = createStudioMidiAccess({ request: () => null })

    // Act
    const granted = await access.request()

    // Assert
    expect(granted).toBeNull()
    expect(access.state()).toBe('unsupported')
  })
})
