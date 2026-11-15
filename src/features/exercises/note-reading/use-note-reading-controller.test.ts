import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Letter } from '@/features/lessons/kit/notes'
import { EXERCISE_NOTE_READING, runStoppedEarly } from '../types'
import type { NoteReadingController } from './use-note-reading-controller'
import { RIGHT_MS, useNoteReadingController, WRONG_MS, } from './use-note-reading-controller'

/** A controller in a root of its own, with what it sounded. */
function run(rounds = 3) {
  const sounded: number[] = []
  let dispose = () => {}
  const quiz = createRoot((d): NoteReadingController => {
    dispose = d
    return useNoteReadingController({
      onNote: (midi) => sounded.push(midi),
      random: () => 0.37,
      now: () => Date.now(),
    })
  })
  quiz.start({ clef: 'treble', difficulty: 5, rounds })
  return { quiz, sounded, dispose }
}

const rightLetter = (quiz: NoteReadingController): Letter => {
  const round = quiz.round()
  if (round === null) throw new Error('no note is up')
  return round.note.letter
}

const wrongLetter = (quiz: NoteReadingController): Letter =>
  rightLetter(quiz) === 'C' ? 'D' : 'C'

describe('a run of Read the Note', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens on its first note, active, with nothing answered', () => {
    const { quiz, dispose } = run()
    expect(quiz.status()).toBe('active')
    expect(quiz.index()).toBe(0)
    expect(quiz.rounds()).toHaveLength(3)
    expect(quiz.marks()).toEqual([])
    expect(quiz.feedback()).toBeNull()
    expect(quiz.result()).toBeNull()
    dispose()
  })

  it('shows a right answer briefly, sounds the note, and moves on', () => {
    const { quiz, sounded, dispose } = run()
    const letter = rightLetter(quiz)
    quiz.answer(letter)
    expect(quiz.feedback()).toEqual({ letter, chosen: letter, right: true })
    expect(quiz.marks()).toEqual([true])
    expect(sounded).toHaveLength(1)

    vi.advanceTimersByTime(RIGHT_MS - 1)
    expect(quiz.index()).toBe(0)
    vi.advanceTimersByTime(1)
    expect(quiz.index()).toBe(1)
    expect(quiz.feedback()).toBeNull()
    dispose()
  })

  it("holds a miss longer, with the note's own letter on show", () => {
    const { quiz, dispose } = run()
    const letter = rightLetter(quiz)
    const chosen = wrongLetter(quiz)
    quiz.answer(chosen)
    expect(quiz.feedback()).toEqual({ letter, chosen, right: false })
    expect(quiz.marks()).toEqual([false])

    vi.advanceTimersByTime(RIGHT_MS)
    expect(quiz.index()).toBe(0)
    vi.advanceTimersByTime(WRONG_MS - RIGHT_MS)
    expect(quiz.index()).toBe(1)
    dispose()
  })

  it('takes one answer a note: a second tap while the first is on show is dropped', () => {
    const { quiz, dispose } = run()
    quiz.answer(wrongLetter(quiz))
    quiz.answer(rightLetter(quiz))
    expect(quiz.marks()).toEqual([false])
    dispose()
  })

  it('ends after its last note with the share read right as the score', () => {
    const { quiz, dispose } = run(3)
    quiz.answer(rightLetter(quiz))
    vi.advanceTimersByTime(RIGHT_MS)
    quiz.answer(wrongLetter(quiz))
    vi.advanceTimersByTime(WRONG_MS)
    quiz.answer(rightLetter(quiz))
    expect(quiz.status()).toBe('active')
    vi.advanceTimersByTime(RIGHT_MS)

    expect(quiz.status()).toBe('complete')
    const result = quiz.result()
    expect(result?.type).toBe(EXERCISE_NOTE_READING)
    expect(result?.score).toBe(67)
    expect(result?.metrics).toMatchObject({ correct: 2, total: 3, answered: 3 })
    expect(runStoppedEarly(result?.metrics)).toBe(false)
    dispose()
  })

  it('times each answer from the moment its note went up', () => {
    const { quiz, dispose } = run(2)
    vi.advanceTimersByTime(1500)
    quiz.answer(rightLetter(quiz))
    vi.advanceTimersByTime(RIGHT_MS)
    vi.advanceTimersByTime(500)
    quiz.answer(rightLetter(quiz))
    vi.advanceTimersByTime(RIGHT_MS)
    expect(quiz.result()?.metrics.avgMs).toBe(1000)
    dispose()
  })

  it('stopped before its end, is scored on the notes reached and marked as stopped', () => {
    const { quiz, dispose } = run(4)
    quiz.answer(rightLetter(quiz))
    vi.advanceTimersByTime(RIGHT_MS)
    quiz.stop()

    expect(quiz.status()).toBe('complete')
    const result = quiz.result()
    expect(result?.score).toBe(100)
    expect(result?.metrics).toMatchObject({ correct: 1, total: 4, answered: 1 })
    expect(runStoppedEarly(result?.metrics)).toBe(true)
    dispose()
  })

  it('stopped while its last answer is on show, is a whole run', () => {
    const { quiz, dispose } = run(1)
    quiz.answer(rightLetter(quiz))
    quiz.stop()
    expect(runStoppedEarly(quiz.result()?.metrics)).toBe(false)
    // The timer the answer set is gone with the run.
    vi.advanceTimersByTime(WRONG_MS)
    expect(quiz.status()).toBe('complete')
    dispose()
  })

  it('goes back to idle on reset, and a later answer does nothing', () => {
    const { quiz, dispose } = run()
    quiz.answer(rightLetter(quiz))
    quiz.reset()
    expect(quiz.status()).toBe('idle')
    expect(quiz.marks()).toEqual([])
    expect(quiz.result()).toBeNull()
    vi.advanceTimersByTime(WRONG_MS)
    expect(quiz.status()).toBe('idle')
    quiz.answer('C')
    expect(quiz.marks()).toEqual([])
    dispose()
  })
})
