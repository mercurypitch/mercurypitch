// ============================================================
// Whisper chunk planning, segment offsetting and hallucination
// detection — pure-function tests for useWhisperTranscription.
//
// The real model cannot run in CI, so these pin down the maths the
// 18-minute-stem regression exposed: every chunk must be a distinct
// window of the resampled buffer, absolute offsets must line up at
// chunk boundaries (incl. the last partial chunk), and a degenerate
// "same word repeated with ~20ms spans" result must be flagged.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { WhisperChunkPlanEntry } from '@/lib/useWhisperTranscription'
import { computeWhisperChunkPlan, detectWhisperHallucination, offsetWhisperSegments, sliceWhisperChunk, WHISPER_HALLUCINATION_MIN_SEGMENTS, } from '@/lib/useWhisperTranscription'
import type { WhisperSegment } from '@/lib/whisper-service'

const RATE = 16000
const CHUNK_LEN = 30 * RATE // 480_000
const STRIDE = 25 * RATE // 400_000

/** The owner-reported case: 1081.33s vocal stem resampled to 16 kHz. */
const EIGHTEEN_MIN_SAMPLES = 17_301_281

function assertPlanInvariants(plan: WhisperChunkPlanEntry[], total: number) {
  expect(plan.length).toBeGreaterThan(0)
  expect(plan[0].startSample).toBe(0)
  expect(plan[plan.length - 1].endSample).toBe(total)
  for (let i = 0; i < plan.length; i++) {
    const entry = plan[i]
    // No zero/negative-length chunks
    expect(entry.endSample).toBeGreaterThan(entry.startSample)
    // Absolute offset is exactly the start sample converted to seconds
    expect(entry.absoluteStartSec).toBe(entry.startSample / RATE)
    if (i > 0) {
      const prev = plan[i - 1]
      // Full coverage: no gap between consecutive chunks...
      expect(entry.startSample).toBeLessThanOrEqual(prev.endSample)
      // ...and every chunk contributes new samples (no duplicated ranges)
      expect(entry.endSample).toBeGreaterThan(prev.endSample)
    }
  }
}

describe('computeWhisperChunkPlan', () => {
  it('plans 44 contiguous overlapping chunks for the 1081.3s / 16kHz case', () => {
    const plan = computeWhisperChunkPlan(EIGHTEEN_MIN_SAMPLES)
    expect(plan).toHaveLength(44)
    assertPlanInvariants(plan, EIGHTEEN_MIN_SAMPLES)

    // Every full chunk strides by 25s and overlaps its predecessor by 5s
    for (let i = 0; i < plan.length; i++) {
      expect(plan[i].startSample).toBe(i * STRIDE)
      expect(plan[i].absoluteStartSec).toBe(i * 25)
    }
    expect(plan[0]).toEqual({
      startSample: 0,
      endSample: CHUNK_LEN,
      absoluteStartSec: 0,
    })
    expect(plan[1].startSample).toBe(STRIDE)
    expect(plan[0].endSample - plan[1].startSample).toBe(5 * RATE) // 5s overlap

    // Last partial chunk: starts at 1075s and covers the 6.33s tail
    const last = plan[43]
    expect(last).toEqual({
      startSample: 43 * STRIDE,
      endSample: EIGHTEEN_MIN_SAMPLES,
      absoluteStartSec: 1075,
    })
    expect(last.endSample - last.startSample).toBe(101_281)
  })

  it('returns a single chunk for buffers up to one chunk length', () => {
    expect(computeWhisperChunkPlan(1000)).toEqual([
      { startSample: 0, endSample: 1000, absoluteStartSec: 0 },
    ])
    expect(computeWhisperChunkPlan(CHUNK_LEN)).toEqual([
      { startSample: 0, endSample: CHUNK_LEN, absoluteStartSec: 0 },
    ])
  })

  it('skips a trailing window that would add no new samples', () => {
    // 450_000 samples: the stride step at 400_000 lies fully inside chunk 0
    const plan = computeWhisperChunkPlan(450_000)
    expect(plan).toEqual([
      { startSample: 0, endSample: 450_000, absoluteStartSec: 0 },
    ])

    // 880_000 samples: chunk 1 already ends at the buffer end, so the
    // stride step at 800_000 is redundant
    const plan2 = computeWhisperChunkPlan(880_000)
    expect(plan2).toEqual([
      { startSample: 0, endSample: CHUNK_LEN, absoluteStartSec: 0 },
      { startSample: STRIDE, endSample: 880_000, absoluteStartSec: 25 },
    ])
    assertPlanInvariants(plan2, 880_000)
  })

  it('keeps a trailing window that extends coverage, however small', () => {
    const plan = computeWhisperChunkPlan(CHUNK_LEN + 1)
    expect(plan).toEqual([
      { startSample: 0, endSample: CHUNK_LEN, absoluteStartSec: 0 },
      { startSample: STRIDE, endSample: CHUNK_LEN + 1, absoluteStartSec: 25 },
    ])
    assertPlanInvariants(plan, CHUNK_LEN + 1)
  })

  it('supports custom rate/chunk/overlap parameters', () => {
    const plan = computeWhisperChunkPlan(25_000, 1000, 10, 2)
    expect(plan).toEqual([
      { startSample: 0, endSample: 10_000, absoluteStartSec: 0 },
      { startSample: 8000, endSample: 18_000, absoluteStartSec: 8 },
      { startSample: 16_000, endSample: 25_000, absoluteStartSec: 16 },
    ])
  })

  it('returns an empty plan for empty or invalid buffer lengths', () => {
    expect(computeWhisperChunkPlan(0)).toEqual([])
    expect(computeWhisperChunkPlan(-5)).toEqual([])
    expect(computeWhisperChunkPlan(Number.NaN)).toEqual([])
  })

  it('throws on configurations that could never terminate or divide', () => {
    expect(() => computeWhisperChunkPlan(1000, 16000, 30, 30)).toThrow()
    expect(() => computeWhisperChunkPlan(1000, 16000, 5, 30)).toThrow()
    expect(() => computeWhisperChunkPlan(1000, 16000, 30, -1)).toThrow()
    expect(() => computeWhisperChunkPlan(1000, 0)).toThrow()
    expect(() => computeWhisperChunkPlan(1000, -16000)).toThrow()
    expect(() => computeWhisperChunkPlan(1000, 16000, Number.NaN, 5)).toThrow()
  })
})

