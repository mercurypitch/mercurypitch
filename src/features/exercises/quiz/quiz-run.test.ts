import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_NOTE_READING, runStoppedEarly } from '../types'
import { createQuizRun, quizScore } from './quiz-run'

/** A run whose rounds are numbers, answered right by the same number. */
function run(holds = { right: 100, wrong: 300 }) {
  const seen: string[] = []
  let dispose = () => {}
  const quiz = createRoot((d) => {
    dispose = d
    return createQuizRun<number, number>({
      type: EXERCISE_NOTE_READING,
      isRight: (round, answer) => round === answer,
      holdMs: (right) => (right ? holds.right : holds.wrong),
      onRound: (round) => seen.push(`round ${round}`),
      onAnswer: (round, right) => seen.push(`answer ${round} ${right}`),
      onEnd: () => seen.push('end'),
      now: () => Date.now(),
    })
  })
  return { quiz, seen, dispose }
}

describe('a quiz run', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is idle until it is started, then puts its first round up', () => {
    const { quiz, seen, dispose } = run()
    expect(quiz.status()).toBe('idle')
    expect(quiz.round()).toBeNull()

    quiz.start([7, 8, 9])
    expect(quiz.status()).toBe('active')
    expect(quiz.round()).toBe(7)
    expect(seen).toEqual(['round 7'])
    dispose()
  })

  it('holds a right answer for its hold, then puts the next round up', () => {
    const { quiz, seen, dispose } = run()
    quiz.start([7, 8])
    quiz.answer(7)
    expect(quiz.feedback()).toEqual({ chosen: 7, right: true })
    expect(quiz.marks()).toEqual([true])

    vi.advanceTimersByTime(99)
    expect(quiz.round()).toBe(7)
    vi.advanceTimersByTime(1)
    expect(quiz.round()).toBe(8)
    expect(quiz.feedback()).toBeNull()
    expect(seen).toEqual(['round 7', 'answer 7 true', 'round 8'])
    dispose()
  })

  it('holds a wrong answer for the hold a miss is given', () => {
    const { quiz, dispose } = run()
    quiz.start([7, 8])
    quiz.answer(1)
    expect(quiz.feedback()).toEqual({ chosen: 1, right: false })
    vi.advanceTimersByTime(299)
    expect(quiz.round()).toBe(7)
    vi.advanceTimersByTime(1)
    expect(quiz.round()).toBe(8)
    dispose()
  })

  it('drops a second answer while the first is on show', () => {
    const { quiz, dispose } = run()
    quiz.start([7, 8])
    quiz.answer(1)
    quiz.answer(7)
    expect(quiz.marks()).toEqual([false])
    dispose()
  })

  it('ends after its last round with the share answered right', () => {
    const { quiz, seen, dispose } = run()
    quiz.start([7, 8, 9])
    quiz.answer(7)
    vi.advanceTimersByTime(100)
    quiz.answer(0)
    vi.advanceTimersByTime(300)
    quiz.answer(9)
    expect(quiz.status()).toBe('active')
    vi.advanceTimersByTime(100)

    expect(quiz.status()).toBe('complete')
    const result = quiz.result()
    expect(result?.type).toBe(EXERCISE_NOTE_READING)
    expect(result?.score).toBe(67)
    expect(result?.metrics).toMatchObject({ correct: 2, total: 3, answered: 3 })
    expect(runStoppedEarly(result?.metrics)).toBe(false)
    expect(seen[seen.length - 1]).toBe('end')
    dispose()
  })

  it('times each answer from the moment its round went up', () => {
    const { quiz, dispose } = run()
    quiz.start([7, 8])
    vi.advanceTimersByTime(1500)
    quiz.answer(7)
    vi.advanceTimersByTime(100)
    vi.advanceTimersByTime(500)
    quiz.answer(8)
    vi.advanceTimersByTime(100)
    expect(quiz.result()?.metrics.avgMs).toBe(1000)
    dispose()
  })

  it('stopped before its end, is scored on the rounds reached and marked as stopped', () => {
    const { quiz, seen, dispose } = run()
    quiz.start([7, 8, 9, 10])
    quiz.answer(7)
    vi.advanceTimersByTime(100)
    quiz.stop()

    expect(quiz.status()).toBe('complete')
    expect(quiz.result()?.score).toBe(100)
    expect(quiz.result()?.metrics).toMatchObject({
      correct: 1,
      total: 4,
      answered: 1,
    })
    expect(runStoppedEarly(quiz.result()?.metrics)).toBe(true)
    expect(seen[seen.length - 1]).toBe('end')
    dispose()
  })

  it('stopped while its last answer is on show, is a whole run', () => {
    const { quiz, dispose } = run()
    quiz.start([7])
    quiz.answer(7)
    quiz.stop()
    expect(runStoppedEarly(quiz.result()?.metrics)).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(quiz.status()).toBe('complete')
    dispose()
  })

  it('goes back to idle on reset, and takes no answer after it', () => {
    const { quiz, seen, dispose } = run()
    quiz.start([7, 8])
    quiz.answer(7)
    quiz.reset()
    expect(quiz.status()).toBe('idle')
    expect(quiz.marks()).toEqual([])
    expect(quiz.result()).toBeNull()
    expect(seen[seen.length - 1]).toBe('end')
    vi.advanceTimersByTime(1000)
    expect(quiz.status()).toBe('idle')
    quiz.answer(7)
    expect(quiz.marks()).toEqual([])
    dispose()
  })
})

describe('the score of a quiz run', () => {
  it('is the share answered right, to the nearest whole number', () => {
    expect(quizScore(10, 10)).toBe(100)
    expect(quizScore(7, 10)).toBe(70)
    expect(quizScore(2, 3)).toBe(67)
    expect(quizScore(0, 10)).toBe(0)
  })

  it('is nothing for a run with no round answered', () => {
    expect(quizScore(0, 0)).toBe(0)
  })
})
