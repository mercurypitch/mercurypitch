// Studio clip notes tests — a MIDI clip draws the notes its window plays at their real times, each as bright as it was played, on rows fitted to its pitches; a drum clip draws its hits a sixteenth wide on the kit's rows; a draw walks only the notes its span shows, and ten thousand notes cost a handful of fills; and an empty clip draws nothing.
import { describe, expect, it } from 'vitest'
import type { StudioNote, StudioSequence } from '@/lib/studio/model/types'
import type { StudioClipNotesFrame } from './clip-notes'
import { drawStudioClipNotes, studioClipNoteRange } from './clip-notes'

interface Shape {
  x: number
  y: number
  width: number
  height: number
}

interface Fill {
  shapes: Shape[]
  alpha: number
  style: string
  blur: number
}

/** A 2D context that records each fill with the shapes of its path. */
function recording() {
  const fills: Fill[] = []
  let path: Shape[] = []
  const context = {
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: '',
    beginPath() {
      path = []
    },
    rect(x: number, y: number, width: number, height: number) {
      path.push({ x, y, width, height })
    },
    roundRect(x: number, y: number, width: number, height: number) {
      path.push({ x, y, width, height })
    },
    fill() {
      fills.push({
        shapes: path,
        alpha: context.globalAlpha,
        style: String(context.fillStyle),
        blur: context.shadowBlur,
      })
    },
  }
  return { context, fills }
}

const note = (
  id: number,
  pitch: number,
  startTick: number,
  lengthTicks: number,
  velocity: number,
): StudioNote => ({ id, pitch, startTick, lengthTicks, velocity })

/** At 120 bpm a tick is 25 frames: 1920 ticks a second. */
const sequence = (notes: StudioNote[]): StudioSequence => ({
  id: 'sequence-1',
  ppq: 960,
  tempoBpm: 120,
  lengthTicks: 96_000,
  nextNoteId: notes.length + 1,
  notes,
})

/** The whole clip, from source frame 24000 (tick 960) to 120000 (tick 4800), drawn 960 px wide: a tick is 0.25 px. */
const FRAME: StudioClipNotesFrame = {
  clip: { sourceInFrame: 24_000, sourceOutFrame: 120_000 },
  sourceInFrame: 24_000,
  sourceOutFrame: 120_000,
  width: 960,
  height: 64,
}

/** The fills that draw the notes' bodies: after the glow, before the white edge. */
const bodies = (fills: Fill[]) =>
  fills.filter((fill) => fill.blur === 0 && fill.style !== '#ffffff')

describe('drawStudioClipNotes on a piano lane', () => {
  it('draws the notes its window plays where they sound, and leaves out one that starts before the window', () => {
    // Arrange
    const { context, fills } = recording()
    const notes = sequence([
      note(1, 60, 960, 960, 1),
      note(2, 64, 2880, 480, 1),
      note(3, 62, 480, 960, 1),
    ])

    // Act
    const drawn = drawStudioClipNotes(
      context,
      { sequence: notes, sound: 'piano' },
      FRAME,
      'rgb(60, 199, 180)',
    )

    // Assert: tick 960 is the clip's left edge; tick 2880 is 480 px in.
    expect(drawn).toBe(2)
    const shapes = bodies(fills).flatMap((fill) => fill.shapes)
    expect(shapes.map((shape) => Math.round(shape.x))).toEqual([0, 480])
    // A note 960 ticks long is 240 px, a pixel short for the gap after it.
    expect(shapes[0].width).toBeCloseTo(239, 6)
  })

  it('puts the higher note on the higher row', () => {
    const { context, fills } = recording()

    drawStudioClipNotes(
      context,
      {
        sequence: sequence([
          note(1, 60, 960, 240, 1),
          note(2, 67, 1200, 240, 1),
        ]),
        sound: 'piano',
      },
      FRAME,
      'red',
    )

    const [low, high] = bodies(fills)
      .flatMap((fill) => fill.shapes)
      .sort((a, b) => a.x - b.x)
    expect(high.y).toBeLessThan(low.y)
  })

  it('draws a note as bright as it was played: a soft one fainter than a loud one', () => {
    // Arrange
    const { context, fills } = recording()

    // Act
    drawStudioClipNotes(
      context,
      {
        sequence: sequence([
          note(1, 60, 960, 240, 0.1),
          note(2, 62, 1920, 240, 1),
        ]),
        sound: 'piano',
      },
      FRAME,
      'red',
    )

    // Assert
    const strength = (x: number) =>
      bodies(fills).find((fill) =>
        fill.shapes.some((shape) => Math.round(shape.x) === x),
      )!.alpha
    expect(strength(0)).toBeCloseTo(0.6, 6)
    expect(strength(240)).toBe(1)
  })

  it('walks only the notes its span shows, and draws ten thousand in a handful of fills', () => {
    // Arrange: a note every 9 ticks across the window; the draw spans its
    // second 960 ticks only (source frames 48000 to 72000).
    const { context, fills } = recording()
    const many = Array.from({ length: 10_000 }, (_, index) =>
      note(index + 1, 48 + (index % 24), 960 + index * 9, 6, 0.8),
    )
    const span: StudioClipNotesFrame = {
      ...FRAME,
      clip: { sourceInFrame: 24_000, sourceOutFrame: 2_400_000 },
      sourceInFrame: 48_000,
      sourceOutFrame: 72_000,
      width: 240,
    }

    const notes = {
      sequence: { ...sequence(many), lengthTicks: 120_000 },
      sound: 'piano' as const,
    }

    // Act
    const range = studioClipNoteRange(notes, span)
    const drawn = drawStudioClipNotes(context, notes, span, 'red')

    // Assert: ticks 1920 to 2880 hold 107 starts, and the walk starts a
    // longest note before the span, not at the clip's first note.
    expect(range.end - range.first).toBeLessThan(110)
    expect(range.first).toBeGreaterThan(100)
    expect(drawn).toBeGreaterThanOrEqual(107)
    expect(drawn).toBeLessThan(110)
    expect(fills.length).toBeLessThanOrEqual(7)
  })

  it('draws nothing for a clip whose window plays no note', () => {
    const { context, fills } = recording()

    const drawn = drawStudioClipNotes(
      context,
      { sequence: sequence([note(1, 60, 100, 240, 1)]), sound: 'piano' },
      FRAME,
      'red',
    )

    expect(drawn).toBe(0)
    expect(fills).toEqual([])
  })
})

describe('drawStudioClipNotes on a drum lane', () => {
  it('draws each hit a sixteenth note wide, the kick under the snare', () => {
    // Arrange: a kick and a snare, each held a whole beat.
    const { context, fills } = recording()

    // Act
    drawStudioClipNotes(
      context,
      {
        sequence: sequence([
          note(1, 36, 960, 960, 1),
          note(2, 38, 1920, 960, 1),
        ]),
        sound: 'drums',
      },
      FRAME,
      'red',
    )

    // Assert: 240 ticks is 60 px, a pixel short for the gap.
    const [kick, snare] = bodies(fills)
      .flatMap((fill) => fill.shapes)
      .sort((a, b) => a.x - b.x)
    expect(kick.width).toBeCloseTo(59, 6)
    expect(kick.y).toBeGreaterThan(snare.y)
  })
})
