// Studio MIDI activity tests — once MIDI is allowed, a message a port sends lights it for a moment and anything the reader does not know does not; nothing listens before MIDI is allowed; and listening stops with its owner.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeMidiAccess, fakeMidiInput } from './fake-midi.fixture'
import { createStudioMidiAccess } from './studio-midi-access'
import { createStudioMidiActivity, STUDIO_MIDI_LIGHT_MS, } from './studio-midi-activity'

afterEach(() => {
  vi.useRealTimers()
})

/** A reader that knows a note on and nothing else. */
const notesOnly = async () => (data: Uint8Array | null) =>
  data !== null && (data[0] & 0xf0) === 0x90

function watch() {
  const keys = fakeMidiInput('keys', 'Keystation 49')
  const access = createStudioMidiAccess({
    request: () => Promise.resolve(fakeMidiAccess([keys]).access),
  })
  let dispose!: () => void
  const activity = createRoot((done) => {
    dispose = done
    return createStudioMidiActivity(access, notesOnly)
  })
  return { keys, access, activity, dispose }
}

describe('the Studio MIDI activity', () => {
  it('lights a port for a moment on a message, and not on one it does not know', async () => {
    // Arrange
    vi.useFakeTimers()
    const { keys, access, activity } = watch()
    await access.request()
    await vi.advanceTimersByTimeAsync(0)

    // Act
    keys.send([0xf8], 1)
    const afterClock = activity.lit('keys')
    keys.send([0x90, 60, 100], 2)
    const afterNote = activity.lit('keys')
    await vi.advanceTimersByTimeAsync(STUDIO_MIDI_LIGHT_MS + 1)

    // Assert
    expect(afterClock).toBe(false)
    expect(afterNote).toBe(true)
    expect(activity.lit('keys')).toBe(false)
  })

  it('listens to nothing before MIDI is allowed, and stops with its owner', async () => {
    // Arrange
    vi.useFakeTimers()
    const { keys, access, activity, dispose } = watch()

    // Act
    keys.send([0x90, 60, 100], 1)
    const beforeAllowed = activity.lit('keys')
    await access.request()
    await vi.advanceTimersByTimeAsync(0)
    dispose()
    keys.send([0x90, 60, 100], 2)

    // Assert
    expect(beforeAllowed).toBe(false)
    expect(activity.lit('keys')).toBe(false)
  })
})
