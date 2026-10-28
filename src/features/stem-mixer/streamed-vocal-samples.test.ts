// ============================================================
// A streamed vocal's samples, gathered for the pitch analysis
// ============================================================
//
// The phone that streams a song finds its notes from the stream's decoded
// chunks (streamed-vocal-samples.ts). What the analysis gets has to be the
// vocal, in its place on the song's clock: a chunk out of place would put
// every note after it at the wrong time, and a long song held whole would
// be the memory the stream exists to avoid.

import { describe, expect, it } from 'vitest'
import { canGatherStreamedVocal, gatherStreamedVocal, STREAMED_ANALYSIS_MAX_BYTES, streamedAnalysisStep, streamedTooLongMessage, wholeDecodeFits, windowForStep, } from './streamed-vocal-samples'
import type { StemStreamChunk } from './streaming-stem-voice'

/** A decoded chunk: `values` on channel 0 from `timestamp`, at `rate`. */
function chunk(
  timestamp: number,
  values: number[],
  rate: number,
): StemStreamChunk {
  const data = Float32Array.from(values)
  const buffer = {
    sampleRate: rate,
    length: data.length,
    numberOfChannels: 2,
    duration: data.length / rate,
    getChannelData: (channel: number) =>
      channel === 0 ? data : new Float32Array(data.length).fill(9),
  } as unknown as AudioBuffer
  return { buffer, timestamp }
}

/** A stream of `seconds` at `rate` that yields `chunks`, from wherever asked. */
function source(
  seconds: number,
  rate: number,
  chunks: StemStreamChunk[],
): {
  sampleRate: number
  durationSeconds: number
  opened: number[]
  chunks(from: number): AsyncIterable<StemStreamChunk>
} {
  const opened: number[] = []
  return {
    sampleRate: rate,
    durationSeconds: seconds,
    opened,
    chunks(from: number) {
      opened.push(from)
      return (async function* () {
        for (const each of chunks) {
          await Promise.resolve()
          yield each
        }
      })()
    },
  }
}

describe('streamedAnalysisStep', () => {
  it('keeps every sample of a pop song', () => {
    // Four minutes of one channel at 44.1 kHz: some 42 MB, under 64 MiB.
    expect(streamedAnalysisStep(240, 44_100)).toBe(1)
  })

  it('keeps every second sample of a long song, and every fourth of a longer one', () => {
    // Ten minutes at 48 kHz whole is 115 MB; half of it fits.
    expect(streamedAnalysisStep(600, 48_000)).toBe(2)
    // Twenty minutes at 48 kHz: a quarter of it fits.
    expect(streamedAnalysisStep(1200, 48_000)).toBe(4)
  })

  it('refuses a song too long even at every fourth sample, or one of no length', () => {
    expect(streamedAnalysisStep(3600, 48_000)).toBeNull()
    expect(streamedAnalysisStep(0, 48_000)).toBeNull()
    expect(streamedAnalysisStep(Number.NaN, 48_000)).toBeNull()
    expect(streamedAnalysisStep(240, 0)).toBeNull()
  })

  it('is the same answer canGatherStreamedVocal gives', () => {
    expect(canGatherStreamedVocal(source(240, 44_100, []))).toBe(true)
    expect(canGatherStreamedVocal(source(3600, 48_000, []))).toBe(false)
  })

  it('stays within the ceiling at every answer', () => {
    for (const seconds of [60, 360, 400, 700, 1300, 1500]) {
      const step = streamedAnalysisStep(seconds, 48_000)
      if (step === null) continue
      expect(Math.ceil((seconds * 48_000) / step) * 4).toBeLessThanOrEqual(
        STREAMED_ANALYSIS_MAX_BYTES,
      )
    }
  })
})

