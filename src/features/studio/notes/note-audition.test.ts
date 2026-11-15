// Studio note audition tests — a press makes or resumes the Studio's clock and loads the instruments once; a note sounds at once through the lane's own instrument on that clock, for a moment, and the note before it stops as it starts; a lane that changes its sound gets its new instrument; and with no clock, or once disposed, nothing sounds.
import { describe, expect, it, vi } from 'vitest'
import type { StudioMidiSound } from '../record/midi/studio-midi-sound'
import type { StudioMidiSounds } from '../record/midi/studio-midi-sounds'
import { createStudioNoteAudition, NOTE_AUDITION_SECONDS, } from './note-audition'

/** A clock at 2 s, its gains logged. */
function fakeClock() {
  const destination = { name: 'speakers' }
  const gains: {
    connect: ReturnType<typeof vi.fn>
    gain: { value: number }
  }[] = []
  const context = {
    currentTime: 2,
    destination,
    createGain() {
      const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
      gains.push(gain)
      return gain
    },
  } as unknown as AudioContext
  return { context, destination, gains }
}

/** The instruments, faked: each voice logs its starts and stops, each attach its kind. */
function fakeSounds() {
  const calls: string[] = []
  const attach = vi.fn((kind: StudioMidiSound) => ({
    node: { connect: vi.fn() },
    voice: {
      start(id: string, midi: number, velocity: number, at: number) {
        calls.push(`${kind} start ${id} ${midi} ${velocity} at ${at}`)
      },
      stop(id: string, at: number) {
        calls.push(`${kind} stop ${id} at ${at}`)
      },
      silence: vi.fn(),
    },
    detach() {
      calls.push(`${kind} let go`)
    },
  }))
  const sounds = { attach, dispose: vi.fn() } as unknown as StudioMidiSounds
  return { sounds, attach, calls }
}

function audition(
  options: {
    context?: AudioContext | null
    sound?: () => StudioMidiSound
  } = {},
) {
  const clock = fakeClock()
  const instruments = fakeSounds()
  const unlock = vi.fn(() => Promise.resolve(true))
  const load = vi.fn(() => Promise.resolve(instruments.sounds))
  const context = options.context === undefined ? clock.context : null
  const created = createStudioNoteAudition({
    clock: { clock: () => context, unlock },
    sound: options.sound ?? (() => 'piano'),
    load,
  })
  return { audition: created, clock, instruments, unlock, load }
}

/** Every promise the audition chained so far, settled. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('a press', () => {
  it('makes or resumes the clock each time, and loads the instruments once', () => {
    const { audition: notes, unlock, load } = audition()

    notes.prime()
    notes.prime()

    expect(unlock).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenCalledTimes(1)
  })
})

describe('a note', () => {
  it("sounds at once through the lane's instrument for a moment, the note before stopping as it starts", async () => {
    // Arrange
    const { audition: notes, clock, instruments } = audition()

    // Act
    notes.play(64, 0.7)
    await settled()
    notes.play(67, 0.5)
    await settled()

    // Assert: one piano on the clock, through one gain to the speakers.
    expect(instruments.calls).toEqual([
      'piano start audition-1 64 0.7 at 2',
      `piano stop audition-1 at ${2 + NOTE_AUDITION_SECONDS}`,
      'piano stop audition-1 at 2',
      'piano start audition-2 67 0.5 at 2',
      `piano stop audition-2 at ${2 + NOTE_AUDITION_SECONDS}`,
    ])
    expect(instruments.attach).toHaveBeenCalledTimes(1)
    expect(clock.gains[0].connect).toHaveBeenCalledWith(clock.destination)
  })

  it("sounds through the lane's new instrument once its sound changes", async () => {
    let sound: StudioMidiSound = 'piano'
    const { audition: notes, instruments } = audition({ sound: () => sound })

    notes.play(60, 1)
    await settled()
    sound = 'drums'
    notes.play(36, 1)
    await settled()

    expect(instruments.attach.mock.calls.map(([kind]) => kind)).toEqual([
      'piano',
      'drums',
    ])
    expect(instruments.calls).toContain('piano let go')
    expect(instruments.calls.at(-2)).toBe('drums start audition-2 36 1 at 2')
  })

  it('sounds nothing without a clock, or once the editor has gone', async () => {
    const silent = audition({ context: null })
    const gone = audition()

    silent.audition.play(60, 1)
    gone.audition.dispose()
    gone.audition.play(60, 1)
    await settled()

    expect(silent.instruments.calls).toEqual([])
    expect(gone.instruments.calls).toEqual([])
  })
})
