// Studio MIDI roll keyboard tests — a piano row is its pitch and a kit row its place counted from the foot; the roll shows the rows wanted when they fit, fewer about their middle when a row would be too short, more when one would be too tall, and never past the keyboard or the kit; a scroll moves whole rows and stops at the edges; and the roll opens on the window's first bars with its rows fitted.
import { describe, expect, it } from 'vitest'
import { midiToY } from '@/lib/roll-geometry'
import { studioDrumRows } from './drum-rows'
import type { StudioRollRows } from './roll-keyboard'
import { scrollStudioRollRows, STUDIO_ROLL_ROWS_FINE, studioRollOpening, studioRollRow, studioRollRowPitch, studioRollShownRows, studioRollTopRow, } from './roll-keyboard'

const PIANO: StudioRollRows = { kind: 'piano' }
const KIT: StudioRollRows = { kind: 'drums', keys: studioDrumRows([]) }

describe('rows by number', () => {
  it('numbers a piano row by its pitch, and a kit row by its place counted from the foot', () => {
    expect(studioRollRow(PIANO, 61)).toBe(61)
    expect(studioRollTopRow(KIT)).toBe(7)
    // The crash heads the kit's list: the top row. The kick is its foot.
    expect(studioRollRow(KIT, 49)).toBe(7)
    expect(studioRollRow(KIT, 36)).toBe(0)
    expect(studioRollRow(KIT, 60)).toBeNull()
  })

  it('draws the first row of the kit at the top of the roll', () => {
    const viewport = {
      start: 0,
      end: 960,
      minMidi: 0,
      maxMidi: 7,
      width: 400,
      height: 160,
    }

    expect(midiToY(studioRollRow(KIT, 49)!, viewport)).toBe(0)
    expect(midiToY(studioRollRow(KIT, 36)!, viewport)).toBe(140)
  })

  it('gives back the pitch a row plays, and none past the edges', () => {
    expect(studioRollRowPitch(PIANO, 72)).toBe(72)
    expect(studioRollRowPitch(KIT, 1)).toBe(38)
    expect(studioRollRowPitch(KIT, 8)).toBeNull()
    expect(studioRollRowPitch(PIANO, 128)).toBeNull()
  })
})

describe('studioRollShownRows', () => {
  const limits = STUDIO_ROLL_ROWS_FINE

  it('shows the rows wanted when each gets a height between the limits', () => {
    expect(
      studioRollShownRows({ minMidi: 58, maxMidi: 69 }, 240, limits, 127),
    ).toEqual({ minMidi: 58, maxMidi: 69 })
  })

  it('shows fewer about their middle when a row would be shorter than the least height', () => {
    // 120 px at 12 px a row: 10 rows of the 25 wanted, about middle C.
    expect(
      studioRollShownRows({ minMidi: 48, maxMidi: 72 }, 120, limits, 127),
    ).toEqual({ minMidi: 56, maxMidi: 65 })
  })

  it('shows more when a row would be taller than the most height, and stops at the keyboard', () => {
    // 520 px at 26 px a row: 20 rows about the one note wanted.
    expect(
      studioRollShownRows({ minMidi: 58, maxMidi: 62 }, 520, limits, 127),
    ).toEqual({ minMidi: 51, maxMidi: 70 })
    expect(
      studioRollShownRows({ minMidi: 124, maxMidi: 127 }, 520, limits, 127),
    ).toEqual({ minMidi: 108, maxMidi: 127 })
  })

  it('shows a whole kit however tall its rows get', () => {
    expect(
      studioRollShownRows({ minMidi: 0, maxMidi: 7 }, 600, limits, 7),
    ).toEqual({ minMidi: 0, maxMidi: 7 })
  })
})

describe('scrollStudioRollRows', () => {
  const viewport = {
    start: 0,
    end: 960,
    minMidi: 55,
    maxMidi: 64,
    width: 400,
    height: 120,
  }

  it('moves whole rows and keeps how many show', () => {
    expect(scrollStudioRollRows(viewport, 2.4, 127)).toMatchObject({
      minMidi: 57,
      maxMidi: 66,
    })
  })

  it('stops at the top and the foot of the keyboard', () => {
    expect(scrollStudioRollRows(viewport, 200, 127)).toMatchObject({
      minMidi: 118,
      maxMidi: 127,
    })
    expect(scrollStudioRollRows(viewport, -200, 127)).toMatchObject({
      minMidi: 0,
      maxMidi: 9,
    })
  })

  it('gives the same viewport back when there is nowhere to go', () => {
    const top = { ...viewport, minMidi: 118, maxMidi: 127 }

    expect(scrollStudioRollRows(top, 3, 127)).toBe(top)
  })
})

describe('studioRollOpening', () => {
  const sequence = {
    notes: [
      { id: 1, pitch: 60, startTick: 960, lengthTicks: 480, velocity: 0.8 },
      { id: 2, pitch: 64, startTick: 30_000, lengthTicks: 480, velocity: 0.8 },
    ],
  }

  it("opens on the window's first span of ticks, its rows fitted to the notes the window plays", () => {
    const viewport = studioRollOpening({
      sequence,
      window: { startTick: 960, endTick: 96_000 },
      rows: PIANO,
      width: 800,
      height: 240,
      limits: STUDIO_ROLL_ROWS_FINE,
      span: 15_360,
    })

    // Notes 60 and 64 with two rows of air want 58 to 66; 240 px at 26 px
    // a row at the most shows ten.
    expect(viewport).toEqual({
      start: 960,
      end: 16_320,
      minMidi: 58,
      maxMidi: 67,
      width: 800,
      height: 240,
    })
  })

  it('opens on the whole window when it is shorter than the span', () => {
    const viewport = studioRollOpening({
      sequence,
      window: { startTick: 960, endTick: 4800 },
      rows: KIT,
      width: 800,
      height: 240,
      limits: STUDIO_ROLL_ROWS_FINE,
      span: 15_360,
    })

    expect(viewport).toMatchObject({
      start: 960,
      end: 4800,
      minMidi: 0,
      maxMidi: 7,
    })
  })
})
