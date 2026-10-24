// ============================================================
// Lesson 9 question tests — ids, one right answer each, the step links
// ============================================================
//
// WEB-SPEC, Tests 8 and 11: four questions, l09-q1 to l09-q4, three answers
// each, one right; no feedback starts "Right", "Yes" or "Correct", since the
// kit prints "Right." or "Not quite." first; every line passes the claims
// check. Each misconception links back to the step whose toy answers it,
// on this page, since every id is Lesson 9's own.

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { lessonOfQuestion, linkAway, recallStepHref, } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_6 } from '@/features/lessons/lesson-06/quiz-questions'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'

/** Markup as text. */
const text = (html: string): string => html.replace(/<[^>]+>/g, '')

describe('the quick check', () => {
  it('asks four questions, l09-q1 to l09-q4, three answers each, one of them right', () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l09-q1',
      'l09-q2',
      'l09-q3',
      'l09-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Yes|Right|Correct)\b/)
    }
  })

  it('puts the right answer first in authored order, as LESSON.md lists it', () => {
    for (const q of QUIZ_QUESTIONS) expect(q.options[0].correct).toBe(true)
  })

  it("reads each id as Lesson 9's own, so its step links move this page's deck", () => {
    // Act
    const owners = QUIZ_QUESTIONS.map((q) => lessonOfQuestion(q.id))

    // Assert
    expect(owners).toEqual([9, 9, 9, 9])
  })

  it('links back to Steps 2, 3, 4 and 5, one per question, each from a wrong answer', () => {
    // Act
    const links = QUIZ_QUESTIONS.flatMap((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) => [
          m[1],
          o.correct === true,
        ]),
      ),
    )

    // Assert
    expect(links).toEqual([
      ['2', false],
      ['3', false],
      ['4', false],
      ['5', false],
    ])
  })

  it('has no heard question: no slot, and no control in a question', () => {
    // Assert
    for (const q of QUIZ_QUESTIONS) {
      expect(q.slot, q.id).toBeUndefined()
      expect(q.question, q.id).not.toContain('<')
    }
  })

  it('says only what the lesson showed, in lines the claims check passes and with no sign', () => {
    // Arrange
    const lines = QUIZ_QUESTIONS.flatMap((q) => [
      q.question,
      ...q.options.flatMap((o) => [o.text, text(o.feedback)]),
    ])

    for (const line of lines) {
      // Assert
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
      expect(line).not.toMatch(/[♯♭]/)
    }
  })
})

describe('the recall', () => {
  it("asks Lesson 6's questions 2 and 3, its very objects, under Lesson 6's ids", () => {
    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l06-q2', 'l06-q3'])
    expect(RECALL_QUESTIONS.map((q) => lessonOfQuestion(q.id))).toEqual([6, 6])
    expect(RECALL_QUESTIONS).toEqual(
      LESSON_6.filter((q) => q.id === 'l06-q2' || q.id === 'l06-q3'),
    )
  })

  it("turns Lesson 6's step links into links to Lesson 6's page at the step, in a new tab", () => {
    // Arrange
    const links = RECALL_QUESTIONS.map((q) => {
      const box = document.createElement('p')
      box.innerHTML = q.options.map((o) => o.feedback).join(' ')

      // Act
      linkAway(box, 6, { href: recallStepHref })
      return box.querySelector('a')
    })

    // Assert
    expect(links.map((a) => a?.getAttribute('href'))).toEqual([
      '/learn/06#step-5',
      '/learn/06#step-2',
    ])
    expect(links.map((a) => a?.textContent)).toEqual([
      'Try Lesson 6, Step 5 again',
      'Try Lesson 6, Step 2 again',
    ])
    expect(links.every((a) => a?.target === '_blank')).toBe(true)
  })
})
