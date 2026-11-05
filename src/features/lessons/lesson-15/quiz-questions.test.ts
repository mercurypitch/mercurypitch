// ============================================================
// Lesson 15 questions tests — the quick check's four and the recall's two
// ============================================================
//
// WEB-SPEC, Tests 6 and 7: the recall's questions are Lesson 2's own
// objects, imported, not copied; the quick check is l15-q1 to l15-q4, three
// answers each and one right, in LESSON.md's words, and no feedback line
// starts with "Right", "Yes" or "Correct", since the kit prints its own.

import { describe, expect, it } from 'vitest'
import { QUIZ_QUESTIONS as LESSON_2_QUESTIONS } from '@/features/lessons/lesson-02/quiz-questions'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'

const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

describe('the quick check', () => {
  it('asks l15-q1 to l15-q4, three answers each, one of them right', () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l15-q1',
      'l15-q2',
      'l15-q3',
      'l15-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options, q.id).toHaveLength(3)
      expect(
        q.options.filter((o) => o.correct === true),
        q.id,
      ).toHaveLength(1)
    }
  })

  it('gives every answer a line of its own that starts with none of the kit’s words', () => {
    for (const q of QUIZ_QUESTIONS)
      for (const o of q.options) {
        expect(text(o.feedback).length, q.id).toBeGreaterThan(10)
        expect(text(o.feedback), q.id).not.toMatch(/^(Right|Yes|Correct)\b/)
      }
  })

  it("keeps question 1's words, which Lesson 16 asks again", () => {
    expect(QUIZ_QUESTIONS[0].question).toBe(
      'In the treble clef, which line does the clef curl round?',
    )
  })

  it('links each misconception back to the step whose toy answers it', () => {
    const links = QUIZ_QUESTIONS.map((q) =>
      q.options
        .map((o) => /data-goto-step="(\d)"/.exec(o.feedback)?.[1])
        .filter((n) => n !== undefined),
    )
    expect(links).toEqual([['1'], ['2'], ['5'], ['4']])
  })

  it("plays question 2's three notes from its slot, named apart from Step 2's plays", () => {
    const [, q2] = QUIZ_QUESTIONS
    expect(q2.slot).toContain('data-quiz-three')
    expect(text(q2.slot ?? '')).toBe('Play the three notes')
    expect(q2.slot).toContain('data-quiz-staff')
  })

  it('stores its answers under its own keys', () => {
    expect(QUIZ_KEYS).toEqual({
      seed: 'fyp-l15-seed',
      record: 'fyp-l15-quiz-v1',
    })
  })
})

describe('the recall', () => {
  it("asks Lesson 2's questions 2 and 3, the very objects Lesson 2's page asks", () => {
    // Assert: WEB-SPEC, Tests 6
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l02-q2', 'l02-q3'])
    for (const q of RECALL_QUESTIONS) expect(LESSON_2_QUESTIONS).toContain(q)
    expect(RECALL_QUESTIONS[0].slot).toContain('data-quiz-pair')
  })

  it('stores its answers apart from the quick check', () => {
    expect(RECALL_KEYS).toEqual({
      seed: 'fyp-l15-recall-seed',
      record: 'fyp-l15-recall-v1',
    })
  })
})
