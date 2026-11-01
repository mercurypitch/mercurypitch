// Studio take timing — the round trip a take is trimmed by, where its clip lands, and the beat grid its count-in and click follow.
import { describe, expect, it } from 'vitest'
import type { StudioTakeCapture } from './take-timing'
import { DEFAULT_INPUT_SECONDS, placeStudioTake, studioBeatFrames, studioClickBeats, studioCountInSeconds, studioRoundTrip, takeFrameAt, takeTimeOf, } from './take-timing'

const RATE = 48000

describe('studioRoundTrip', () => {
  it('estimates the output path plus the reported input path when nothing was measured', () => {
    const trip = studioRoundTrip({
      pathSeconds: 0.0213 + 0.072,
      inputSeconds: 0.01,
      offsetMs: 0,
    })

    expect(trip.source).toBe('estimated')
    expect(trip.seconds).toBeCloseTo(0.1033, 6)
  })

  it('assumes a typical input path when the track reports none', () => {
    const trip = studioRoundTrip({ pathSeconds: 0.05, offsetMs: 0 })

    expect(trip.seconds).toBeCloseTo(0.05 + DEFAULT_INPUT_SECONDS, 6)
  })

  it('moves a measurement made on a shorter output path by the difference', () => {
    // Measured 60 ms on a clock whose path was 50 ms; the Studio's is 90 ms.
    const trip = studioRoundTrip({
      measuredMs: 60,
      measuredPathMs: 50,
      pathSeconds: 0.09,
      offsetMs: 0,
    })

    expect(trip.source).toBe('measured')
    expect(trip.seconds).toBeCloseTo(0.1, 6)
  })

  it('uses a measurement as it is when its clock was not kept', () => {
    const trip = studioRoundTrip({
      measuredMs: 60,
      measuredPathMs: null,
      pathSeconds: 0.09,
      offsetMs: 0,
    })

    expect(trip.seconds).toBeCloseTo(0.06, 6)
  })

  it('adds the singer offset and never trims a negative time', () => {
    const later = studioRoundTrip({ pathSeconds: 0.02, offsetMs: 15 })
    const clamped = studioRoundTrip({ pathSeconds: 0.02, offsetMs: -250 })

    expect(later.seconds).toBeCloseTo(0.02 + DEFAULT_INPUT_SECONDS + 0.015, 6)
    expect(later.baseSeconds).toBeCloseTo(0.02 + DEFAULT_INPUT_SECONDS, 6)
    expect(clamped.seconds).toBe(0)
  })

  it('ignores a nonsensical reported path', () => {
    const trip = studioRoundTrip({ pathSeconds: Number.NaN, offsetMs: 0 })

    expect(trip.seconds).toBeCloseTo(DEFAULT_INPUT_SECONDS, 6)
  })
})

describe('takeFrameAt and takeTimeOf', () => {
  it('relate song frames and clock time through one anchor, both ways', () => {
    const anchor = { frame: 96000, time: 3.25 }

    expect(takeFrameAt(anchor, 3.75)).toBe(120000)
    expect(takeTimeOf(anchor, 120000)).toBe(3.75)
    expect(takeFrameAt(anchor, takeTimeOf(anchor, 12345))).toBeCloseTo(12345, 6)
  })
})

describe('placeStudioTake', () => {
  // The song's frame 96000 (2 s) leaves the graph at 10 s on the clock.
  const anchor = { frame: 96000, time: 10 }
  const capture = (over: Partial<StudioTakeCapture>): StudioTakeCapture => ({
    anchor,
    startTime: 8,
    frames: 5 * RATE,
    roundTripSeconds: 0.05,
    fromFrame: 96000,
    ...over,
  })

  it('starts the clip on the playhead and keeps the count-in and the round trip in its trim', () => {
    // Captured from 8 s, two seconds of count-in before the playhead.
    const placement = placeStudioTake(capture({}))

    expect(placement).toEqual({
      startFrame: 96000,
      sourceInFrame: 2 * RATE + 0.05 * RATE,
      sourceOutFrame: 5 * RATE,
    })
  })

  it('lines a sung sample up with the song frame the singer heard', () => {
    const roundTrip = 0.0371
    const placement = placeStudioTake(capture({ roundTripSeconds: roundTrip }))!
    // A sample sung to song frame 144000 reaches the capture a round trip
    // after that frame left the graph.
    const sungAt = takeTimeOf(anchor, 144000) + roundTrip
    const sample = Math.round((sungAt - 8) * RATE)

    const timelineFrame =
      placement.startFrame + sample - placement.sourceInFrame

    expect(Math.abs(timelineFrame - 144000)).toBeLessThanOrEqual(1)
  })

  it('keeps everything captured for a take started while the song played', () => {
    const placement = placeStudioTake(
      capture({ startTime: 11, fromFrame: null, roundTripSeconds: 0.1 }),
    )

    // Heard while the first sample was sung: song frame 3 s less 0.1 s.
    expect(placement).toEqual({
      startFrame: 3 * RATE - 0.1 * RATE,
      sourceInFrame: 0,
      sourceOutFrame: 5 * RATE,
    })
  })

  it('starts late when the song began after the playhead was due', () => {
    // The song came in at 10.5 s, not 10 s: the anchor says so.
    const late = { frame: 96000, time: 10.5 }
    const placement = placeStudioTake(
      capture({ anchor: late, startTime: 10, roundTripSeconds: 0 }),
    )

    expect(placement?.startFrame).toBe(96000)
    expect(placement?.sourceInFrame).toBe(0.5 * RATE)
  })

  it('never starts before the song does', () => {
    const placement = placeStudioTake(
      capture({
        anchor: { frame: 0, time: 10 },
        fromFrame: null,
        startTime: 9,
      }),
    )

    expect(placement?.startFrame).toBe(0)
    expect(placement?.sourceInFrame).toBe(1 * RATE + 0.05 * RATE)
  })

  it('places nothing when the trim leaves no audio', () => {
    expect(placeStudioTake(capture({ frames: 2 * RATE }))).toBeNull()
    expect(placeStudioTake(capture({ frames: 0 }))).toBeNull()
  })
})

describe('the beat grid', () => {
  it('counts one bar of 4/4 in at 120 bpm as two seconds', () => {
    expect(studioCountInSeconds(120, 1)).toBe(2)
    expect(studioCountInSeconds(90, 2)).toBeCloseTo(8 * (60 / 90), 9)
    expect(studioBeatFrames(120)).toBe(24000)
  })

  it('gives the bar before the playhead as the count-in, accenting its downbeat', () => {
    // The playhead on bar 3's first beat (frame 192000 at 120 bpm).
    const beats = studioClickBeats(192000 - 96000, 192000, 120)

    expect(beats).toEqual([
      { frame: 96000, accent: true },
      { frame: 120000, accent: false },
      { frame: 144000, accent: false },
      { frame: 168000, accent: false },
    ])
  })

  it('reaches before the song start with the same grid', () => {
    const beats = studioClickBeats(-96000, 0, 120)

    expect(beats.map((beat) => beat.frame)).toEqual([
      -96000, -72000, -48000, -24000,
    ])
    expect(beats.map((beat) => beat.accent)).toEqual([
      true,
      false,
      false,
      false,
    ])
  })

  it('stays on the grid when the playhead is between beats', () => {
    const beats = studioClickBeats(10000, 106000, 120)

    expect(beats.map((beat) => beat.frame)).toEqual([
      24000, 48000, 72000, 96000,
    ])
    expect(beats[3].accent).toBe(true)
  })
})
