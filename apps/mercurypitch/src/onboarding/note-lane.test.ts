// ============================================================
// The note lane: the voice as strokes, and the example line
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { DEMO_LOOP_SEC, DEMO_MIDI, DEMO_SEC, demoClock, demoFrames, HEAD_AT, laneFor, laneReference, midiOf, SPAN_CENTS, voiceStrokes, } from './note-lane'

const hzOf = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

const voice = (t: number, midi: number, rms = 0.1): PitchFrame => ({
  t,
  f0: hzOf(midi),
  conf: 0.95,
  rms,
})

describe('laneFor', () => {
  it('puts the head HEAD_AT across and the held note in the middle', () => {
    const lane = laneFor(400, 120)
    expect(lane.headX).toBe(Math.round(400 * HEAD_AT))
    expect(lane.midY).toBe(60)
    expect(lane.half).toBe(48)
    expect(lane.pxPerSec).toBe(88)
  })
})

describe('laneReference', () => {
  it('is the median of the recent voice, and null before any', () => {
    expect(laneReference([])).toBeNull()
    const frames = [voice(0, 50), voice(0.1, 57), voice(0.2, 57.2)]
    expect(laneReference(frames)).toBeCloseTo(57, 5)
    // Room tone is not the singer.
    expect(laneReference([{ t: 0, f0: 220, conf: 0.9, rms: 0.001 }])).toBeNull()
  })
})

describe('voiceStrokes', () => {
  const lane = laneFor(400, 120)

  it('draws the newest voice at the head, older voice to its left', () => {
    const frames = [voice(1, 57), voice(1.05, 57), voice(1.1, 57)]
    const [stroke] = voiceStrokes(frames, 1.1, lane, 57)
    const head = stroke[stroke.length - 1]
    expect(head.x).toBe(lane.headX)
    expect(head.y).toBeCloseTo(60, 5)
    expect(head.filling).toBe(true)
    expect(stroke[0].x).toBeCloseTo(lane.headX - 0.1 * lane.pxPerSec, 5)
  })

  it('lifts a sharper voice and holds it inside the lane', () => {
    const up = voiceStrokes([voice(0, 60), voice(0.02, 60)], 0.02, lane, 57)[0]
    expect(up[0].y).toBeCloseTo(60 - (300 / SPAN_CENTS) * lane.half, 5)
    const far = voiceStrokes([voice(0, 80), voice(0.02, 80)], 0.02, lane, 57)[0]
    expect(far[0].y).toBe(60 - lane.half)
  })

  it('breaks where the voice stopped', () => {
    const frames = [
      voice(0, 57),
      voice(0.02, 57),
      { t: 0.04, f0: 0, conf: 0, rms: 0.1 },
      voice(0.06, 57),
      voice(0.08, 57),
      voice(0.5, 57),
      voice(0.52, 57),
    ]
    expect(voiceStrokes(frames, 0.52, lane, 57)).toHaveLength(3)
  })

  it('keeps one line on a screen drawing a few frames a second', () => {
    // Six frames a second: the stream reads once a screen frame.
    const frames = [0, 0.16, 0.32, 0.48, 0.64].map((t) => voice(t, 57))
    const strokes = voiceStrokes(frames, 0.64, lane, 57)
    expect(strokes).toHaveLength(1)
    expect(strokes[0]).toHaveLength(5)
  })

  it('leaves out what has flowed off the left', () => {
    const frames = [
      voice(0, 57),
      voice(0.02, 57),
      voice(30, 57),
      voice(30.02, 57),
    ]
    const strokes = voiceStrokes(frames, 30.02, lane, 57)
    expect(strokes).toHaveLength(1)
    expect(strokes[0][0].x).toBeGreaterThan(0)
  })
})

describe('the example line', () => {
  it('scoops up to its note and holds it, to DEMO_SEC', () => {
    const frames = demoFrames(DEMO_SEC)
    expect(frames[0].t).toBe(0)
    expect(frames.at(-1)?.t).toBeLessThanOrEqual(DEMO_SEC)
    expect(midiOf(frames[0].f0)).toBeCloseTo(DEMO_MIDI - 2.5, 5)
    const held = frames.filter((frame) => frame.t > 0.6)
    for (const frame of held) {
      expect(Math.abs(midiOf(frame.f0) - DEMO_MIDI)).toBeLessThan(0.15)
    }
    expect(demoFrames(1).at(-1)?.t).toBeLessThanOrEqual(1)
  })

  it('draws, rests and draws again', () => {
    expect(demoClock(1)).toBe(1)
    expect(demoClock(DEMO_SEC + 0.5)).toBe(DEMO_SEC)
    expect(demoClock(DEMO_LOOP_SEC + 0.25)).toBeCloseTo(0.25, 5)
  })
})