describe('sliceWhisperChunk', () => {
  it('copies exactly the planned [start, end) window — a different window per chunk', () => {
    const total = 25_000
    const audio = new Float32Array(total)
    for (let i = 0; i < total; i++) audio[i] = i
    const plan = computeWhisperChunkPlan(total, 1000, 10, 2)

    for (const entry of plan) {
      const chunk = sliceWhisperChunk(audio, entry)
      expect(chunk.length).toBe(entry.endSample - entry.startSample)
      expect(chunk[0]).toBe(entry.startSample)
      expect(chunk[chunk.length - 1]).toBe(entry.endSample - 1)
    }

    // Consecutive chunks are NOT the same window
    const first = sliceWhisperChunk(audio, plan[0])
    const second = sliceWhisperChunk(audio, plan[1])
    expect(second[0]).not.toBe(first[0])
    expect(second[0]).toBe(plan[1].startSample)
  })

  it('returns an independent copy, not a view into the source buffer', () => {
    const audio = new Float32Array([1, 2, 3, 4])
    const chunk = sliceWhisperChunk(audio, {
      startSample: 1,
      endSample: 3,
      absoluteStartSec: 0,
    })
    expect(Array.from(chunk)).toEqual([2, 3])
    expect(chunk.buffer).not.toBe(audio.buffer)
    chunk[0] = 99
    expect(audio[1]).toBe(2)
  })
})

describe('offsetWhisperSegments', () => {
  it('shifts both timestamps by the chunk absolute start', () => {
    const out = offsetWhisperSegments(
      [
        { text: ' hello', timestamp: [1, 1.5] },
        { text: ' world', timestamp: [1.5, 2.25] },
      ],
      1075,
    )
    expect(out).toEqual([
      { text: ' hello', timestamp: [1076, 1076.5] },
      { text: ' world', timestamp: [1076.5, 1077.25] },
    ])
  })

  it('leaves timestamps unchanged for the first chunk (offset 0)', () => {
    const out = offsetWhisperSegments(
      [{ text: ' a', timestamp: [0.2, 0.7] }],
      0,
    )
    expect(out).toEqual([{ text: ' a', timestamp: [0.2, 0.7] }])
  })

  it('clamps a null end timestamp to the start instead of coercing it to 0', () => {
    // transformers.js emits [start, null] for a truncated final segment;
    // `null + offset` used to produce an inverted [start+off, off] segment.
    const out = offsetWhisperSegments(
      [{ text: ' tail', timestamp: [3.2, null] }],
      25,
    )
    expect(out).toEqual([{ text: ' tail', timestamp: [28.2, 28.2] }])
  })

  it('clamps an inverted end timestamp to the start', () => {
    const out = offsetWhisperSegments([{ text: ' x', timestamp: [5, 2] }], 25)
    expect(out).toEqual([{ text: ' x', timestamp: [30, 30] }])
  })

  it('drops malformed entries and tolerates a missing list', () => {
    expect(offsetWhisperSegments(null, 25)).toEqual([])
    expect(offsetWhisperSegments(undefined, 25)).toEqual([])
    expect(
      offsetWhisperSegments(
        [
          null,
          'nonsense',
          { timestamp: [0, 1] }, // no text
          { text: ' no-timestamp' },
          { text: ' bad-start', timestamp: [Number.NaN, 1] },
          { text: ' ok', timestamp: [0, 1] },
        ],
        10,
      ),
    ).toEqual([{ text: ' ok', timestamp: [10, 11] }])
  })
})

