// ============================================================
// Lesson 8 question tests — ids, one right answer each, the step links
// ============================================================
//
// WEB-SPEC, Toys 7 and Tests 10: four questions, three answers each, one
// right; no feedback starts "Right", "Yes" or "Correct", since the kit
// prints "Right." or "Not quite." first; each misconception links back to
// the step whose toy answers it; question 2 is heard, its play in its
// slot. The recall asks Lesson 6's questions 1 and 4, its own objects, and
// their step links open Lesson 6's page at Steps 3 and 4 in a new tab.

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { lessonOfQuestion, linkAway, recallStepHref, } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_6 } from '@/features/lessons/lesson-06/quiz-questions'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'

/** Markup as text. */
const text = (html: string): string => html.replace(/<[^>]+>/g, '')

describe('the quick check', () => {
  it('asks four questions, l08-q1 to l08-q4, three answers each, one of them right', () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l08-q1',
      'l08-q2',
      'l08-q3',
      'l08-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Yes|Right|Correct)\b/)
    }
  })

  it('links back to Steps 2, 3, 4 and 5, one per question', () => {
    // Act
    const steps = QUIZ_QUESTIONS.flatMap((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) => m[1]),
      ),
    )

    // Assert
    expect(steps).toEqual(['2', '3', '4', '5'])
  })

  it('gives question 2 its play button in its slot, outside the heading', () => {
    // Assert
    expect(
      QUIZ_QUESTIONS.map(
        (q) => /data-quiz-play="(\w+)"/.exec(q.slot ?? '')?.[1],
      ),
    ).toEqual([undefined, 'bars', undefined, undefined])
    for (const q of QUIZ_QUESTIONS) expect(q.question).not.toContain('<button')
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
  it("asks Lesson 6's questions 1 and 4, its very objects, under Lesson 6's ids", () => {
    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l06-q1', 'l06-q4'])
    expect(RECALL_QUESTIONS.map((q) => lessonOfQuestion(q.id))).toEqual([6, 6])
    expect(RECALL_QUESTIONS).toEqual(
      LESSON_6.filter((q) => q.id === 'l06-q1' || q.id === 'l06-q4'),
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
      '/learn/06#step-3',
      '/learn/06#step-4',
    ])
    expect(links.map((a) => a?.textContent)).toEqual([
      'Try Lesson 6, Step 3 again',
      'Try Lesson 6, Step 4 again',
    ])
    expect(links.every((a) => a?.target === '_blank')).toBe(true)
  })
})
