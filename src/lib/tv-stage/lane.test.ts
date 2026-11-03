// ============================================================
// TV stage lane tests — the ribbon on a TV, drawn and placed
// ============================================================
//
// Where things go is checked as numbers (laneGeometry, noteBoxes); what is
// drawn, on the recording canvas (recording-context.fixture.ts), whose
// sprites are labelled with their keys: which note looks were stamped, the
// singer's curve drawn as curve pieces, the dot in the verdict's colour, the
// note under the marker named, and the C lines named.

import { describe, expect, it } from 'vitest'
import type { LaneGeometry } from '@/lib/tv-stage/lane'
import { drawLane, laneFrame, laneGeometry, noteBoxes, noteName, pitchY, timeX, } from '@/lib/tv-stage/lane'
import { LANE_NOW_RATIO } from '@/lib/tv-stage/lane-band'
import { tvStageLayout } from '@/lib/tv-stage/layout'
import type { TvStageState } from '@/lib/tv-stage/model'
import { LONG_AGO } from '@/lib/tv-stage/model'
import type { TvStageNote, TvStageReading } from '@/lib/tv-stage/protocol'
import { recordingContext, recordingSprites, } from '@/lib/tv-stage/recording-context.fixture'
import { createSpriteCache } from '@/lib/tv-stage/sprites'

const LAYOUT = tvStageLayout(1920, 1080)
const LANE: LaneGeometry = laneGeometry(LAYOUT)

const NOTES: TvStageNote[] = [
  { t0: 9, t1: 10.5, midi: 64 },
  { t0: 10.6, t1: 11, midi: 72 },
  { t0: 11.2, t1: 12, midi: 60 },
  { t0: 30, t1: 31, midi: 67 },
]

/** Readings every 30 ms from `from` to `to`, at `midi`. */
function sung(from: number, to: number, midi: number): TvStageReading[] {
  const readings: TvStageReading[] = []
  for (let time = from; time <= to + 1e-9; time += 0.03) {
    readings.push([Math.round(time * 1000) / 1000, midi])
  }
  return readings
}

function stateAt(trail: readonly TvStageReading[]): TvStageState {
  return {
    song: {
      v: 1,
      kind: 'song',
      title: 'River Road',
      duration: 60,
      notes: NOTES,
      lyrics: [],
    },
    clock: { at: 0, position: 10, playing: true, rate: 1 },
    trail,
    score: null,
    turn: LONG_AGO,
  }
}

function draw(trail: readonly TvStageReading[], position = 10) {
  const recording = recordingContext()
  const sprites = createSpriteCache(recordingSprites().factory)
  drawLane(recording.ctx, LAYOUT, stateAt(trail), position, sprites)
  return recording
}

describe('the lane’s place', () => {
  it('puts the now marker where the ribbon has it, and 7 s across the panel', () => {
    expect(LANE.nowX).toBeCloseTo(
      LAYOUT.lane.x + LAYOUT.lane.w * LANE_NOW_RATIO,
      9,
    )
    expect(timeX(LANE, 10, 10)).toBe(LANE.nowX)
    expect(timeX(LANE, 8.5, 10)).toBeCloseTo(LAYOUT.lane.x, 9)
    expect(timeX(LANE, 15.5, 10)).toBeCloseTo(LAYOUT.lane.x + LAYOUT.lane.w, 9)
  })

  it('draws a pitch higher the higher it is, and keeps it to the band', () => {
    const band = { low: 50, high: 70 }

    expect(pitchY(LANE, band, 70)).toBe(LANE.top)
    expect(pitchY(LANE, band, 50)).toBe(LANE.bottom)
    expect(pitchY(LANE, band, 64)).toBeLessThan(pitchY(LANE, band, 60))
    expect(pitchY(LANE, band, 90)).toBe(LANE.top)
  })

  it('names a note by its MIDI number', () => {
    expect([noteName(57), noteName(60), noteName(61), noteName(48)]).toEqual([
      'A3',
      'C4',
      'C#4',
      'C3',
    ])
  })
})

describe('the notes', () => {
  it('places each note in view at its real pitch: an octave apart is an octave higher', () => {
    const boxes = noteBoxes(LANE, laneFrame(stateAt([]), 10))

    expect(boxes.map((box) => box.note.midi)).toEqual([64, 72, 60])
    const [e4, c5, c4] = boxes
    expect(c5.y).toBeLessThan(e4.y)
    expect(e4.y).toBeLessThan(c4.y)
    expect(c4.y - c5.y).toBeGreaterThan(0)
    expect(e4.x0).toBeCloseTo(timeX(LANE, 9, 10), 9)
    expect(e4.x1).toBeCloseTo(timeX(LANE, 10.5, 10), 9)
  })

  it('lights a note where it was sung on pitch, and not where it was sung off', () => {
    const onPitch = noteBoxes(
      LANE,
      laneFrame(stateAt(sung(9.2, 9.9, 64.1)), 10),
    )
    const offPitch = noteBoxes(
      LANE,
      laneFrame(stateAt(sung(9.2, 9.9, 65.2)), 10),
    )

    expect(onPitch[0].lit).toHaveLength(1)
    expect(onPitch[0].lit[0][0]).toBeCloseTo(timeX(LANE, 9.15, 10), 6)
    expect(offPitch[0].lit).toEqual([])
  })

  it('stamps the yellow glass ahead, the lit glass where it was sung, and an empty tube once a note has gone unsung', () => {
    const { images } = draw(sung(9.2, 9.9, 64.1), 10.8)
    const looks = new Set(
      images
        .map((image) => /^note:(\w+):/u.exec(image.key)?.[1])
        .filter((look) => look !== undefined),
    )

    expect([...looks].sort()).toEqual(['glass', 'lit', 'past'])
  })
})

describe('the singer', () => {
  it('is drawn as one smooth curve, in curve pieces', () => {
    const { curves } = draw(sung(8.8, 9.9, 64))

    expect(curves()).toBeGreaterThan(20)
  })

  it('ends in a dot in the colour of the verdict', () => {
    const dots = (trail: readonly TvStageReading[], position = 10) =>
      draw(trail, position)
        .images.filter((image) => image.key.startsWith('dot:'))
        .map((image) => image.key.split(':')[1])

    expect(dots(sung(9.2, 9.95, 64.1))).toEqual(['hit'])
    expect(dots(sung(9.2, 9.95, 65.2))).toEqual(['off'])
    // Between two notes: sung, not judged.
    expect(dots(sung(10.51, 10.57, 64.1), 10.58)).toEqual(['free'])
    // Stopped singing more than half a second ago: no dot.
    expect(dots(sung(9, 9.3, 64.1))).toEqual([])
  })
})

describe('the names', () => {
  it('names the note under the now marker, and none in a rest', () => {
    const named = (position: number) =>
      draw([], position).texts.map((text) => text.text)

    expect(named(10)).toContain('E4')
    expect(named(20)).not.toContain('G4')
    expect(named(20).filter((text) => /^[A-G]#?\d$/u.test(text))).toEqual(
      named(20).filter((text) => text.startsWith('C')),
    )
  })

  it('names each C in the band at the panel’s left, and nothing else', () => {
    const texts = draw([], 10).texts.filter((text) => text.x < LANE.nowX - 60)

    expect(texts.map((text) => text.text)).toEqual(['C4', 'C5'])
  })
})
