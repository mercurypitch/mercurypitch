// ============================================================
// Lesson 5 question tests — ids, one right answer each, the step links
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { lessonOfQuestion, linkAway } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_3 } from '@/features/lessons/lesson-03/quiz-questions'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS, recallStepHref, } from './quiz-questions'

describe('the quick check (Toys 7)', () => {
  it('asks four questions, l05-q1 to l05-q4, three answers each, one of them right', () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l05-q1',
      'l05-q2',
      'l05-q3',
      'l05-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      // the kit prints "Right." or "Not quite." first (kit/quiz.ts)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Yes|Right|Correct)\b/)
    }
  })

  it('links back to Steps 2, 1, 4 and 5, one per question', () => {
    const steps = QUIZ_QUESTIONS.flatMap((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) => m[1]),
      ),
    )
    expect(steps).toEqual(['2', '1', '4', '5'])
  })
})

describe('the recall (FACTS 3)', () => {
  it("asks Lesson 3's questions 3 and 4, word for word, under Lesson 3's ids", () => {
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l03-q3', 'l03-q4'])
    expect(RECALL_QUESTIONS.map((q) => lessonOfQuestion(q.id))).toEqual([3, 3])
    expect(RECALL_QUESTIONS).toEqual(
      LESSON_3.filter((q) => q.id === 'l03-q3' || q.id === 'l03-q4'),
    )
  })

  it("turns Lesson 3's step links into links to Lesson 3's page at the step, in a new tab", () => {
    // Arrange: one feedback line as the quiz renders it
    const box = document.createElement('p')
    box.innerHTML = RECALL_QUESTIONS[0].options[1].feedback

    // Act
    linkAway(box, 3, { href: recallStepHref })

    // Assert
    const a = box.querySelector('a')
    expect(a?.textContent).toBe('Try Lesson 3, Step 4 again')
    expect(a?.getAttribute('href')).toBe('/learn/03#step-4')
    expect(a?.target).toBe('_blank')
    expect(a?.hasAttribute('data-goto-step')).toBe(false)
  })
})