describe('wholeDecodeFits', () => {
  const MIB = 1024 * 1024

  it('decodes whole only a song the walk would keep every sample of', () => {
    // Five minutes at 44.1 kHz: one channel is 53 MB, under 64 MiB.
    expect(wholeDecodeFits(300, 9 * MIB, 44_100)).toBe(true)
    // Seven minutes would stream at every second sample; a decode cannot.
    expect(wholeDecodeFits(420, 9 * MIB, 44_100)).toBe(false)
    expect(wholeDecodeFits(3600, 9 * MIB, 44_100)).toBe(false)
  })

  it('holds a stem of no known length to the size the mixer decodes whole', () => {
    expect(wholeDecodeFits(null, 12 * MIB, 44_100)).toBe(true)
    expect(wholeDecodeFits(null, 12 * MIB + 1, 44_100)).toBe(false)
  })
})

describe('windowForStep', () => {
  it('spans the same time at the kept rate, and never under 256', () => {
    expect(windowForStep(1024, 1)).toBe(1024)
    expect(windowForStep(1024, 2)).toBe(512)
    expect(windowForStep(1024, 4)).toBe(256)
    expect(windowForStep(512, 4)).toBe(256)
  })
})

describe('gatherStreamedVocal', () => {
  it('keeps channel 0, every chunk in its place, from the start of the song', async () => {
    const stream = source(1, 8, [
      chunk(0, [1, 2, 3, 4], 8),
      chunk(0.5, [5, 6, 7, 8], 8),
    ])

    const gathered = await gatherStreamedVocal(stream)

    expect(stream.opened).toEqual([0])
    expect(gathered.step).toBe(1)
    expect(gathered.sampleRate).toBe(8)
    expect(Array.from(gathered.samples)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('leaves a gap the decoder left silent, rather than pulling later audio early', async () => {
    const stream = source(1, 8, [chunk(0, [1, 2], 8), chunk(0.5, [5, 6], 8)])

    const gathered = await gatherStreamedVocal(stream)

    expect(Array.from(gathered.samples)).toEqual([1, 2, 0, 0, 5, 6, 0, 0])
  })

  it('keeps what it has when a chunk begins before the last one ended', async () => {
    const stream = source(1, 8, [
      chunk(0, [1, 2, 3, 4], 8),
      // Begins a sample early, as a decoder may after a seek.
      chunk(0.375, [99, 5, 6, 7, 8], 8),
    ])

    const gathered = await gatherStreamedVocal(stream)

    expect(Array.from(gathered.samples)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('keeps the average of every second sample where the whole would not fit', async () => {
    // Eight samples of four bytes each is 32: a ceiling of 16 needs a step of 2.
    const stream = source(1, 8, [chunk(0, [1, 3, 5, 7, 2, 2, 0, 4], 8)])

    const gathered = await gatherStreamedVocal(stream, { maxBytes: 16 })

    expect(gathered.step).toBe(2)
    expect(gathered.sampleRate).toBe(4)
    expect(Array.from(gathered.samples)).toEqual([2, 6, 2, 2])
  })

  it('says how far it has walked, up to the whole song', async () => {
    const seen: number[] = []
    const stream = source(1, 8, [
      chunk(0, [1, 2, 3, 4], 8),
      chunk(0.5, [5, 6, 7, 8], 8),
    ])

    await gatherStreamedVocal(stream, { onProgress: (f) => seen.push(f) })

    expect(seen).toEqual([0.5, 1, 1])
  })

  it('refuses a song too long to hold, in words, before decoding any of it', async () => {
    const stream = source(3600, 48_000, [chunk(0, [1], 48_000)])

    await expect(gatherStreamedVocal(stream)).rejects.toThrow(
      streamedTooLongMessage(),
    )
    expect(stream.opened).toEqual([])
  })

  it('stops when the run is aborted', async () => {
    const controller = new AbortController()
    const stream = source(1, 8, [
      chunk(0, [1, 2, 3, 4], 8),
      chunk(0.5, [5, 6, 7, 8], 8),
    ])

    const run = gatherStreamedVocal(stream, {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    })

    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
  })
})
