// Studio note roll drawing tests — each note in view is drawn where it sounds, as strong as it was played, named where it fits, and dimmed when it starts outside the clip's window; notes out of view cost nothing; a selected note gets a ring, and the editor's grips a bar each; a draft is drawn over the stored note it stands in for, which fades to a ghost; the marquee, the hover, a velocity's readout and the playhead are drawn on the overlay only; each note's velocity stands in its lane; rows sitting on fractions of a semitone draw every row they show part of; the keys name each C, a kit's rows their General MIDI names cut to fit, and its hits squares at their starts; the ruler names the song's bars; and the grid leaves out lines too close to read.
import { describe, expect, it } from 'vitest'
import type { StudioRollRows } from '@/lib/studio/midi/roll-keyboard'
import type { StudioNote } from '@/lib/studio/model/types'
import { kitHitSquare } from './kit-hit'
import type { RecordedPaint } from './note-roll-context.fixture'
import { recordingRollContext } from './note-roll-context.fixture'
import type { StudioRollInput, StudioRollTheme } from './note-roll-draw'
import { drawStudioRoll, drawStudioRollBase, drawStudioRollOverlay, studioRollNoteBox, studioRollRegions, } from './note-roll-draw'

/** Every colour its own word, so a test can tell what was painted in which. */
const THEME = Object.fromEntries(
  [
    'background',
    'rowShade',
    'gridLine',
    'gridBeat',
    'gridBar',
    'dim',
    'keyWhite',
    'keyBlack',
    'keyLine',
    'keyLabel',
    'kitRow',
    'kitShade',
    'kitText',
    'ruler',
    'rulerText',
    'divider',
    'note',
    'noteTop',
    'noteRing',
    'noteText',
    'noteGlow',
    'selection',
    'marquee',
    'playhead',
    'playheadGlow',
    'velocity',
    'muted',
    'font',
  ].map((key) => [key, key]),
) as unknown as StudioRollTheme

const note = (
  id: number,
  pitch: number,
  startTick: number,
  lengthTicks: number,
  velocity: number,
): StudioNote => ({ id, pitch, startTick, lengthTicks, velocity })

const NOTES: StudioNote[] = [
  note(1, 60, 960, 480, 0.8),
  note(2, 64, 1920, 960, 0.4),
  // Starts before the window and sounds into it: dimmed.
  note(3, 62, 480, 960, 1),
  // Above the rows in view, and after the ticks in view: not drawn.
  note(4, 90, 1000, 480, 1),
  note(5, 60, 5000, 480, 1),
]

/**
 * A canvas 840 by 406: keys 72 wide, a ruler 26 high, a velocity lane 80
 * high, so the grid is 768 by 300. The view spans ticks 0 to 3840 (5 ticks
 * a pixel) and rows 55 to 66 (25 px each); the window starts at 960.
 */
function input(overrides: Partial<StudioRollInput> = {}): StudioRollInput {
  return {
    width: 840,
    height: 406,
    ratio: 2,
    layout: { keysWidth: 72, rulerHeight: 26, velocityHeight: 80 },
    theme: THEME,
    viewport: {
      start: 0,
      end: 3840,
      minMidi: 55,
      maxMidi: 66,
      width: 768,
      height: 300,
    },
    window: { startTick: 960, endTick: 3840 },
    rows: { kind: 'piano' },
    meter: { beatTicks: 960, originTick: -1920, beatsPerBar: 4 },
    notes: NOTES,
    selected: new Set(),
    drafts: [],
    marquee: null,
    grips: [],
    hover: null,
    readout: null,
    playheadTick: null,
    corner: 'Notes',
    ...overrides,
  }
}

/** The paints of notes' bodies: fills in a gradient. */
const noteFills = (paints: readonly RecordedPaint[]) =>
  paints.filter(
    (paint) => paint.op === 'fill' && typeof paint.style === 'object',
  )

/** The note body painted at canvas x `x`. */
const bodyAt = (paints: readonly RecordedPaint[], x: number) =>
  noteFills(paints).find((paint) =>
    paint.shapes.some((shape) => Math.abs(shape.x - x) < 0.01),
  )

