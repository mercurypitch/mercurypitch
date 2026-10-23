// ============================================================
// Lesson 6 question tests — ids, one right answer each, the step links
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { lessonOfQuestion, linkAway } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_4 } from '@/features/lessons/lesson-04/quiz-questions'
import { QUIZ_QUESTIONS, RECALL_AWAY, RECALL_QUESTIONS } from './quiz-questions'

/** Markup as the eye reads it: the signs shown, the spoken words dropped. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')

describe('the quick check (Toys 7)', () => {
  it('asks four questions, l06-q1 to l06-q4, three answers each, one of them right', () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l06-q1',
      'l06-q2',
      'l06-q3',
      'l06-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      // the kit prints "Right." or "Not quite." first (kit/quiz.ts)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Yes|Right|Correct)\b/)
    }
  })

  it('links back to Steps 3, 5, 2 and 4, one per question', () => {
    const steps = QUIZ_QUESTIONS.flatMap((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) => m[1]),
      ),
    )
    expect(steps).toEqual(['3', '5', '2', '4'])
  })

  it('gives questions 1 and 3 a play button in their slot, outside the heading', () => {
    expect(
      QUIZ_QUESTIONS.map(
        (q) => /data-quiz-play="(\w+)"/.exec(q.slot ?? '')?.[1],
      ),
    ).toEqual(['lines', undefined, 'fourth', undefined])
    for (const q of QUIZ_QUESTIONS) expect(q.question).not.toContain('<button')
  })

  it('prints F♯ with its spoken name', () => {
    const q1 = QUIZ_QUESTIONS[0]
    expect(seen(q1.question)).toBe(
      'Merc sings the first line from C, then from F♯. What stayed the same?',
    )
    expect(q1.question).toContain('<span class="sr"> sharp')
  })
})

describe('the recall (FACTS 7)', () => {
  it("asks Lesson 4's questions 1 and 4, word for word, under Lesson 4's ids", () => {
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l04-q1', 'l04-q4'])
    expect(RECALL_QUESTIONS.map((q) => lessonOfQuestion(q.id))).toEqual([4, 4])
    expect(RECALL_QUESTIONS).toEqual(
      LESSON_4.filter((q) => q.id === 'l04-q1' || q.id === 'l04-q4'),
    )
  })

  it("turns Lesson 4's step link into a link to that step on Lesson 4's page, in a new tab", () => {
    // Arrange: the feedback line as the quiz renders it
    const box = document.createElement('p')
    box.innerHTML = RECALL_QUESTIONS[0].options[1].feedback

    // Act: with the links main.ts gives the recall's quiz
    linkAway(box, 4, RECALL_AWAY)

    // Assert
    const a = box.querySelector('a')
    expect(a?.textContent).toBe('Try Lesson 4, Step 1 again')
    expect(a?.getAttribute('href')).toBe('/learn/04#step-1')
    expect(a?.target).toBe('_blank')
    expect(a?.hasAttribute('data-goto-step')).toBe(false)
  })
})
