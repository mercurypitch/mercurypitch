// ── Offline vocal analysis tests ─────────────────────────────────────
// The melody every surface in the app aims at, pinned outside the stem
// mixer for the first time. While this lived inside a Solid controller
// the only way to exercise it was to mount the mixer, so nothing did --
// and "the jam room shows a different line from Karaoke Night" was a bug
// class nobody could write a test for.
//
// Real detectors over synthesised tones, not mocks: the contract worth
// holding is that audible singing comes back as notes, and a mocked
// PitchDetector would assert only that the loop counts.

import { describe, expect, it, vi } from 'vitest'
import { WINDOW_STEP_SEC } from '@/lib/midi-generator'
import { analyzeVocalSamples, isAnalysisAbort, segmentVocalContour, VOCAL_ANALYSIS_DEFAULTS, } from '@/lib/pitch-pipeline/analyze-vocal'

const SAMPLE_RATE = 16000

/** A steady tone, loud enough to clear the amplitude gate. */
function tone(hz: number, seconds: number, amplitude = 0.4): Float32Array {
  const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE))
  for (let i = 0; i < samples.length; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE)
  }
  return samples
}

/** Two tones back to back, so the segmenter has a boundary to find. */
function phrase(): Float32Array {
  const a = tone(220, 4) // A3
  const b = tone(261.63, 4) // C4
  const out = new Float32Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

describe('analyzeVocalSamples', () => {
  it('turns a sung phrase into notes at the pitches that were sung', async () => {
    const result = await analyzeVocalSamples(phrase(), SAMPLE_RATE)

    expect(result.segmentedNotes.length).toBeGreaterThan(0)
    const midis = new Set(result.segmentedNotes.map((n) => n.midi))
    // A3 is 57 and C4 is 60. Nothing here asserts the segmenter's exact
    // boundaries -- only that both notes are in the answer.
    expect(midis.has(57)).toBe(true)
    expect(midis.has(60)).toBe(true)
  }, 30000)

  it('gives the same answer twice, given the same samples', async () => {
    // Nothing in here may depend on a clock, a random seed or a shared
    // detector: a jam room and the mixer analysing the same stem have to
    // reach the same melody or the room and the mixer disagree on screen.
    const samples = phrase()
    const first = await analyzeVocalSamples(samples, SAMPLE_RATE)
    const second = await analyzeVocalSamples(samples, SAMPLE_RATE)

    expect(second.algo).toBe(first.algo)
    expect(second.segmentedNotes).toEqual(first.segmentedNotes)
    expect(second.mergedNotes).toEqual(first.mergedNotes)
    expect(second.contour.length).toBe(first.contour.length)
  }, 30000)

  it('reports progress that only ever climbs, and ends on exactly 100', async () => {
    const seen: number[] = []
    await analyzeVocalSamples(
      phrase(),
      SAMPLE_RATE,
      {},
      { onProgress: (pct) => seen.push(pct) },
    )

    expect(seen.length).toBeGreaterThan(1)
    expect(seen[seen.length - 1]).toBe(100)
    expect(seen.filter((p) => p === 100)).toHaveLength(1)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!).toBeGreaterThan(seen[i - 1]!)
    }
    for (const pct of seen) {
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThanOrEqual(100)
    }
  }, 30000)

  it('stops when the caller aborts, and says that is why', async () => {
    // A singer who picks a different song must not wait out the analysis
    // of the one they left, and the failure banner must not appear for it.
    const controller = new AbortController()
    const started = analyzeVocalSamples(
      phrase(),
      SAMPLE_RATE,
      {},
      {
        onProgress: () => controller.abort(),
        signal: controller.signal,
      },
    )

    await expect(started).rejects.toThrow()
    await started.catch((error: unknown) => {
      expect(isAnalysisAbort(error)).toBe(true)
    })
  }, 30000)

  it('refuses a signal that was already aborted before it began', async () => {
    const controller = new AbortController()
    controller.abort()
    await analyzeVocalSamples(
      phrase(),
      SAMPLE_RATE,
      {},
      { signal: controller.signal },
    ).catch((error: unknown) => {
      expect(isAnalysisAbort(error)).toBe(true)
    })
    expect.assertions(1)
  }, 30000)

  it('keeps the run that covers more sung time when the algorithm is auto', async () => {
    // 'auto' is a race, and the winner is whoever cleaned up to more
    // singing. Asserting the rule rather than the winner: which detector
    // wins on a given take is the engine's business.
    const result = await analyzeVocalSamples(phrase(), SAMPLE_RATE, {
      algorithm: 'auto',
    })
    const coverage = (notes: typeof result.segmentedNotes): number =>
      notes.reduce((sum, n) => sum + (n.endSec - n.startSec), 0)

    const yin = await analyzeVocalSamples(phrase(), SAMPLE_RATE, {
      algorithm: 'yin',
    })
    const mpm = await analyzeVocalSamples(phrase(), SAMPLE_RATE, {
      algorithm: 'mpm',
    })

    expect(['yin', 'mpm']).toContain(result.algo)
    expect(coverage(result.segmentedNotes)).toBeGreaterThanOrEqual(
      Math.max(coverage(yin.segmentedNotes), coverage(mpm.segmentedNotes)) -
        1e-9,
    )
  }, 60000)

  it('runs a single detector when one is named', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const result = await analyzeVocalSamples(phrase(), SAMPLE_RATE, {
      algorithm: 'yin',
    })
    expect(result.algo).toBe('yin')
    // No race, so nothing to report a pick from.
    expect(
      log.mock.calls.filter((c) => String(c[0]).includes('auto pick')),
    ).toHaveLength(0)
    log.mockRestore()
  }, 30000)

  it('throws rather than returning an empty melody for a buffer with no frames', async () => {
    // Less than one detector window is a caller bug -- a stem that failed
    // to decode, a blob that came back empty. An empty note list would be
    // indistinguishable from "this take is silent".
    await expect(
      analyzeVocalSamples(new Float32Array(256), SAMPLE_RATE),
    ).rejects.toThrow('Buffer too short')
  })

  it('samples the contour at the pipeline hop, silences included', async () => {
    // The silences are what break a held note, so the contour must carry
    // every frame, not only the voiced ones.
    const samples = phrase()
    const result = await analyzeVocalSamples(samples, SAMPLE_RATE)

    const expected =
      Math.floor(
        (samples.length - VOCAL_ANALYSIS_DEFAULTS.bufferSize) /
          Math.floor(WINDOW_STEP_SEC * SAMPLE_RATE),
      ) + 1
    expect(result.contour).toHaveLength(expected)
    expect(result.contour.length).toBeGreaterThanOrEqual(
      result.rawDetections.length,
    )
    for (let i = 1; i < result.contour.length; i++) {
      expect(result.contour[i]!.timeSec).toBeGreaterThan(
        result.contour[i - 1]!.timeSec,
      )
    }
  }, 30000)
})

