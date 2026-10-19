// ============================================================
// Lesson 3 question tests — ids, one right answer each, the step links
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { lessonOfQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS, recallStepHref, } from './quiz-questions'

describe('the quick check (Toys 8)', () => {
  it('asks four questions, l03-q1 to l03-q4, three answers each, one of them right', () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l03-q1',
      'l03-q2',
      'l03-q3',
      'l03-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      // the kit prints "Right." or "Not quite." first (kit/quiz.ts)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Yes|Right)\b/)
    }
  })

  it('links back to Steps 1, 4 and 5', () => {
    const steps = QUIZ_QUESTIONS.flatMap((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) => m[1]),
      ),
    )
    expect(steps).toEqual(['1', '4', '5'])
  })
})

describe('the recall (FACTS 44)', () => {
  it("asks Lesson 2's questions 2 and 4 under their own ids, the first with its play button", () => {
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l02-q2', 'l02-q4'])
    expect(RECALL_QUESTIONS.map((q) => lessonOfQuestion(q.id))).toEqual([2, 2])
    expect(RECALL_QUESTIONS[0].slot).toContain('Play the two steps')
    expect(RECALL_QUESTIONS[1].slot).toBeUndefined()
  })

  it("keeps Lesson 2's step links, for the kit to point at Lesson 2's page", () => {
    const links = RECALL_QUESTIONS.flatMap((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/>(Try Step \d again)</g), (m) => m[1]),
      ),
    )
    expect(links).toEqual([
      'Try Step 3 again',
      'Try Step 3 again',
      'Try Step 6 again',
    ])
  })

  it("opens Lesson 2's page at the step, which its step deck reads from the address", () => {
    expect(recallStepHref(2, 3)).toBe('/learn/02#step-3')
    expect(recallStepHref(2, 6)).toBe('/learn/02#step-6')
  })
})
