// Studio MIDI arm tests — a MIDI lane's arm plays each note on its sound at the clock time its message arrived and logs it there, keeps a drum key with no drum, finds a port by its name when its id changed, refuses a gone port in its name and MIDI denied or missing in their words, says its port went when unplugged, and lets the port and the sound go on release without saying so.
import { describe, expect, it, vi } from 'vitest'
import type { StudioLaneMidiInput } from '@/lib/studio/record/lane-inputs'
import { createStudioNoteLog } from '@/lib/studio/record/take-notes'
import type { FakeMidiInput } from './fake-midi.fixture'
import { fakeMidiAccess, fakeMidiInput } from './fake-midi.fixture'
import { createStudioMidiAccess } from './studio-midi-access'
import type { StudioMidiArmOptions } from './studio-midi-arm'
import { openStudioMidiArm, StudioMidiArmRefusal } from './studio-midi-arm'
import type { StudioMidiSounds } from './studio-midi-sounds'

const KEYS: StudioLaneMidiInput = {
  kind: 'midi',
  portId: 'keys',
  label: 'Keystation 49',
}

function fakeSounds() {
  const voice = { start: vi.fn(), stop: vi.fn(), silence: vi.fn() }
  const node = { name: 'arm node' } as unknown as AudioNode
  const detach = vi.fn()
  const attach = vi.fn(() => ({ node, voice, detach }))
  const sounds = { attach, dispose: vi.fn() } as unknown as StudioMidiSounds
  return { sounds, attach, voice, node, detach }
}

/** An arm on the lane's `input`, with the browser listing `inputs`; the performance clock reads `clock.ms`. */
function arm(
  inputs: FakeMidiInput[],
  over: Partial<StudioMidiArmOptions> = {},
) {
  const fake = fakeMidiAccess(inputs)
  const made = fakeSounds()
  const log = createStudioNoteLog()
  const onLost = vi.fn()
  const clock = { ms: 2_000 }
  const opening = openStudioMidiArm({
    input: KEYS,
    sound: 'piano',
    access: createStudioMidiAccess({
      request: () => Promise.resolve(fake.access),
    }),
    sounds: () => Promise.resolve(made.sounds),
    log,
    onLost,
    now: () => clock.ms,
    ...over,
  })
  return { fake, ...made, log, onLost, clock, opening }
}

describe('a MIDI lane arm', () => {
  it("plays each note on the lane's sound at the clock time its message arrived, and logs it there", async () => {
    // Arrange
    const keys = fakeMidiInput('keys', 'Keystation 49')
    const armed = arm([keys])
    const hold = await armed.opening
    const clock = { currentTime: 10 }
    const context = clock as unknown as AudioContext
    const node = hold.play(context)

    // Act: a note 4 ms after the clocks were read, and its key up 504 ms after.
    keys.send([0x90, 60, 127], 2_004)
    clock.currentTime = 10.5
    armed.clock.ms = 2_500
    keys.send([0x80, 60, 0], 2_504)

    // Assert
    expect(node).toBe(armed.node)
    expect(armed.attach).toHaveBeenCalledExactlyOnceWith('piano', context)
    const [id, midi, velocity, at] = armed.voice.start.mock.calls[0] as [
      string,
      number,
      number,
      number,
    ]
    expect([midi, velocity]).toEqual([60, 1])
    expect(at).toBeCloseTo(10.004, 9)
    expect(armed.voice.stop.mock.calls[0][0]).toBe(id)
    expect(armed.voice.stop.mock.calls[0][1]).toBeCloseTo(10.504, 9)
    const [note] = armed.log.notes()
    expect(note.midi).toBe(60)
    expect(note.velocity).toBe(1)
    expect(note.start).toBeCloseTo(10.004, 9)
    expect(note.end).toBeCloseTo(10.504, 9)
  })

  it('sounds a note whose message is already past at once', async () => {
    // Arrange
    const keys = fakeMidiInput('keys', 'Keystation 49')
    const armed = arm([keys])
    const hold = await armed.opening
    hold.play({ currentTime: 10 } as AudioContext)

    // Act: sent 30 ms before the clocks were read.
    keys.send([0x90, 64, 100], 1_970)

    // Assert
    expect(armed.voice.start.mock.calls[0][3]).toBe(10)
  })

  it('keeps a key the drum kit has no drum for, as every other note', async () => {
    // Arrange
    const pads = fakeMidiInput('keys', 'Keystation 49')
    const armed = arm([pads], { sound: 'drums' })
    const hold = await armed.opening
    hold.play({ currentTime: 10 } as AudioContext)

    // Act: key 30 is below General MIDI's drums.
    pads.send([0x99, 30, 90], 2_000)

    // Assert
    expect(armed.attach).toHaveBeenCalledWith('drums', expect.anything())
    expect(armed.log.notes().map((note) => note.midi)).toEqual([30])
  })

  it('finds its port by name when the browser gave it a new id', async () => {
    // Arrange
    const keys = fakeMidiInput('renamed-id', 'Keystation 49')
    const armed = arm([keys])
    const hold = await armed.opening
    hold.play({ currentTime: 10 } as AudioContext)

    // Act
    keys.send([0x90, 60, 100], 2_000)

    // Assert
    expect(hold.connected()).toBe(true)
    expect(armed.voice.start).toHaveBeenCalledOnce()
  })

  it('refuses a port that is gone in its own name, and MIDI denied or missing in their words', async () => {
    // Arrange
    const gone = arm([fakeMidiInput('other', 'Launchpad')])
    const denied = arm([], {
      access: createStudioMidiAccess({
        request: () =>
          Promise.reject(new DOMException('Blocked', 'NotAllowedError')),
      }),
    })
    const missing = arm([], {
      access: createStudioMidiAccess({ request: () => null }),
    })

    // Act, Assert
    await expect(gone.opening).rejects.toEqual(
      new StudioMidiArmRefusal('Connect Keystation 49, then arm again.'),
    )
    await expect(denied.opening).rejects.toThrow(/may not use MIDI/)
    await expect(missing.opening).rejects.toThrow(
      /can't use MIDI keyboards or pads/,
    )
  })

  it('says its port went when it is unplugged, and stops its notes there', async () => {
    // Arrange
    const keys = fakeMidiInput('keys', 'Keystation 49')
    const armed = arm([keys])
    const hold = await armed.opening
    hold.play({ currentTime: 10 } as AudioContext)
    keys.send([0x90, 60, 100], 2_000)

    // Act
    armed.fake.unplug('keys')

    // Assert
    expect(armed.onLost).toHaveBeenCalledOnce()
    expect(armed.voice.stop).toHaveBeenCalledOnce()
    expect(armed.log.notes()[0].end).not.toBeNull()
    expect(hold.connected()).toBe(false)
  })

  it('lets its port and its sound go on release, without saying it went', async () => {
    // Arrange
    const keys = fakeMidiInput('keys', 'Keystation 49')
    const armed = arm([keys])
    const hold = await armed.opening
    hold.play({ currentTime: 10 } as AudioContext)

    // Act
    hold.release()
    keys.send([0x90, 60, 100], 2_000)

    // Assert
    expect(armed.onLost).not.toHaveBeenCalled()
    expect(armed.detach).toHaveBeenCalledOnce()
    expect(armed.voice.start).not.toHaveBeenCalled()
    expect(hold.connected()).toBe(false)
  })
})