describe('the notes', () => {
  it('draws a note in view where it sounds, as strong as it was played, in glass', () => {
    // Arrange
    const { context, paints, gradients } = recordingRollContext()

    // Act
    drawStudioRollBase(context, input())

    // Assert: tick 960 is 192 px into the grid; row 60 is the seventh down.
    const body = bodyAt(paints, 264.5)!
    expect(body.shapes[0]).toMatchObject({ y: 177, width: 94.5, height: 23 })
    expect(body.alpha).toBeCloseTo(0.55 + 0.45 * 0.8, 6)
    expect(gradients[0].stops.map(([, color]) => color)).toEqual([
      'noteTop',
      'note',
      'note',
    ])
  })

  it('dims a note that starts outside the clip’s window', () => {
    const { context, paints } = recordingRollContext()

    drawStudioRollBase(context, input())

    expect(bodyAt(paints, 72 + 96 + 0.5)!.alpha).toBeCloseTo(0.22, 6)
  })

  it('draws only the notes in view: none above the rows or past the ticks', () => {
    const { context, paints } = recordingRollContext()

    drawStudioRollBase(context, input())

    expect(noteFills(paints)).toHaveLength(3)
  })

  it('finds the few notes in view among ten thousand, and draws only those', () => {
    // Arrange: a note every 30 ticks; the view shows the first 3840 ticks.
    const { context, paints } = recordingRollContext()
    const many = Array.from({ length: 10_000 }, (_, index) =>
      note(index + 1, 60, 960 + index * 30, 20, 0.8),
    )

    // Act
    drawStudioRollBase(context, input({ notes: many }))

    // Assert: starts 960 to 3840, 30 apart.
    expect(noteFills(paints)).toHaveLength(97)
  })

  it('names a note long and tall enough to read, in the note’s ink', () => {
    const { context, texts } = recordingRollContext()

    drawStudioRollBase(context, input())

    expect(texts).toContainEqual(
      expect.objectContaining({ text: 'C4', x: 269.5, color: 'noteText' }),
    )
  })

  it('rings a selected note in the selection colour, and leaves its grip to the overlay', () => {
    // Arrange
    const { context, paints } = recordingRollContext()

    // Act
    drawStudioRollBase(context, input({ selected: new Set([2]) }))

    // Assert: note 2 is at x 456.5, 190.5 wide.
    const ring = paints.find(
      (paint) =>
        paint.op === 'stroke' &&
        paint.style === 'selection' &&
        paint.lineWidth === 2,
    )!
    expect(ring.shapes[0]).toMatchObject({ x: 455, width: 193.5 })
    expect(
      paints.some(
        (paint) =>
          paint.style === 'selection' &&
          paint.op === 'fill' &&
          paint.shapes.some((shape) => shape.kind === 'round'),
      ),
    ).toBe(false)
  })

  it('draws every row a view on fractions of a semitone shows part of, and the notes in them', () => {
    // Arrange: the rows panned half a row, 55.5 to 66.5; row 67 peeks in at the top.
    const half = input().viewport
    const view = { ...half, minMidi: 55.5, maxMidi: 66.5 }
    const high = note(9, 67, 960, 480, 1)
    const { context, paints } = recordingRollContext()

    // Act
    drawStudioRollBase(context, input({ viewport: view, notes: [high] }))

    // Assert: row 67's top is half a row over the grid's, at y 26 - 12.5.
    expect(bodyAt(paints, 264.5)!.shapes[0]).toMatchObject({ y: 14.5 })
  })
})

describe('a gesture’s drafts', () => {
  const draft = {
    id: 1,
    pitch: 62,
    startTick: 1440,
    lengthTicks: 480,
    velocity: 0.8,
  }

  it('fades the stored note a draft stands in for to a ghost, without its glow', () => {
    const { context, paints } = recordingRollContext()

    drawStudioRollBase(context, input({ drafts: [draft] }))

    expect(bodyAt(paints, 264.5)!.alpha).toBeCloseTo(0.22, 6)
    const glow = paints.find((paint) => paint.style === 'noteGlow')!
    expect(glow.shapes.some((shape) => Math.abs(shape.x - 264.5) < 0.01)).toBe(
      false,
    )
  })

  it('draws the draft on the overlay where it would land, ringed as selected, with its velocity', () => {
    // Arrange
    const { context, paints } = recordingRollContext()

    // Act
    drawStudioRollOverlay(context, input({ drafts: [draft] }))

    // Assert: tick 1440 is 288 px into the grid; row 62 is the fifth down.
    expect(bodyAt(paints, 360.5)!.shapes[0]).toMatchObject({ y: 127 })
    expect(
      paints.some(
        (paint) =>
          paint.op === 'stroke' &&
          paint.style === 'selection' &&
          paint.lineWidth === 2,
      ),
    ).toBe(true)
    expect(
      paints.some(
        (paint) =>
          paint.op === 'fillRect' &&
          paint.style === 'selection' &&
          paint.shapes[0].x === 360 + 3,
      ),
    ).toBe(true)
  })
})