describe('detectWhisperHallucination', () => {
  const repeated = (
    count: number,
    text = ' idea.',
    durationSec = 0.02,
  ): WhisperSegment[] =>
    Array.from({ length: count }, (_, i) => ({
      text,
      timestamp: [13 + i * 0.05, 13 + i * 0.05 + durationSec] as [
        number,
        number,
      ],
    }))

  it('flags the owner-reported signature: ~410 identical 20ms segments', () => {
    const check = detectWhisperHallucination(repeated(410))
    expect(check.detected).toBe(true)
    expect(check.reason).toBe('repeated-text')
    expect(check.segmentCount).toBe(410)
    expect(check.dominantText).toBe('idea')
    expect(check.dominantRatio).toBe(1)
    expect(check.medianDurationSec).toBeCloseTo(0.02, 5)
  })

  it('flags repeated text above the 60% threshold even with healthy durations', () => {
    const segments: WhisperSegment[] = [
      ...repeated(7, ' oh', 0.3),
      { text: ' hello', timestamp: [100, 100.3] },
      { text: ' there', timestamp: [101, 101.3] },
      { text: ' friend', timestamp: [102, 102.3] },
    ]
    const check = detectWhisperHallucination(segments)
    expect(check.dominantRatio).toBeCloseTo(0.7, 5)
    expect(check.detected).toBe(true)
    expect(check.reason).toBe('repeated-text')
  })

  it('does not flag at exactly 60% repeated text (threshold is strict)', () => {
    const segments: WhisperSegment[] = [
      ...repeated(12, ' la', 0.3),
      ...Array.from({ length: 8 }, (_, i) => ({
        text: ` word${String(i)}`,
        timestamp: [100 + i, 100 + i + 0.3] as [number, number],
      })),
    ]
    const check = detectWhisperHallucination(segments)
    expect(check.dominantRatio).toBeCloseTo(0.6, 5)
    expect(check.detected).toBe(false)
    expect(check.reason).toBeNull()
  })

  it('flags distinct texts whose median duration is degenerate (<100ms)', () => {
    const segments: WhisperSegment[] = Array.from({ length: 20 }, (_, i) => ({
      text: ` word${String(i)}`,
      timestamp: [i, i + 0.01] as [number, number],
    }))
    const check = detectWhisperHallucination(segments)
    expect(check.detected).toBe(true)
    expect(check.reason).toBe('degenerate-durations')
    expect(check.medianDurationSec).toBeCloseTo(0.01, 5)
  })

  it('does not flag median durations at or above 100ms', () => {
    // 0.125 is exactly representable in binary floating point, so the
    // computed durations sit unambiguously above the 0.1s threshold.
    const segments: WhisperSegment[] = Array.from({ length: 20 }, (_, i) => ({
      text: ` word${String(i)}`,
      timestamp: [i, i + 0.125] as [number, number],
    }))
    const check = detectWhisperHallucination(segments)
    expect(check.medianDurationSec).toBe(0.125)
    expect(check.detected).toBe(false)
  })

  it('never fires below the minimum segment count', () => {
    const check = detectWhisperHallucination(
      repeated(WHISPER_HALLUCINATION_MIN_SEGMENTS - 1),
    )
    expect(check.detected).toBe(false)
    expect(check.reason).toBeNull()
    // Same junk at the minimum count IS flagged
    expect(
      detectWhisperHallucination(repeated(WHISPER_HALLUCINATION_MIN_SEGMENTS))
        .detected,
    ).toBe(true)
  })

  it('accepts a healthy transcription', () => {
    const words =
      'is this the real life is it just fantasy caught in a landslide no escape from reality'.split(
        ' ',
      )
    const segments: WhisperSegment[] = words.map((word, i) => ({
      text: ` ${word}`,
      timestamp: [i * 0.5, i * 0.5 + 0.35] as [number, number],
    }))
    const check = detectWhisperHallucination(segments)
    expect(check.detected).toBe(false)
    expect(check.reason).toBeNull()
    expect(check.medianDurationSec).toBeCloseTo(0.35, 5)
    expect(check.dominantRatio).toBeLessThan(0.2)
  })

  it('normalizes case, punctuation and accents before comparing texts', () => {
    const segments: WhisperSegment[] = [
      { text: ' Idea.', timestamp: [0, 0.3] },
      { text: 'idea', timestamp: [1, 1.3] },
      { text: ' IDEA!!', timestamp: [2, 2.3] },
      { text: ' idéa ', timestamp: [3, 3.3] },
      { text: ' Idea…', timestamp: [4, 4.3] },
      { text: 'idea', timestamp: [5, 5.3] },
      { text: ' idea', timestamp: [6, 6.3] },
      { text: 'IDEA', timestamp: [7, 7.3] },
    ]
    const check = detectWhisperHallucination(segments)
    expect(check.dominantText).toBe('idea')
    expect(check.dominantRatio).toBe(1)
    expect(check.detected).toBe(true)
  })

  it('returns inert stats for an empty segment list', () => {
    expect(detectWhisperHallucination([])).toEqual({
      detected: false,
      reason: null,
      segmentCount: 0,
      dominantText: '',
      dominantRatio: 0,
      medianDurationSec: 0,
    })
  })
})
