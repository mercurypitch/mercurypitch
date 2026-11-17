// Studio note roll keys tests — the key under a press is the piano's pitch or the kit row's drum there, none past the rows; a press primes the clock and sounds its key at 100 of 127, lit from when its sound starts for as long as it sounds and dark if it never sounds; a mouse slid along the keys plays each new key it reaches and the one before goes dark; a finger is a press until it passes its slop, then pans the rows and its key falls quiet at once; and a press past the rows takes nothing.
import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import { studioDrumRows } from '@/lib/studio/midi/drum-rows'
import type { StudioRollRows } from '@/lib/studio/midi/roll-keyboard'
import { NOTE_AUDITION_SECONDS } from './note-audition'
import type { NoteKeyAudition } from './note-roll-keys'
import { createNoteRollKeys, NOTE_KEY_VELOCITY, rollKeyAt, } from './note-roll-keys'

/** Rows of 20 px from 48 at the foot to 71 at the top. */
const PIANO_VIEW: RollViewport = {
  start: 0,
  end: 3840,
  minMidi: 48,
  maxMidi: 71,
  width: 960,
  height: 480,
}
const PIANO: StudioRollRows = { kind: 'piano' }
/** The middle of `pitch`'s row. */
const rowY = (pitch: number) => (71 - pitch) * 20 + 10

describe('rollKeyAt', () => {
  it('is the piano’s pitch on the row under a point', () => {
    expect(rollKeyAt(PIANO_VIEW, PIANO, rowY(60))).toBe(60)
    expect(rollKeyAt(PIANO_VIEW, PIANO, 0)).toBe(71)
    expect(rollKeyAt(PIANO_VIEW, PIANO, 479)).toBe(48)
  })

  it('is the drum a kit’s row plays, the kick at the foot', () => {
    const kit: StudioRollRows = {
      kind: 'drums',
      keys: studioDrumRows([{ pitch: 36 }]),
    }
    const view = { ...PIANO_VIEW, minMidi: 0, maxMidi: 7, height: 320 }

    expect(rollKeyAt(view, kit, 319)).toBe(36)
    expect(rollKeyAt(view, kit, 0)).toBe(kit.keys[0].key)
  })

  it('is none above or below the rows', () => {
    expect(rollKeyAt(PIANO_VIEW, PIANO, -1)).toBeNull()
    expect(rollKeyAt(PIANO_VIEW, PIANO, 480)).toBeNull()
  })
})

/** The editor's audition, faked: each play logged and answered as asked. */
function fakeAudition(sounds = true) {
  const log: string[] = []
  const audition: NoteKeyAudition = {
    prime: () => log.push('prime'),
    play: (pitch, velocity) => {
      log.push(`play ${pitch} ${velocity}`)
      return Promise.resolve(sounds)
    },
    stop: () => log.push('stop'),
  }
  return { audition, log }
}

function keys(audition: NoteKeyAudition | null = fakeAudition().audition) {
  const pans: number[] = []
  const made = createRoot(() =>
    createNoteRollKeys({
      audition: () => audition,
      keyAt: (y) => rollKeyAt(PIANO_VIEW, PIANO, y),
      pan: (dy) => pans.push(dy),
    }),
  )
  return { keys: made, pans }
}

const mouse = (y: number) => ({
  pointerId: 1,
  pointerType: 'mouse' as const,
  y,
})
const finger = (y: number) => ({
  pointerId: 7,
  pointerType: 'touch' as const,
  y,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a press on a key', () => {
  it('primes the clock and sounds its key at 100 of 127, whatever was played about it', async () => {
    // Arrange
    const { audition, log } = fakeAudition()
    const { keys: column } = keys(audition)

    // Act
    const took = column.down(mouse(rowY(60)))
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(took).toBe(true)
    expect(log).toEqual(['prime', `play 60 ${NOTE_KEY_VELOCITY}`])
    expect(Math.round(NOTE_KEY_VELOCITY * 127)).toBe(100)
  })

  it('lights its key once it sounds, for as long as it sounds', async () => {
    const { keys: column } = keys()

    column.down(mouse(rowY(64)))
    await vi.advanceTimersByTimeAsync(0)
    const lit = column.lit()
    await vi.advanceTimersByTimeAsync(NOTE_AUDITION_SECONDS * 1000 - 10)
    const still = column.lit()
    await vi.advanceTimersByTimeAsync(20)

    expect(lit).toBe(64)
    expect(still).toBe(64)
    expect(column.lit()).toBeNull()
  })

  it('lights nothing when its key cannot sound', async () => {
    const { keys: column } = keys(fakeAudition(false).audition)

    column.down(mouse(rowY(64)))
    await vi.advanceTimersByTimeAsync(0)

    expect(column.lit()).toBeNull()
  })

  it('takes nothing past the rows', () => {
    const { audition, log } = fakeAudition()
    const { keys: column } = keys(audition)

    expect(column.down(mouse(500))).toBe(false)
    expect(log).toEqual([])
  })
})

describe('a mouse slid along the keys', () => {
  it('plays each new key it reaches, the one before going dark, and nothing again on the same key', async () => {
    // Arrange
    const { audition, log } = fakeAudition()
    const { keys: column } = keys(audition)

    // Act: C4 to D4 by way of C sharp, a wobble on D4, then let go.
    column.down(mouse(rowY(60)))
    await vi.advanceTimersByTimeAsync(0)
    column.move({ pointerId: 1, y: rowY(61) })
    column.move({ pointerId: 1, y: rowY(62) })
    column.move({ pointerId: 1, y: rowY(62) + 3 })
    await vi.advanceTimersByTimeAsync(0)
    column.end(1)
    column.move({ pointerId: 1, y: rowY(63) })

    // Assert
    expect(log.filter((each) => each.startsWith('play'))).toEqual([
      `play 60 ${NOTE_KEY_VELOCITY}`,
      `play 61 ${NOTE_KEY_VELOCITY}`,
      `play 62 ${NOTE_KEY_VELOCITY}`,
    ])
    expect(column.lit()).toBe(62)
  })
})

describe('a finger on the keys', () => {
  it('is a press inside its slop, then pans the rows with it, its key quiet at once', async () => {
    // Arrange
    const { audition, log } = fakeAudition()
    const { keys: column, pans } = keys(audition)
    column.down(finger(rowY(60)))
    await vi.advanceTimersByTimeAsync(0)

    // Act
    column.move({ pointerId: 7, y: rowY(60) + 6 })
    const inside = [...pans]
    const litInside = column.lit()
    column.move({ pointerId: 7, y: rowY(60) + 30 })
    column.move({ pointerId: 7, y: rowY(60) + 50 })

    // Assert: the pan follows the finger from where it pressed.
    expect(inside).toEqual([])
    expect(litInside).toBe(60)
    expect(pans).toEqual([30, 20])
    expect(log.at(-1)).toBe('stop')
    expect(log.filter((each) => each.startsWith('play'))).toHaveLength(1)
    expect(column.lit()).toBeNull()
  })
})
