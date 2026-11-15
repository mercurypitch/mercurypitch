import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runStoppedEarly } from '../types'
import type { CadenceType } from './cadence-rounds'
import { stepsOf } from './cadence-rounds'
import type { CadenceController } from './use-cadence-controller'
import { AFTER_REPLAY_MS, CHORD_MS, GAP_MS, LAST_CHORD_MS, playbackMs, RIGHT_MS, useCadenceController, } from './use-cadence-controller'

/** A repeatable stand-in for Math.random (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function run(rounds = 3) {
  const chords: (readonly number[])[] = []
  let stops = 0
  let dispose = () => {}
  const quiz = createRoot((d): CadenceController => {
    dispose = d
    return useCadenceController({
      playChord: (midis) => chords.push(midis),
      stopSound: () => {
        stops += 1
      },
      random: seeded(11),
      now: () => Date.now(),
    })
  })
  quiz.start({ difficulty: 9, rounds })
  return { quiz, chords, stops: () => stops, dispose }
}

/** Let the round that is up play to the start of its last chord. */
const toLastChord = () => vi.advanceTimersByTime(2 * (CHORD_MS + GAP_MS))

const rightName = (quiz: CadenceController): CadenceType => {
  const round = quiz.round()
  if (round === null) throw new Error('no cadence is up')
  return round.type
}

const wrongName = (quiz: CadenceController): CadenceType =>
  rightName(quiz) === 'perfect' ? 'plagal' : 'perfect'

describe('a run of Name the Cadence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('strikes the first chord at once, from inside the tap that started it', () => {
    const { quiz, chords, dispose } = run()
    const round = quiz.round()
    expect(round).not.toBeNull()
    expect(chords).toEqual([stepsOf(round!)[0].midis])
    expect(quiz.sounding()).toBe(0)
    expect(quiz.heard()).toBe(false)
    dispose()
  })

  it('plays the three chords in order and lights each while it sounds', () => {
    const { quiz, chords, dispose } = run()
    const steps = stepsOf(quiz.round()!)

    vi.advanceTimersByTime(CHORD_MS + GAP_MS)
    expect(quiz.sounding()).toBe(1)
    expect(chords).toHaveLength(2)

    vi.advanceTimersByTime(CHORD_MS + GAP_MS)
    expect(quiz.sounding()).toBe(2)
    expect(chords.map((c) => [...c])).toEqual(steps.map((s) => [...s.midis]))

    vi.advanceTimersByTime(LAST_CHORD_MS)
    expect(quiz.sounding()).toBe(-1)
    dispose()
  })

  it('takes no answer until the ending has sounded', () => {
    const { quiz, dispose } = run()
    quiz.answer(rightName(quiz))
    expect(quiz.marks()).toEqual([])

    toLastChord()
    expect(quiz.heard()).toBe(true)
    quiz.answer(rightName(quiz))
    expect(quiz.marks()).toEqual([true])
    dispose()
  })

  it('after a right answer, moves on and plays the next cadence', () => {
    const { quiz, chords, dispose } = run()
    toLastChord()
    quiz.answer(rightName(quiz))
    expect(quiz.feedback()).toMatchObject({ right: true })
    const before = chords.length

    vi.advanceTimersByTime(RIGHT_MS)
    expect(quiz.index()).toBe(1)
    expect(quiz.heard()).toBe(false)
    expect(chords).toHaveLength(before + 1)
    dispose()
  })

  it('after a miss, plays the cadence once more before it moves on', () => {
    const { quiz, chords, dispose } = run()
    toLastChord()
    const before = chords.length
    quiz.answer(wrongName(quiz))
    expect(quiz.feedback()).toMatchObject({ right: false })
    // The replay starts at once.
    expect(chords).toHaveLength(before + 1)

    const round = quiz.round()!
    vi.advanceTimersByTime(playbackMs(round) + AFTER_REPLAY_MS - 1)
    expect(quiz.index()).toBe(0)
    expect(chords).toHaveLength(before + 3)
    vi.advanceTimersByTime(1)
    expect(quiz.index()).toBe(1)
    dispose()
  })

  it('plays the round again when asked, but not over an answer on show', () => {
    const { quiz, chords, dispose } = run()
    toLastChord()
    vi.advanceTimersByTime(LAST_CHORD_MS)
    expect(chords).toHaveLength(3)

    quiz.replay()
    expect(chords).toHaveLength(4)
    expect(quiz.sounding()).toBe(0)
    // Heard once already: the answer stays open through the replay.
    expect(quiz.heard()).toBe(true)

    toLastChord()
    quiz.answer(rightName(quiz))
    const before = chords.length
    quiz.replay()
    expect(chords).toHaveLength(before)
    dispose()
  })

  it("a playback is two chords and their gaps, then the last one's ring", () => {
    const { quiz, dispose } = run()
    expect(playbackMs(quiz.round()!)).toBe(
      2 * (CHORD_MS + GAP_MS) + LAST_CHORD_MS,
    )
    dispose()
  })

  it('stopped, falls silent and strikes nothing more', () => {
    const { quiz, chords, stops, dispose } = run(4)
    const stopsBefore = stops()
    quiz.stop()
    expect(quiz.status()).toBe('complete')
    expect(stops()).toBeGreaterThan(stopsBefore)
    expect(quiz.sounding()).toBe(-1)
    expect(runStoppedEarly(quiz.result()?.metrics)).toBe(true)

    const struck = chords.length
    vi.advanceTimersByTime(10_000)
    expect(chords).toHaveLength(struck)
    dispose()
  })

  it('ends after its last cadence with the share named right', () => {
    const { quiz, dispose } = run(2)
    toLastChord()
    quiz.answer(rightName(quiz))
    vi.advanceTimersByTime(RIGHT_MS)
    toLastChord()
    quiz.answer(wrongName(quiz))
    vi.advanceTimersByTime(playbackMs(quiz.round()!) + AFTER_REPLAY_MS)

    expect(quiz.status()).toBe('complete')
    expect(quiz.result()?.score).toBe(50)
    expect(quiz.result()?.metrics).toMatchObject({
      correct: 1,
      total: 2,
      answered: 2,
    })
    dispose()
  })
})
