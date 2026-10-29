// The analysis a mic stage paints from: the level of the buffer the analyser
// holds, the note a voice lands (from its own YIN pass, or from a pitch the
// caller already has), and the graph it lets go of.

import { describe, expect, it } from 'vitest'
import { fakeCapture, sine } from './fake-capture.fixture'
import type { MicAnalysis, MicCheckLive, PitchInput } from './live-analysis'
import { createMicAnalysis, createMicLive, quietMicLive } from './live-analysis'
import { LAND_MS } from './note-tracker'

/** About one animation frame. */
const FRAME_MS = 16

/** Frames enough for a held note to land, with a few to spare. */
const HOLD_FRAMES = Math.ceil(LAND_MS / FRAME_MS) + 4

/** Reads `count` frames FRAME_MS apart. */
function readFrames(
  analysis: MicAnalysis,
  live: MicCheckLive,
  count: number,
  pitch?: PitchInput,
): void {
  for (let i = 0; i < count; i++) analysis.read(live, i * FRAME_MS, pitch)
}

describe('createMicAnalysis', () => {
  it('reads the level and the peak of the buffer the analyser holds', () => {
    // Arrange
    const capture = fakeCapture()
    const analysis = createMicAnalysis(capture.context, {} as MediaStream)
    const live = createMicLive()
    capture.play(sine(220, 0.5))

    // Act
    analysis.read(live, 0)

    // Assert
    expect(live.active).toBe(true)
    expect(live.rms).toBeCloseTo(0.5 / Math.SQRT2, 2)
    expect(live.peak).toBeCloseTo(0.5, 2)
  })

  it('lands a held A3 once from its own pitch pass, not once a frame', () => {
    // Arrange
    const capture = fakeCapture()
    const analysis = createMicAnalysis(capture.context, {} as MediaStream)
    const live = createMicLive()
    capture.play(sine(220, 0.3))

    // Act
    readFrames(analysis, live, HOLD_FRAMES * 2)

    // Assert
    expect(live.note?.midi).toBe(57)
    expect(live.onsets).toBe(1)
  })

  it('takes the pitch the caller hands it over the audio it hears', () => {
    // Arrange: the buffer is an A4, the caller's frame an A3.
    const capture = fakeCapture()
    const analysis = createMicAnalysis(capture.context, {} as MediaStream, {
      detectPitch: false,
    })
    const live = createMicLive()
    capture.play(sine(440, 0.3))

    // Act
    readFrames(analysis, live, HOLD_FRAMES, { f0: 220, clarity: 0.95 })

    // Assert
    expect(live.note?.midi).toBe(57)
  })

  it('hears no note with its own pass off and no pitch handed to it', () => {
    // Arrange
    const capture = fakeCapture()
    const analysis = createMicAnalysis(capture.context, {} as MediaStream, {
      detectPitch: false,
    })
    const live = createMicLive()
    capture.play(sine(220, 0.3))

    // Act
    readFrames(analysis, live, HOLD_FRAMES)

    // Assert
    expect(live.note).toBeNull()
    expect(live.onsets).toBe(0)
  })

  it('reaches the destination through a sink that stays silent', () => {
    // Arrange
    const capture = fakeCapture()

    // Act
    createMicAnalysis(capture.context, {} as MediaStream)

    // Assert: some WebKit versions only pull an analyser that reaches the
    // destination, and an audible sink would play the singer back to them.
    const sink = capture.nodes[2]
    expect(sink?.gain?.value).toBe(0)
    expect(sink?.connect).toHaveBeenCalledWith(capture.context.destination)
  })

  it('lets go of every node it made', () => {
    // Arrange
    const capture = fakeCapture()
    const analysis = createMicAnalysis(capture.context, {} as MediaStream)

    // Act
    analysis.dispose()

    // Assert
    expect(capture.nodes).toHaveLength(3)
    for (const node of capture.nodes) expect(node.disconnect).toHaveBeenCalled()
  })
})

describe('quietMicLive', () => {
  it('returns the stage to rest but keeps the count of landed notes', () => {
    // Arrange
    const capture = fakeCapture()
    const analysis = createMicAnalysis(capture.context, {} as MediaStream)
    const live = createMicLive()
    capture.play(sine(220, 0.3), 120)
    readFrames(analysis, live, HOLD_FRAMES)

    // Act
    quietMicLive(live)

    // Assert: a renderer tells a new note from a held one by the count.
    expect(live).toMatchObject({
      active: false,
      rms: 0,
      peak: 0,
      low: 0,
      mid: 0,
      high: 0,
      note: null,
      onsets: 1,
    })
  })
})
