import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateSirens, SIREN_GUIDE_PERIOD_MS, SIREN_PHASE_GLIDE, SIREN_PHASE_LISTEN, sirenGuideMidi, useSirenController, } from '@/features/exercises/siren/use-siren-controller'
import type { ExerciseResult } from '@/features/exercises/types'
import { EXERCISE_SIREN } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'

describe('generateSirens', () => {
  // Regression: glides used to clamp endpoints one-sidedly and could emit
  // sub-audible notes (e.g. "G0"). Every endpoint must stay inside the
  // comfortable range and each glide must span two distinct notes.
  it('keeps both endpoints within the comfortable range', () => {
    const min = 48 // C3
    const max = 72 // C5
    for (const baseMidi of [48, 55, 60, 67, 72]) {
      for (const difficulty of [1, 5, 10]) {
        const rounds = generateSirens(baseMidi, difficulty, min, max)
        expect(rounds.length).toBe(6)
        for (const r of rounds) {
          expect(r.startMidi).toBeGreaterThanOrEqual(min)
          expect(r.startMidi).toBeLessThanOrEqual(max)
          expect(r.endMidi).toBeGreaterThanOrEqual(min)
          expect(r.endMidi).toBeLessThanOrEqual(max)
          expect(r.startMidi).not.toBe(r.endMidi)
        }
      }
    }
  })

  it('alternates ascending and descending glides', () => {
    const rounds = generateSirens(60, 5, 48, 72)
    expect(rounds[0]!.endMidi).toBeGreaterThan(rounds[0]!.startMidi) // up
    expect(rounds[1]!.endMidi).toBeLessThan(rounds[1]!.startMidi) // down
  })
})

describe('sirenGuideMidi', () => {
  const P = SIREN_GUIDE_PERIOD_MS

  // Regression: the dot used to be drawn off the run's elapsed clock, so a
  // round could open with the dot already at the far end, or travelling
  // backwards, under a caption reading "follow the dot". Measured from the
  // window opening, it must always leave from the start note.
  it('leaves from the start note and returns to it each period', () => {
    expect(sirenGuideMidi(60, 67, 0)).toBeCloseTo(60)
    expect(sirenGuideMidi(60, 67, P / 2)).toBeCloseTo(67)
    expect(sirenGuideMidi(60, 67, P)).toBeCloseTo(60)
    // Every later round starts from the same place, not mid-travel.
    expect(sirenGuideMidi(60, 67, P * 4)).toBeCloseTo(60)
    expect(sirenGuideMidi(60, 67, P * 4.5)).toBeCloseTo(67)
  })

  it('travels the same way for a descending glide', () => {
    expect(sirenGuideMidi(67, 60, 0)).toBeCloseTo(67)
    expect(sirenGuideMidi(67, 60, P / 2)).toBeCloseTo(60)
    expect(sirenGuideMidi(67, 60, P)).toBeCloseTo(67)
  })

  it('never leaves the interval, and never goes negative in time', () => {
    for (const [from, to] of [
      [60, 72],
      [72, 60],
    ]) {
      const lo = Math.min(from!, to!)
      const hi = Math.max(from!, to!)
      for (let t = -500; t <= P * 2; t += 25) {
        const m = sirenGuideMidi(from!, to!, t)
        expect(m).toBeGreaterThanOrEqual(lo)
        expect(m).toBeLessThanOrEqual(hi)
      }
    }
    // A negative offset (a stale anchor from a previous round) parks the
    // dot on the start note rather than throwing it somewhere arbitrary.
    expect(sirenGuideMidi(60, 67, -1000)).toBeCloseTo(60)
  })
})

/** A singer: the MIDI note sung `sinceMs` into a phase, or null. */
type Singer = (from: number, to: number, sinceMs: number) => number | null

/**
 * Run all six rounds against a mock base whose pitch history, like the real
 * one, keeps every frame of the run, at 60 a second: what `sing` returns in
 * each glide window, and what `between` returns while the pair plays and the
 * count-in runs, both timed from the start of their phase.
 */