describe('segmentVocalContour', () => {
  it('re-cleans a contour the caller already holds, with no detection', async () => {
    // This is the mixer's cleanup slider: the same frames, a different
    // amount, no second pass over the audio.
    const { contour } = await analyzeVocalSamples(phrase(), SAMPLE_RATE)
    const asDetected = segmentVocalContour(contour, {
      ...VOCAL_ANALYSIS_DEFAULTS,
      cleanupAmount: 0,
    })
    const cleaned = segmentVocalContour(contour, {
      ...VOCAL_ANALYSIS_DEFAULTS,
      cleanupAmount: 1,
    })

    expect(asDetected.length).toBeGreaterThan(0)
    expect(cleaned.length).toBeGreaterThan(0)
    // Same input, same settings, same answer -- the property the analysis
    // relies on when it reuses the winning run's segmentation.
    expect(segmentVocalContour(contour, VOCAL_ANALYSIS_DEFAULTS)).toEqual(
      segmentVocalContour(contour, VOCAL_ANALYSIS_DEFAULTS),
    )
  }, 30000)
})

describe('VOCAL_ANALYSIS_DEFAULTS', () => {
  it('is the one place a caller that never asks gets its settings from', () => {
    // Pinned because two surfaces now analyse without a settings panel in
    // front of them; a silent change here changes what they both produce.
    expect(VOCAL_ANALYSIS_DEFAULTS).toEqual({
      algorithm: 'auto',
      bufferSize: 1024,
      sensitivity: 7,
      minConfidence: 0.3,
      minAmplitude: 0.02,
      bpm: 120,
      key: 'C',
      scaleType: 'major',
      cleanupAmount: 0.3,
    })
  })
})
