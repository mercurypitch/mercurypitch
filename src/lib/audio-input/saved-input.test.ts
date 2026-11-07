// Saved input tests — a remembered input is found by its id, then by its name, never as a loopback, and not at all rather than by a guess.

import { describe, expect, it } from 'vitest'
import { isLoopbackLabel, resolveDeviceId } from './saved-input'

describe('isLoopbackLabel', () => {
  it('spots the PipeWire and PulseAudio monitor sources', () => {
    // These enumerate as ordinary capture devices on Linux. Picking one in
    // a jam room captures the room's own output and sends it back -- a
    // feedback loop with a network round trip in the middle.
    expect(isLoopbackLabel('Monitor of Built-in Audio Analog Stereo')).toBe(
      true,
    )
    expect(isLoopbackLabel('monitor of Scarlett 4i4 USB')).toBe(true)
    expect(isLoopbackLabel('Loopback Capture')).toBe(true)
  })

  it('leaves real inputs alone, including ones with monitor in the name', () => {
    // "Monitor" on its own is a legitimate word for studio hardware, so
    // the match is on the full "monitor of" phrase rather than the word.
    expect(isLoopbackLabel('Scarlett 4i4 USB Analogue 1 + 2')).toBe(false)
    expect(isLoopbackLabel('Studio Monitor Input')).toBe(false)
    expect(isLoopbackLabel('Default')).toBe(false)
    expect(isLoopbackLabel('')).toBe(false)
  })
})

describe('resolveDeviceId', () => {
  const dev = (deviceId: string, label: string) => ({ deviceId, label })
  const devices = [
    dev('hash-a', 'Scarlett 4i4 USB Pro Audio'),
    dev('hash-b', 'Built-in Audio'),
    dev('hash-c', 'Monitor of Built-in Audio'),
  ]

  it('takes the saved id when it still names something', () => {
    expect(
      resolveDeviceId('hash-a', 'Scarlett 4i4 USB Pro Audio', devices),
    ).toBe('hash-a')
  })

  it('falls back to the label when the id has changed underneath', () => {
    // Switching a Scarlett from Analogue Stereo to Pro Audio changes the
    // PulseAudio source name, and therefore the hashed deviceId. Without
    // this the room silently falls back to a laptop microphone.
    expect(
      resolveDeviceId('stale-id', 'Scarlett 4i4 USB Pro Audio', devices),
    ).toBe('hash-a')
  })

  it('never resolves to a loopback, even on an exact label match', () => {
    expect(
      resolveDeviceId('gone', 'Monitor of Built-in Audio', devices),
    ).toBeNull()
  })

  it('gives up rather than guessing when nothing matches', () => {
    // Null means "take the default", which is a recoverable outcome. A
    // guess would be an unrecoverable one nobody could diagnose.
    expect(resolveDeviceId('gone', 'Some Old Interface', devices)).toBeNull()
    expect(resolveDeviceId(null, null, devices)).toBeNull()
    expect(resolveDeviceId('gone', '', devices)).toBeNull()
  })

  it('handles an empty device list', () => {
    expect(resolveDeviceId('hash-a', 'Scarlett', [])).toBeNull()
  })
})