describe('the overlay', () => {
  it('draws the marquee where the editor holds it, in a wash and an edge', () => {
    // Arrange
    const { context, paints } = recordingRollContext()

    // Act
    drawStudioRollOverlay(
      context,
      input({ marquee: { x: 264, y: 76, width: 192, height: 125 } }),
    )

    // Assert
    const wash = paints.find((paint) => paint.style === 'marquee')!
    expect(wash.op).toBe('fillRect')
    expect(wash.alpha).toBeCloseTo(0.14, 6)
    expect(wash.shapes[0]).toMatchObject({
      x: 264,
      y: 76,
      width: 192,
      height: 125,
    })
    expect(paints.some((paint) => paint.op === 'strokeRect')).toBe(true)
  })

  it("draws each of the editor's grips as a bar in the selection colour", () => {
    const { context, paints } = recordingRollContext()

    drawStudioRollOverlay(
      context,
      input({ grips: [{ x: 640, y: 82, width: 3, height: 12 }] }),
    )

    const grip = paints.find(
      (paint) => paint.op === 'fill' && paint.style === 'selection',
    )!
    expect(grip.shapes[0]).toMatchObject({ kind: 'round', x: 640, width: 3 })
  })

  it("shows a dragged velocity, 1 to 127, in a pill over its note's lollipop", () => {
    // Arrange: note 1's lollipop at x 268 in a lane from y 326; at 0.8 its head is at y 342.4.
    const { context, texts } = recordingRollContext()

    // Act
    drawStudioRollOverlay(context, input({ readout: { id: 1, value: 102 } }))

    // Assert
    expect(texts).toContainEqual(expect.objectContaining({ text: '102' }))
  })

  it('rings the head of the lollipop under the mouse', () => {
    const { context, paints } = recordingRollContext()

    drawStudioRollOverlay(
      context,
      input({ hover: { id: 1, zone: 'velocity' } }),
    )

    const ring = paints.find(
      (paint) => paint.op === 'stroke' && paint.style === 'selection',
    )!
    expect(ring.shapes[0]).toMatchObject({ kind: 'arc', width: 14 })
  })

  it('outlines the hovered note, and lights the grip when the pointer is on its end', () => {
    const { context, paints } = recordingRollContext()

    drawStudioRollOverlay(context, input({ hover: { id: 2, zone: 'end' } }))

    const outline = paints.find((paint) => paint.op === 'stroke')!
    expect(outline).toMatchObject({ style: 'selection', lineWidth: 1.5 })
    expect(outline.alpha).toBeCloseTo(0.7, 6)
    expect(
      paints.some(
        (paint) =>
          paint.op === 'fillRect' &&
          Math.abs(paint.shapes[0].x - (456.5 + 190.5 - 4)) < 0.01,
      ),
    ).toBe(true)
  })

  it('draws the playhead from the ruler to the velocity lane, and none out of view', () => {
    const inView = recordingRollContext()
    drawStudioRollOverlay(inView.context, input({ playheadTick: 1920 }))
    const line = inView.paints.find((paint) => paint.style === 'playhead')!
    expect(line.shapes[0]).toEqual({
      kind: 'rect',
      x: 455,
      y: 0,
      width: 2,
      height: 406,
    })

    const outOfView = recordingRollContext()
    drawStudioRollOverlay(outOfView.context, input({ playheadTick: 9000 }))
    expect(outOfView.paints.some((paint) => paint.style === 'playhead')).toBe(
      false,
    )
  })

  it('keeps the playhead, the hover and the marquee out of the base, and clears only its own layer', () => {
    const base = recordingRollContext()
    const full = input({
      playheadTick: 1920,
      hover: { id: 1, zone: 'body' },
      marquee: { x: 72, y: 126, width: 192, height: 75 },
    })

    drawStudioRollBase(base.context, full)
    const whole = recordingRollContext()
    drawStudioRoll(whole.context, full)

    expect(base.paints.some((paint) => paint.style === 'playhead')).toBe(false)
    expect(base.paints.some((paint) => paint.style === 'marquee')).toBe(false)
    expect(whole.paints.some((paint) => paint.style === 'playhead')).toBe(true)
    expect(whole.clears()).toBe(1)
  })
})

describe('the velocity lane', () => {
  it('stands each note’s velocity as a lollipop under its start', () => {
    // Arrange: the lane runs from y 326 to 406; a full stick reaches 62 px.
    const { context, paints } = recordingRollContext()

    // Act
    drawStudioRollBase(context, input())

    // Assert: note 1 starts at x 264, its velocity 0.8.
    const stick = paints.find(
      (paint) =>
        paint.op === 'fillRect' &&
        paint.style === 'note' &&
        paint.shapes[0].x === 267,
    )!
    expect(stick.shapes[0].height).toBeCloseTo(0.8 * 62, 6)
  })
})

