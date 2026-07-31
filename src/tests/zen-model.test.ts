import { describe, expect, it } from 'vitest'
import { getZenExercise, ZEN_EXERCISES } from '@/features/zen/exercise-catalog'
import { validateZenExercise } from '@/features/zen/validate-exercise'
import { fitZenViewport, resolveZenTargets, scoreZenRun, targetMidiAt, } from '@/features/zen/zen-model'

describe('zen pitch model', () => {
  it('keeps every provisional seed valid and publishable', () => {
    const ids = new Set(ZEN_EXERCISES.map((exercise) => exercise.id))
    expect(ids.size).toBe(ZEN_EXERCISES.length)
    for (const exercise of ZEN_EXERCISES) {
      expect(validateZenExercise(exercise)).toEqual([])
    }
  })

  it('keeps an ordinary exercise inside a stable two-octave viewport', () => {
    expect(fitZenViewport([55, 60, 67])).toEqual({
      minMidi: 49,
      maxMidi: 73,
    })
  })

  it('retains the previous viewport while values remain inside its padding', () => {
    const previous = { minMidi: 48, maxMidi: 72 }
    expect(fitZenViewport([52, 69], previous)).toBe(previous)
  })

  it('expands only when a two-octave span cannot contain the observed range', () => {
    expect(fitZenViewport([40, 72])).toEqual({
      minMidi: 38,
      maxMidi: 74,
    })
  })

  it('interpolates continuous glide targets', () => {
    const exercise = getZenExercise('noo-siren')
    expect(exercise).not.toBeNull()
    const targets = resolveZenTargets(exercise!, 55)
    const first = targets[0]!
    expect(
      targetMidiAt(targets, (first.startSec + first.endSec) / 2),
    ).toBeCloseTo(61, 4)
  })

  it('scores an accurate, covered trace higher than an inaccurate trace', () => {
    const exercise = getZenExercise('mah-meh-mee-moh-moo')
    expect(exercise).not.toBeNull()
    const targets = resolveZenTargets(exercise!, exercise!.defaultRootMidi)
    const points = targets.flatMap((target) => [
      { timeSec: target.startSec + 0.05, midi: target.startMidi },
      { timeSec: target.startSec + 0.25, midi: target.startMidi + 0.03 },
      { timeSec: target.endSec - 0.05, midi: target.endMidi },
    ])
    const inaccurate = points.map((point) => ({
      ...point,
      midi: point.midi === null ? null : point.midi + 0.8,
    }))

    const accurateScore = scoreZenRun(points, targets, exercise!.scoring)
    const inaccurateScore = scoreZenRun(inaccurate, targets, exercise!.scoring)
    expect(accurateScore.total).toBeGreaterThan(inaccurateScore.total)
    expect(accurateScore.pitch).toBeGreaterThan(90)
  })

  it('does not treat three sparse accurate blips as full coverage', () => {
    const exercise = getZenExercise('major-scale-ascending')
    expect(exercise).not.toBeNull()
    const targets = resolveZenTargets(exercise!, exercise!.defaultRootMidi)
    const selected = [targets[0]!, targets[3]!, targets.at(-1)!]
    const sparse = selected.map((target) => ({
      timeSec: (target.startSec + target.endSec) / 2,
      midi: target.startMidi,
    }))

    const score = scoreZenRun(sparse, targets, exercise!.scoring)
    expect(score.pitch).toBe(100)
    expect(score.coverage).toBeLessThan(10)
    expect(score.total).toBeLessThan(85)
  })
})
