// The tuning that parameterises the matcher. Four of the seven options it
// hands the engine differ by input kind, and getting one wrong changes every
// score without failing anything.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GUITAR_SCORE_TUNING_DEFAULTS, guitarPerformanceAnalyserSize, guitarScoreEngineTuning, resetGuitarScoreTuning, setGuitarScoreTuning, } from './guitar-score-tuning'

const STORAGE_KEY = 'guitar-night-score-tuning'

beforeEach(() => {
  globalThis.localStorage.clear()
  resetGuitarScoreTuning()
})
afterEach(() => {
  globalThis.localStorage.clear()
  resetGuitarScoreTuning()
})

describe('guitarScoreEngineTuning', () => {
  it('gives MIDI a symmetric window and none of the acoustic allowances', () => {
    // A MIDI clock is not delayed by a capture route, so the late side would
    // only invent matches; and MIDI reports one event per note played, so
    // octave folding and pitch changes would double-count rather than help.
    const midi = guitarScoreEngineTuning('midi')

    expect(midi.lateToleranceMs).toBe(midi.matchToleranceMs)
    expect(midi.octaveTolerantPitch).toBe(false)
    expect(midi.matchPitchChanges).toBe(false)
    // A policy, not a boolean: `acoustic && current.scorePolicy` would put
    // `false` here, and the engine would silently read that as its default.
    expect(midi.scorePolicy).toBe('exclude-first')
  })

  it('gives an acoustic route the one-way window and the reclaim policy', () => {
    for (const kind of ['microphone', 'interface'] as const) {
      const acoustic = guitarScoreEngineTuning(kind)
      expect(acoustic.lateToleranceMs).toBe(
        GUITAR_SCORE_TUNING_DEFAULTS.lateToleranceMs,
      )
      expect(acoustic.lateToleranceMs).toBeGreaterThan(
        acoustic.matchToleranceMs,
      )
      expect(acoustic.octaveTolerantPitch).toBe(true)
      expect(acoustic.matchPitchChanges).toBe(true)
      expect(acoustic.scorePolicy).toBe('evidence-first')
    }
  })

  it('turns dense-passage exclusion off by collapsing its spacing', () => {
    expect(guitarScoreEngineTuning('microphone').denseTargetSpacingMs).toBe(
      GUITAR_SCORE_TUNING_DEFAULTS.denseTargetSpacingMs,
    )
    setGuitarScoreTuning({ judgeDenseTargets: true })
    expect(guitarScoreEngineTuning('microphone').denseTargetSpacingMs).toBe(0)
  })

  it('carries an override through to the engine options', () => {
    setGuitarScoreTuning({ matchToleranceMs: 90, minimumPitchClarity: 0.8 })
    const acoustic = guitarScoreEngineTuning('microphone')
    expect(acoustic.matchToleranceMs).toBe(90)
    expect(acoustic.minimumPitchClarity).toBe(0.8)
    // The MIDI window follows the early side, so it moves with it.
    expect(guitarScoreEngineTuning('midi').lateToleranceMs).toBe(90)
  })
})

describe('setGuitarScoreTuning', () => {
  it('merges a patch and persists the whole tuning', () => {
    setGuitarScoreTuning({ lateToleranceMs: 400 })
    const stored = JSON.parse(
      globalThis.localStorage.getItem(STORAGE_KEY) ?? '{}',
    ) as Record<string, unknown>

    expect(stored['lateToleranceMs']).toBe(400)
    // Untouched fields survive the patch rather than being dropped.
    expect(stored['scorePolicy']).toBe(GUITAR_SCORE_TUNING_DEFAULTS.scorePolicy)
    expect(guitarScoreEngineTuning('microphone').lateToleranceMs).toBe(400)
  })

  it('keeps the in-memory override when storage refuses the write', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota')
      })

    expect(() => setGuitarScoreTuning({ lateToleranceMs: 500 })).not.toThrow()
    expect(guitarScoreEngineTuning('microphone').lateToleranceMs).toBe(500)
    setItem.mockRestore()
  })
})

describe('guitarPerformanceAnalyserSize', () => {
  it('accepts the sizes the analyser actually offers', () => {
    for (const size of [1024, 2048, 4096, 8192]) {
      setGuitarScoreTuning({ performanceAnalyserSize: size })
      expect(guitarPerformanceAnalyserSize()).toBe(size)
    }
  })

  it('falls back rather than passing an unsupported size to the analyser', () => {
    setGuitarScoreTuning({ performanceAnalyserSize: 3000 })
    expect(guitarPerformanceAnalyserSize()).toBe(
      GUITAR_SCORE_TUNING_DEFAULTS.performanceAnalyserSize,
    )
  })
})

describe('stored tuning', () => {
  it('drops a stored window too small to represent guitar low E', async () => {
    // Under 2048 the detector's own floor sits above 82.4 Hz, so it cannot
    // represent the note and reports the octave instead -- never a valid
    // choice, so a stored one is ignored while the rest is honoured.
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ performanceAnalyserSize: 1024, lateToleranceMs: 260 }),
    )
    vi.resetModules()
    const fresh = await import('./guitar-score-tuning')

    expect(fresh.guitarScoreTuning().performanceAnalyserSize).toBe(
      GUITAR_SCORE_TUNING_DEFAULTS.performanceAnalyserSize,
    )
    expect(fresh.guitarScoreTuning().lateToleranceMs).toBe(260)
  })

  it('survives unparseable storage', async () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '{not json')
    vi.resetModules()
    const fresh = await import('./guitar-score-tuning')

    expect(fresh.guitarScoreTuning()).toEqual(GUITAR_SCORE_TUNING_DEFAULTS)
  })
})