describe('the keys, the kit and the ruler', () => {
  it('names each C on the keys', () => {
    const { context, texts } = recordingRollContext()

    drawStudioRollBase(context, input())

    const labels = texts.filter((text) => text.color === 'keyLabel')
    expect(labels.map((text) => text.text)).toEqual(['C4'])
    expect(labels[0].align).toBe('right')
  })

  it('names a kit’s rows by their General MIDI names, cut to fit a narrow column', () => {
    // Arrange: two rows, the column 72 px wide: 52 px for a name.
    const { context, texts } = recordingRollContext()
    const rows: StudioRollRows = {
      kind: 'drums',
      keys: [
        { key: 42, name: 'Closed Hi-Hat' },
        { key: 36, name: 'Kick' },
      ],
    }

    // Act
    drawStudioRollBase(
      context,
      input({
        rows,
        viewport: { ...input().viewport, minMidi: 0, maxMidi: 1 },
        corner: 'Kit',
      }),
    )

    // Assert: at 11.5 px a letter is 5.75 px wide.
    const names = texts.filter((text) => text.color === 'kitText')
    expect(names.map((text) => text.text)).toEqual(['Closed H\u2026', 'Kick'])
  })

  it("names the song's bars on the ruler where they fall over the sequence", () => {
    // Arrange: bar 1 starts two beats before tick 0, so bar 2 is at 1920.
    const { context, texts } = recordingRollContext()

    // Act
    drawStudioRollBase(context, input())

    // Assert
    const bars = texts.filter((text) => text.color === 'rulerText')
    expect(bars.map((text) => [text.text, text.x])).toEqual([['2', 462]])
    expect(texts.some((text) => text.text === 'NOTES')).toBe(true)
  })

  it('names the bar and beat the view starts in when it starts inside a bar', () => {
    // Arrange: tick 0 is the third beat of bar 1.
    const inside = recordingRollContext()
    const onBar = recordingRollContext()

    // Act
    drawStudioRollBase(inside.context, input())
    drawStudioRollBase(
      onBar.context,
      input({ meter: { beatTicks: 960, originTick: 0, beatsPerBar: 4 } }),
    )

    // Assert
    expect(
      inside.texts.find((text) => text.color === 'muted' && text.x === 78),
    ).toMatchObject({ text: '1.3' })
    expect(onBar.texts.some((text) => /^\d+\.\d+$/.test(text.text))).toBe(false)
  })

  it('draws sixteenths where they have room, and leaves them out when they crowd', () => {
    const close = recordingRollContext()
    drawStudioRollBase(close.context, input())
    const far = recordingRollContext()
    drawStudioRollBase(
      far.context,
      input({ viewport: { ...input().viewport, end: 38_400 } }),
    )

    const steps = (paints: readonly RecordedPaint[]) =>
      paints.filter((paint) => paint.style === 'gridLine').length
    // 240 ticks are 48 px close up, 4.8 px far out.
    expect(steps(close.paints)).toBeGreaterThan(10)
    expect(steps(far.paints)).toBe(0)
  })
})

describe('studioRollRegions and studioRollNoteBox', () => {
  it('lays the grid between the keys, the ruler and the velocity lane', () => {
    expect(studioRollRegions(input())).toMatchObject({
      keys: { x: 0, y: 26, width: 72, height: 300 },
      grid: { x: 72, y: 26, width: 768, height: 300 },
      velocity: { x: 72, y: 326, width: 768, height: 80 },
    })
  })

  it('gives no box to a note on a kit row the kit does not have', () => {
    const kit = input({
      rows: { kind: 'drums', keys: [{ key: 36, name: 'Kick' }] },
      viewport: { ...input().viewport, minMidi: 0, maxMidi: 0 },
    })

    expect(studioRollNoteBox(kit, note(9, 38, 960, 240, 1))).toBeNull()
    expect(studioRollNoteBox(kit, note(9, 36, 960, 240, 1))).not.toBeNull()
  })

  it('draws a kit’s hit as a square at its start sized to its row, however long it is', () => {
    // Two rows of 150 px, the snare's on top; 5 ticks a pixel, so the hit
    // starts 192 px into the grid and its two beats would run 384 px.
    const kit = input({
      rows: {
        kind: 'drums',
        keys: [
          { key: 38, name: 'Snare' },
          { key: 36, name: 'Kick' },
        ],
      },
      viewport: { ...input().viewport, minMidi: 0, maxMidi: 1 },
    })

    const box = studioRollNoteBox(kit, note(9, 38, 960, 1920, 1))

    expect(box).toEqual(kitHitSquare(72 + 192, 26, 150, kit.viewport))
    expect(box?.width).toBe(box?.height)
    expect(box?.width).toBeLessThan(384)
  })
})
