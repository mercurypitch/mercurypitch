import { describe, expect, it } from 'vitest'
import { getZenExercise, ZEN_EXERCISES } from '@/features/zen/exercise-catalog'
import type { ZenExerciseDefinition, ZenPitchPoint } from '@/features/zen/types'
import { validateZenExercise } from '@/features/zen/validate-exercise'
import { fitZenViewport, pitchTargetMidis, resolveZenTargets, scoreLevelTargets, scoreZenRun, targetMidiAt, } from '@/features/zen/zen-model'
import { SIGNAL_FLOOR_RMS } from '@/lib/input-health'

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

// ============================================================
// Blocks that are not notes
// ============================================================
//
// A hiss has no pitch and plenty of signal; a held breath has neither. Before
// kinds, both were timers — the app could not tell a singer sustaining a hiss
// for eight beats from one who said nothing. These pin what it can tell now,
// and, just as importantly, that nothing changed for exercises made entirely
// of notes.

const HISS = 0.02 // comfortably above the floor

function exerciseWith(
  targets: ZenExerciseDefinition['targets'],
): ZenExerciseDefinition {
  const seed = getZenExercise('noo-siren')!
  return { ...seed, loopBeats: 16, targets }
}

const note = (
  id: string,
  startBeat: number,
): ZenExerciseDefinition['targets'][number] => ({
  id,
  startBeat,
  durationBeats: 4,
  semitone: 0,
  cue: 'Noo',
})

const hiss = (
  id: string,
  startBeat: number,
): ZenExerciseDefinition['targets'][number] => ({
  id,
  startBeat,
  durationBeats: 4,
  semitone: 0,
  cue: 'sss',
  kind: 'amplitude',
})

/**
 * A sample every 100 ms across a span, at one level.
 *
 * Offset a millisecond into each bucket: coverage buckets are 100 ms wide and
 * a sample sitting exactly on a boundary is at the mercy of float error about
 * which side it lands on.
 */
function levelSamples(
  fromSec: number,
  toSec: number,
  level: number,
): ZenPitchPoint[] {
  const steps = Math.floor((toSec - fromSec) / 0.1)
  return Array.from({ length: steps + 1 }, (_, index) => ({
    timeSec: fromSec + index * 0.1 + 0.001,
    midi: null,
    level,
  }))
}

describe('scoreLevelTargets', () => {
  it('is null when the exercise asks for no sustained sound', () => {
    const exercise = exerciseWith([note('a', 0)])
    const targets = resolveZenTargets(exercise, 60)
    expect(scoreLevelTargets([], targets, exercise.scoring)).toBeNull()
  })

  it('rewards a hiss that was actually held', () => {
    const exercise = exerciseWith([hiss('h', 0)])
    const targets = resolveZenTargets(exercise, 60)
    const held = scoreLevelTargets(
      levelSamples(targets[0]!.startSec, targets[0]!.endSec, HISS),
      targets,
      exercise.scoring,
    )!
    // Half the block, then nothing — the exact failure a timer cannot see.
    const faded = scoreLevelTargets(
      levelSamples(
        targets[0]!.startSec,
        (targets[0]!.startSec + targets[0]!.endSec) / 2,
        HISS,
      ),
      targets,
      exercise.scoring,
    )!

    expect(held.coverage).toBeGreaterThan(0.9)
    expect(faded.coverage).toBeLessThan(0.6)
    expect(held.score).toBeGreaterThan(faded.score)
  })

  it('does not count silence as a quiet hiss', () => {
    const exercise = exerciseWith([hiss('h', 0)])
    const targets = resolveZenTargets(exercise, 60)
    const scored = scoreLevelTargets(
      levelSamples(
        targets[0]!.startSec,
        targets[0]!.endSec,
        SIGNAL_FLOOR_RMS / 2,
      ),
      targets,
      exercise.scoring,
    )!

    expect(scored.coverage).toBe(0)
  })

  it('prefers a steady level to one that lurches', () => {
    const exercise = exerciseWith([hiss('h', 0)])
    const targets = resolveZenTargets(exercise, 60)
    const steady = levelSamples(targets[0]!.startSec, targets[0]!.endSec, HISS)
    const lurching = steady.map((point, index) => ({
      ...point,
      level: index % 2 === 0 ? HISS : HISS * 8,
    }))

    expect(
      scoreLevelTargets(steady, targets, exercise.scoring)!.stability,
    ).toBeGreaterThan(
      scoreLevelTargets(lurching, targets, exercise.scoring)!.stability,
    )
  })
})

describe('scoreZenRun with mixed blocks', () => {
  // The guarantee that makes this safe to ship: every exercise in the
  // catalogue is all-pitch, and none of their numbers move.
  it('leaves an all-pitch exercise byte-for-byte as it was', () => {
    const exercise = getZenExercise('mah-meh-mee-moh-moo')!
    const targets = resolveZenTargets(exercise, exercise.defaultRootMidi)
    const points = targets.flatMap((target) => [
      { timeSec: target.startSec + 0.05, midi: target.startMidi },
      { timeSec: target.endSec - 0.05, midi: target.endMidi },
    ])
    const score = scoreZenRun(points, targets, exercise.scoring)

    expect(score.level).toBeUndefined()
    expect(score.total).toBe(
      scoreZenRun(points, targets, exercise.scoring).total,
    )
  })

  it('makes the hiss half of a half-hiss exercise count', () => {
    const exercise = exerciseWith([note('a', 0), hiss('h', 4)])
    const targets = resolveZenTargets(exercise, 60)
    const sungWell = [
      { timeSec: targets[0]!.startSec + 0.05, midi: targets[0]!.startMidi },
      { timeSec: targets[0]!.endSec - 0.05, midi: targets[0]!.endMidi },
    ]

    const withHiss = scoreZenRun(
      [
        ...sungWell,
        ...levelSamples(targets[1]!.startSec, targets[1]!.endSec, HISS),
      ],
      targets,
      exercise.scoring,
    )
    const withoutHiss = scoreZenRun(sungWell, targets, exercise.scoring)

    expect(withHiss.level).toBeGreaterThan(withoutHiss.level!)
    expect(withHiss.total).toBeGreaterThan(withoutHiss.total)
  })

  it('ignores breath blocks entirely', () => {
    const targets = resolveZenTargets(
      exerciseWith([
        note('a', 0),
        {
          id: 'inhale',
          startBeat: 4,
          durationBeats: 4,
          semitone: 0,
          cue: 'Breathe in',
          kind: 'breath',
        },
      ]),
      60,
    )
    // A breath block is not a target to be at, so nothing is judged there.
    expect(targetMidiAt(targets, targets[1]!.startSec + 0.5)).toBeNull()
    // And it does not drag the canvas toward a pitch it never had.
    expect(pitchTargetMidis(targets)).toEqual([60, 60])
  })
})

