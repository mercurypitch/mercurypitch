// ============================================================
// YIN core tests — including the parity that keeps two threads honest
// ============================================================
//
// `createYinFrameAnalyser` runs inside an AudioWorklet, where PitchDetector
// cannot follow it (that module reaches ONNX, which reaches the network). The
// two therefore share `analyseYinBuffer` and `createPitchStabiliser` but keep
// their own copy of the surrounding gate order. The parity block below is what
// stops those copies drifting: it runs both over the same buffers and demands
// the same numbers, so a change to one that is not made to the other goes red
// here rather than in a mic session nobody is watching.

import { describe, expect, it } from 'vitest'
import { PitchDetector } from '@/lib/pitch-detector'
import { analyseYinBuffer, bufferRms, createPitchStabiliser, createYinFrameAnalyser, } from '@/lib/pitch-yin-core'

const SAMPLE_RATE = 48000
const BUFFER_SIZE = 2048

/** The detector settings `createF0Stream` runs with on both threads. */
const STREAM_DETECTOR = {
  sampleRate: SAMPLE_RATE,
  bufferSize: BUFFER_SIZE,
  sensitivity: 7,
  minFrequency: 60,
  maxFrequency: 1600,
  minAmplitude: 0.005,
  minConfidence: 0.3,
}

/** A sine plus two harmonics, matching the e2e fake microphone's shape. */
function voiceLike(
  frequency: number,
  amplitude = 0.5,
  phase = 0,
): Float32Array {
  const buffer = new Float32Array(BUFFER_SIZE)
  for (let i = 0; i < BUFFER_SIZE; i++) {
    const t = (i + phase) / SAMPLE_RATE
    buffer[i] =
      amplitude *
      (Math.sin(2 * Math.PI * frequency * t) +
        0.4 * Math.sin(4 * Math.PI * frequency * t) +
        0.2 * Math.sin(6 * Math.PI * frequency * t))
  }
  return buffer
}

function noise(amplitude: number, seed = 1): Float32Array {
  const buffer = new Float32Array(BUFFER_SIZE)
  let state = seed
  for (let i = 0; i < BUFFER_SIZE; i++) {
    state = (state * 1664525 + 1013904223) % 4294967296
    buffer[i] = ((state / 4294967296) * 2 - 1) * amplitude
  }
  return buffer
}

/**
 * A take's worth of buffers: silence, a held note, an octave jump, an outlier
 * frame, near-silence and noise. Every branch the two implementations share is
 * on this path, including the stability window's note-change flush.
 */
function takeBuffers(): Float32Array[] {
  const buffers: Float32Array[] = []
  buffers.push(new Float32Array(BUFFER_SIZE))
  for (let i = 0; i < 6; i++) buffers.push(voiceLike(220, 0.5, i * 512))
  for (let i = 0; i < 6; i++) buffers.push(voiceLike(440, 0.5, i * 512))
  buffers.push(voiceLike(880, 0.5))
  for (let i = 0; i < 3; i++) buffers.push(voiceLike(440, 0.5, i * 128))
  buffers.push(voiceLike(220, 0.002))
  buffers.push(noise(0.3))
  buffers.push(noise(0.3, 99))
  for (let i = 0; i < 4; i++) buffers.push(voiceLike(110, 0.4, i * 256))
  buffers.push(voiceLike(2000, 0.5))
  return buffers
}

describe('bufferRms', () => {
  it('is zero for silence and the amplitude for a square wave', () => {
    expect(bufferRms(new Float32Array(64))).toBe(0)
    const square = new Float32Array(64).fill(0.25)
    expect(bufferRms(square)).toBeCloseTo(0.25, 12)
  })
})

