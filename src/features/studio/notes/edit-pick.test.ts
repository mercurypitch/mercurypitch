// Studio note picking tests — a press picks the note under it, else a selected note's grip, else the nearest note within the pointer's reach; a finger reaches 12 px and resizes only a selected note, from a grip at least 16 px wide that never takes a short note's body; a mouse resizes from a note's last pixels; and a tap or a drag is told apart by the Studio ruler's slop.
import { describe, expect, it } from 'vitest'
import { studioRulerSlop } from '@/features/studio/timeline/ruler-gesture'
import type { RollRect, RollViewport } from '@/lib/roll-geometry'
import { noteRect } from '@/lib/roll-geometry'
import type { StudioRollNote } from '@/lib/studio/midi/roll'
import type { NotePickInput } from './edit-pick'
import { NOTE_GRIP_INSIDE_WIDTH, NOTE_POINTER_PROFILES, noteGripRect, noteResizeZone, pickRollNote, } from './edit-pick'

/** A phone: two bars across 320 px (24 ticks a pixel) and rows of 20 px from 52 to 72. */
const PHONE: RollViewport = {
  start: 0,
  end: 7680,
  minMidi: 52,
  maxMidi: 72,
  width: 320,
  height: 420,
}

/** A thirty-second note on middle C at phone zoom: 5 px wide, from x 80 to 85, y 240 to 260. */
const SHORT: StudioRollNote = { id: 1, start: 1920, end: 2040, midi: 60 }
/** A half note on E4: from x 160 to 240, y 160 to 180. */
const LONG: StudioRollNote = { id: 2, start: 3840, end: 5760, midi: 64 }

function pick(over: Partial<NotePickInput>) {
  return pickRollNote({
    notes: [SHORT, LONG],
    viewport: PHONE,
    selection: new Set(),
    x: 0,
    y: 0,
    pointerType: 'touch',
    ...over,
  })
}

const contains = (rect: RollRect, x: number, y: number) =>
  x >= rect.x &&
  x <= rect.x + rect.width &&
  y >= rect.y &&
  y <= rect.y + rect.height

describe('a finger on a short note at phone zoom', () => {
  it('moves the note when it presses its body, selected or not', () => {
    expect(pick({ x: 82, y: 250 })).toEqual({ id: 1, zone: 'body' })
    expect(pick({ x: 84, y: 250, selection: new Set([1]) })).toEqual({
      id: 1,
      zone: 'body',
    })
  })

  it('resizes the selected note from the grip beside it', () => {
    expect(pick({ x: 95, y: 250, selection: new Set([1]) })).toEqual({
      id: 1,
      zone: 'end',
    })
  })

  it("takes the grip a few pixels above and below the note's row, for a finger", () => {
    expect(pick({ x: 95, y: 237, selection: new Set([1]) })).toEqual({
      id: 1,
      zone: 'end',
    })
  })

  it('moves an unselected note from beside it: a finger resizes a selected note only', () => {
    expect(pick({ x: 95, y: 250 })).toEqual({ id: 1, zone: 'body' })
  })

  it('reaches a note 12 px away, and none further', () => {
    expect(pick({ x: 97, y: 250 })).toEqual({ id: 1, zone: 'body' })
    expect(pick({ x: 98, y: 250 })).toBeNull()
    expect(pick({ x: 82, y: 271 })).toEqual({ id: 1, zone: 'body' })
    expect(pick({ x: 82, y: 273 })).toBeNull()
  })
})

describe('a finger on a long note', () => {
  it('resizes it, selected, from its last 10 px and 10 px beyond', () => {
    const selection = new Set([2])
    expect(pick({ x: 231, y: 170, selection })).toEqual({ id: 2, zone: 'end' })
    expect(pick({ x: 249, y: 170, selection })).toEqual({ id: 2, zone: 'end' })
    expect(pick({ x: 228, y: 170, selection })).toEqual({ id: 2, zone: 'body' })
  })
})

describe('a mouse', () => {
  it('resizes any note from its last 6 px, and moves it from the rest', () => {
    expect(pick({ x: 235, y: 170, pointerType: 'mouse' })).toEqual({
      id: 2,
      zone: 'end',
    })
    expect(pick({ x: 232, y: 170, pointerType: 'mouse' })).toEqual({
      id: 2,
      zone: 'body',
    })
  })

  it('never resizes an unselected short note: its whole body moves it', () => {
    expect(pick({ x: 84.5, y: 250, pointerType: 'mouse' })).toEqual({
      id: 1,
      zone: 'body',
    })
  })

  it('reaches 3 px', () => {
    expect(pick({ x: 88, y: 250, pointerType: 'mouse' })).toEqual({
      id: 1,
      zone: 'body',
    })
    expect(pick({ x: 89, y: 250, pointerType: 'mouse' })).toBeNull()
  })
})

describe('the note on top', () => {
  it('wins where two notes overlap, as it is drawn over the other', () => {
    const under = { id: 3, start: 1920, end: 2400, midi: 60 }
    const over = { id: 4, start: 1920, end: 2400, midi: 60 }
    expect(pick({ notes: [under, over], x: 90, y: 250 })).toEqual({
      id: 4,
      zone: 'body',
    })
  })
})

describe('the grip', () => {
  const rectOf = (note: StudioRollNote) => noteRect(note, PHONE)

  it('sits inside a note at least 24 px wide, and beside a shorter one', () => {
    const long = rectOf(LONG)
    const short = rectOf(SHORT)
    expect(noteGripRect(long).x + noteGripRect(long).width).toBeLessThan(
      long.x + long.width,
    )
    expect(noteGripRect(short).x).toBeGreaterThan(short.x + short.width)
    expect(NOTE_GRIP_INSIDE_WIDTH).toBe(24)
  })

  it.each([2, 5, 10, 16, 20, 24, 30, 100, 400])(
    'is at least 16 px wide for a finger, and covers the grip it shows, on a note %i px wide',
    (width) => {
      // Arrange
      const rect = { x: 100, y: 200, width, height: 6 }
      const grip = noteGripRect(rect)

      // Act
      const zone = noteResizeZone(rect, true, 'touch')!

      // Assert
      expect(zone.width).toBeGreaterThanOrEqual(16)
      expect(contains(zone, grip.x, grip.y + grip.height / 2)).toBe(true)
      expect(
        contains(zone, grip.x + grip.width, grip.y + grip.height / 2),
      ).toBe(true)
      expect(zone.x).toBeGreaterThanOrEqual(rect.x + Math.min(width, 16))
    },
  )

  it.each([5, 20, 30])(
    'covers the grip it shows for a mouse too, on a note %i px wide',
    (width) => {
      const rect = { x: 100, y: 200, width, height: 20 }
      const grip = noteGripRect(rect)
      const zone = noteResizeZone(rect, true, 'mouse')!
      expect(
        contains(zone, grip.x + grip.width / 2, grip.y + grip.height / 2),
      ).toBe(true)
    },
  )
})

describe('the slop', () => {
  it("tells a tap from a drag as the Studio's ruler does, wider for a finger", () => {
    expect(NOTE_POINTER_PROFILES.mouse.slop).toBe(studioRulerSlop('mouse'))
    expect(NOTE_POINTER_PROFILES.pen.slop).toBe(studioRulerSlop('pen'))
    expect(NOTE_POINTER_PROFILES.touch.slop).toBe(studioRulerSlop('touch'))
  })
})