describe('scoreZenRun steadiness with stray frames', () => {
  // Takes at the app's frame rate: a pitch point on every animation frame.
  const FPS = 60
  const exercise = getZenExercise('mah-meh-mee-moh-moo')!
  // Five vowels on A3 (MIDI 57).
  const targets = resolveZenTargets(exercise, 57)

  /** A take on A3, `cents` off the target on each frame. */
  function take(
    cents: (timeSec: number, frame: number) => number,
  ): ZenPitchPoint[] {
    const points: ZenPitchPoint[] = []
    const start = targets[0]!.startSec
    const end = targets.at(-1)!.endSec
    for (let frame = 0; start + frame / FPS <= end; frame += 1) {
      const timeSec = start + frame / FPS
      const target = targetMidiAt(targets, timeSec)
      if (target === null) continue
      points.push({ timeSec, midi: target + cents(timeSec, frame) / 100 })
    }
    return points
  }

  // A held voice's own few cents of wander, the same on every run.
  const wander = (frame: number): number => 4 * Math.sin(frame * 1.7)
  const held = take((_, frame) => wander(frame))

  it('leaves two octave slips out of a held A3', () => {
    expect(held.length).toBeGreaterThan(200)
    // The tracker reads two frames an octave up, where the voice never went.
    const slipped = held.map((point, frame) =>
      frame === 100 || frame === 200
        ? { ...point, midi: point.midi! + 12 }
        : point,
    )

    const score = scoreZenRun(slipped, targets, exercise.scoring)

    expect({
      total: score.total,
      steadiness: score.steadiness,
      pitch: score.pitch,
    }).toEqual({ total: 92, steadiness: 96, pitch: 87 })
    // The spread is the held take's own.
    expect(score.steadiness).toBe(
      scoreZenRun(held, targets, exercise.scoring).steadiness,
    )
  })

  it('measures the whole take when the slips are most of it', () => {
    // An octave out on a fifth of the frames is the take, not a slip.
    const octaveOut = held.map((point, frame) =>
      frame % 5 === 0 ? { ...point, midi: point.midi! + 12 } : point,
    )
    expect(scoreZenRun(octaveOut, targets, exercise.scoring).steadiness).toBe(0)
  })

  // Pinned before the slips were left out: none of these takes has a frame
  // anywhere near half an octave from the rest, so not one number moves.
  it.each([
    {
      name: 'held',
      cents: (_: number, frame: number) => wander(frame),
      score: {
        total: 98,
        pitch: 97,
        coverage: 100,
        steadiness: 96,
        averageCents: 2.6,
      },
    },
    {
      name: 'vibrato',
      cents: (timeSec: number, frame: number) =>
        45 * Math.sin(2 * Math.PI * 5.5 * timeSec) + wander(frame),
      score: {
        total: 72,
        pitch: 72,
        coverage: 100,
        steadiness: 55,
        averageCents: 28.4,
      },
    },
    {
      name: 'flat',
      cents: (_: number, frame: number) => -40 + wander(frame),
      score: {
        total: 79,
        pitch: 60,
        coverage: 100,
        steadiness: 96,
        averageCents: 40,
      },
    },
    {
      name: 'scooped',
      cents: (timeSec: number, frame: number) => {
        const into = targets.find(
          (target) => timeSec >= target.startSec && timeSec <= target.endSec,
        )!
        const late = timeSec - into.startSec
        return (late < 0.15 ? -250 * (1 - late / 0.15) : 0) + wander(frame)
      },
      score: {
        total: 61,
        pitch: 73,
        coverage: 100,
        steadiness: 15,
        averageCents: 27.2,
      },
    },
    {
      // A slide into the first vowel from a major third under: few frames,
      // but a sung slide, not a slip.
      name: 'one scooped',
      cents: (timeSec: number, frame: number) => {
        const late = timeSec - targets[0]!.startSec
        return (late < 0.1 ? -400 * (1 - late / 0.1) : 0) + wander(frame)
      },
      score: {
        total: 78,
        pitch: 91,
        coverage: 100,
        steadiness: 40,
        averageCents: 8.7,
      },
    },
    {
      name: 'drifting',
      cents: (timeSec: number, frame: number) =>
        60 * Math.sin(2 * Math.PI * 1.3 * timeSec) + wander(frame),
      score: {
        total: 63,
        pitch: 62,
        coverage: 100,
        steadiness: 39,
        averageCents: 38.3,
      },
    },
  ])('keeps an ordinary $name take where it was', ({ cents, score }) => {
    expect(scoreZenRun(take(cents), targets, exercise.scoring)).toEqual(score)
  })
})