describe('analyseYinBuffer', () => {
  it('finds a held 220 Hz tone within a cent', () => {
    const scratch = new Float32Array(BUFFER_SIZE / 2)
    const result = analyseYinBuffer(voiceLike(220), scratch, STREAM_DETECTOR)
    expect(result.frequency).toBeCloseTo(220, 0)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('reports nothing for a tone above the search range', () => {
    const scratch = new Float32Array(BUFFER_SIZE / 2)
    const result = analyseYinBuffer(voiceLike(220), scratch, {
      ...STREAM_DETECTOR,
      minFrequency: 400,
      maxFrequency: 1600,
    })
    expect(result.frequency).toBe(0)
  })
})

describe('createPitchStabiliser', () => {
  it('replaces a lone outlier with the median of its window', () => {
    const stabiliser = createPitchStabiliser()
    for (const hz of [220, 221, 220, 220]) stabiliser.stabilise(hz)
    // 400 Hz is 80% away from a window sitting on 220: one bad frame, not a note.
    expect(stabiliser.stabilise(400)).toBeCloseTo(220, 0)
  })

  it('lets two consistent readings confirm a real note change', () => {
    const stabiliser = createPitchStabiliser()
    for (const hz of [220, 221, 220, 220]) stabiliser.stabilise(hz)
    // The first frame at the new note is still pulled back toward the old one;
    // the second confirms the change and passes straight through.
    expect(stabiliser.stabilise(330)).toBeLessThan(240)
    expect(stabiliser.stabilise(331)).toBeCloseTo(331, 0)
  })

  it('forgets its window on reset', () => {
    const stabiliser = createPitchStabiliser()
    for (const hz of [220, 220, 220]) stabiliser.stabilise(hz)
    expect(stabiliser.size()).toBe(3)
    stabiliser.reset()
    expect(stabiliser.size()).toBe(0)
    // With no history the first reading is passed straight through.
    expect(stabiliser.stabilise(900)).toBe(900)
  })

  it('passes everything through when disabled', () => {
    const stabiliser = createPitchStabiliser({ enabled: false })
    for (const hz of [220, 220, 220, 220]) stabiliser.stabilise(hz)
    expect(stabiliser.stabilise(900)).toBe(900)
  })
})

describe('createYinFrameAnalyser', () => {
  it('rejects a buffer under the RMS gate without inventing a pitch', () => {
    const analyser = createYinFrameAnalyser(STREAM_DETECTOR)
    const frame = analyser.analyse(voiceLike(220, 0.001))
    expect(frame.accepted).toBe(false)
    expect(frame.frequency).toBe(0)
    expect(frame.confidence).toBe(0)
    expect(frame.rms).toBeGreaterThan(0)
  })

  it('accepts a held tone and reports its level', () => {
    const analyser = createYinFrameAnalyser(STREAM_DETECTOR)
    const frame = analyser.analyse(voiceLike(220))
    expect(frame.accepted).toBe(true)
    expect(frame.frequency).toBeCloseTo(220, 0)
    expect(frame.confidence).toBeGreaterThanOrEqual(frame.confidenceFloor)
    expect(frame.rms).toBeCloseTo(bufferRms(voiceLike(220)), 12)
  })
})

describe('parity with PitchDetector', () => {
  it('returns the same frequency and clarity for every frame of a take', () => {
    const analyser = createYinFrameAnalyser(STREAM_DETECTOR)
    const detector = new PitchDetector({ ...STREAM_DETECTOR, algorithm: 'yin' })
    const buffers = takeBuffers()

    const mine = buffers.map((buffer) => {
      const frame = analyser.analyse(buffer)
      return { frequency: frame.frequency, clarity: frame.confidence }
    })
    const theirs = buffers.map((buffer) => {
      const result = detector.detect(buffer)
      return { frequency: result.frequency, clarity: result.clarity }
    })

    expect(mine).toEqual(theirs)
    // A parity test over frames that are all rejected proves nothing.
    expect(mine.filter((frame) => frame.frequency > 0).length).toBeGreaterThan(
      10,
    )
  })

  it('agrees again after both are reset mid-take', () => {
    const analyser = createYinFrameAnalyser(STREAM_DETECTOR)
    const detector = new PitchDetector({ ...STREAM_DETECTOR, algorithm: 'yin' })
    const buffers = takeBuffers()

    for (const buffer of buffers.slice(0, 8)) {
      analyser.analyse(buffer)
      detector.detect(buffer)
    }
    analyser.reset()
    detector.resetHistory()

    for (const buffer of buffers) {
      const frame = analyser.analyse(buffer)
      const result = detector.detect(buffer)
      expect(frame.frequency).toBe(result.frequency)
      expect(frame.confidence).toBe(result.clarity)
    }
  })
})