async function runSiren(
  sing: Singer,
  between: Singer = () => null,
): Promise<ExerciseResult> {
  const t0 = Date.now()
  const elapsed = () => Date.now() - t0
  let from = 0
  let to = 0
  // Each phase as it began: when, between which notes, and who sings it.
  const phases: Array<{
    atMs: number
    from: number
    to: number
    singer: Singer
  }> = []
  // A holder, not a `let`: TS cannot see the callback assign it.
  const done: { result: ExerciseResult | null } = { result: null }
  const base = {
    pitchHistory: () => {
      const frames = []
      for (let ms = 1000 / 60; ms <= elapsed(); ms += 1000 / 60) {
        let phase = phases.length - 1
        while (phase >= 0 && phases[phase].atMs >= ms) phase--
        if (phase < 0) continue
        const p = phases[phase]
        const midi = p.singer(p.from, p.to, ms - p.atMs)
        if (midi === null) continue
        frames.push({
          freq: 440 * 2 ** ((midi - 69) / 12),
          time: ms / 1000,
          cents: 0,
          clarity: 0.95,
        })
      }
      return frames
    },
    _updateMetrics: (m: Record<string, number>) => {
      if (m.startMidi !== undefined) from = m.startMidi
      if (m.endMidi !== undefined) to = m.endMidi
      // The count-in carries on the listening phase's singer.
      if (m.phase === SIREN_PHASE_LISTEN) {
        phases.push({ atMs: elapsed(), from, to, singer: between })
      }
      if (m.phase === SIREN_PHASE_GLIDE) {
        phases.push({ atMs: m.glideFromMs ?? 0, from, to, singer: sing })
      }
    },
    _setTargetPitch: () => {},
    _updateScore: () => {},
    _setRunning: () => {},
    _registerDispose: () => {},
    _completeWithResult: (r: ExerciseResult) => {
      done.result = r
    },
    state: () => ({
      status: 'active',
      currentScore: 0,
      elapsedMs: elapsed(),
      metrics: {},
    }),
  } as unknown as BaseExerciseController
  const ctrl = useSirenController(base, { playTone: async () => {} })
  ctrl.setBase(60, 48, 72)
  ctrl.startRounds()
  // Six rounds of two notes, a gap, the 3 s count-in, the 4 s window and
  // the pause after it: well inside a minute.
  await vi.advanceTimersByTimeAsync(60_000)
  if (done.result === null) throw new Error('the run never finished')
  return done.result
}

describe('the Siren glide score (30 % of the grade)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // Glide to the second note at the guide dot's pace, then hold it.
  const glideAndHold: Singer = (from, to, since) =>
    from + (to - from) * Math.min(1, since / (SIREN_GUIDE_PERIOD_MS / 2))
  // Hold the first note, then jump to the second halfway through.
  const stepwise: Singer = (from, to, since) => (since < 2000 ? from : to)

  it('gives a smooth glide the whole part, where it used to earn nothing', async () => {
    // detectSlides found no slide in a line that moves a fraction of a
    // semitone a frame, so this glide scored 0 in the part (FACTS 41).
    const r = await runSiren(glideAndHold)
    expect(r.metrics.roundsCompleted).toBe(6)
    expect(r.metrics.voicedGlides).toBe(6)
    expect(r.metrics.glideQuality).toBeGreaterThan(95)
    expect(r.score).toBe(
      Math.round(
        r.metrics.avgAccuracy! * 0.45 +
          r.metrics.bestRound! * 0.25 +
          r.metrics.glideQuality! * 0.3,
      ),
    )
  })

  it('gives a jump between two held notes almost none of it', async () => {
    const smooth = await runSiren(glideAndHold)
    const jumped = await runSiren(stepwise)
    // Both land on the second note, so the closeness parts match ...
    expect(jumped.metrics.avgAccuracy).toBe(smooth.metrics.avgAccuracy)
    // ... and only the glide tells them apart.
    expect(jumped.metrics.glideQuality).toBeLessThan(10)
    expect(jumped.score).toBeLessThan(smooth.score)
  })

  it('also credits following the dot there and back', async () => {
    const r = await runSiren((from, to, since) =>
      sirenGuideMidi(from, to, since),
    )
    expect(r.metrics.glideQuality).toBeGreaterThan(95)
  })

  it('scores 0 in the part for a round with no voiced glide', async () => {
    // Glide the three rising rounds; stay silent through the falling ones.
    const r = await runSiren((from, to, since) =>
      to > from ? glideAndHold(from, to, since) : null,
    )
    expect(r.metrics.voicedGlides).toBe(3)
    // Three full glides and three zeros, averaged over all six rounds.
    expect(r.metrics.glideQuality).toBeGreaterThan(45)
    expect(r.metrics.glideQuality).toBeLessThanOrEqual(50)
  })

  it("scores each round on its own window's frames alone", async () => {
    // Glide along while the pair plays and through the count-in, then hold
    // the first note through the window. The history still holds those
    // glides, and the rounds before, but the window itself glides nothing.
    const r = await runSiren((from) => from, glideAndHold)
    expect(r.metrics.voicedGlides).toBe(6)
    expect(r.metrics.glideQuality).toBe(0)
  })

  it('scores silence 0, with the same metrics as a sung run', async () => {
    const r = await runSiren(() => null)
    expect(r.type).toBe(EXERCISE_SIREN)
    expect(r.score).toBe(0)
    expect(r.metrics.glideQuality).toBe(0)
    expect(r.metrics.voicedGlides).toBe(0)
    const sung = await runSiren(glideAndHold)
    expect(Object.keys(r.metrics).sort()).toEqual(
      Object.keys(sung.metrics).sort(),
    )
  })
})
