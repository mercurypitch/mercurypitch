// ============================================================
// Lesson 4 quiz tests — the quick check, and the recall from Lesson 2
// ============================================================

import { describe, expect, it } from 'vitest'
// its recall links come from the kit's quiz now, which reads the motion setting as it loads
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { QUIZ_QUESTIONS as LESSON_2_QUESTIONS } from '@/features/lessons/lesson-02/quiz-questions'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS, recallStepHref, } from './quiz-questions'

/** The steps an option's feedback links back to. */
const linksOf = (html: string): number[] =>
  [...html.matchAll(/data-goto-step="(\d)"/g)].map((m) => Number(m[1]))

/** Every ♯ and ♭ outside an aria-hidden span (a sign a screen reader would not say). */
const bareSigns = (html: string): string[] =>
  html.replace(/<span aria-hidden="true">[♯♭]<\/span>/g, '').match(/[♯♭]/g) ??
  []

describe('QUIZ_QUESTIONS', () => {
  it("asks LESSON.md's four questions under the ids l04-q1 to l04-q4, three answers each, one right", () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l04-q1',
      'l04-q2',
      'l04-q3',
      'l04-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
    }
    expect(QUIZ_QUESTIONS[0].question).toBe(
      'Which pattern of steps makes a major scale?',
    )
    expect(QUIZ_QUESTIONS[3].question).toBe('In D major, which note is mi?')
  })

  it('puts the right answer first in authored order, as LESSON.md lists it', () => {
    for (const q of QUIZ_QUESTIONS) expect(q.options[0].correct).toBe(true)
  })

  it('links the two misconceptions back to steps 1 and 3', () => {
    const links = QUIZ_QUESTIONS.map((q) =>
      q.options.map((o) => linksOf(o.feedback)),
    )
    expect(links).toEqual([
      [[], [1], []],
      [[], [3], []],
      [[], [], []],
      [[], [], []],
    ])
  })

  it("answers question 3 by ear, with its play button in the question's slot", () => {
    const q3 = QUIZ_QUESTIONS[2]
    expect(q3.slot).toContain('data-quiz-stop')
    expect(q3.question).not.toContain('<button')
  })

  it('makes every ♯ and ♭ it prints speakable', () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(bareSigns(q.question)).toEqual([])
      for (const o of q.options) {
        expect(bareSigns(o.text)).toEqual([])
        expect(bareSigns(o.feedback)).toEqual([])
      }
    }
    expect(QUIZ_QUESTIONS[3].options[0].text).toContain(
      '<span class="sr"> sharp</span>',
    )
  })
})

describe('RECALL_QUESTIONS', () => {
  it("asks Lesson 2's questions 1 and 3, its very own, under their Lesson 2 ids", () => {
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l02-q1', 'l02-q3'])
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_2_QUESTIONS[0])
    expect(RECALL_QUESTIONS[1]).toBe(LESSON_2_QUESTIONS[2])
  })

  it("sends a viewer back to Lesson 2's page, open at the step", () => {
    expect(recallStepHref(2, 2)).toBe('/learn/02#step-2')
    expect(recallStepHref(2, 5)).toBe('/learn/02#step-5')
  })
})
