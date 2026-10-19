// ============================================================
// Lesson 2 quick check tests — the film's four recap questions
// ============================================================

import { describe, expect, it } from 'vitest'
import { QUIZ_QUESTIONS } from './quiz-questions'

/** The steps an option's feedback links back to. */
const linksOf = (html: string): number[] =>
  [...html.matchAll(/data-goto-step="(\d)"/g)].map((m) => Number(m[1]))

/** Every ♯ and ♭ outside an aria-hidden span (a sign a screen reader would not say). */
const bareSigns = (html: string): string[] =>
  html.replace(/<span aria-hidden="true">[♯♭]<\/span>/g, '').match(/[♯♭]/g) ??
  []

describe('QUIZ_QUESTIONS', () => {
  it("asks LESSON.md's four questions under the ids l02-q1 to l02-q4, three answers each, one right", () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l02-q1',
      'l02-q2',
      'l02-q3',
      'l02-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
    }
    expect(QUIZ_QUESTIONS[0].question).toBe(
      'How many semitones make an octave?',
    )
  })

  it('links each misconception back to the step whose toy answers it: 2, 3, 5 and 6', () => {
    const links = QUIZ_QUESTIONS.map((q) =>
      q.options.map((o) => linksOf(o.feedback)),
    )
    expect(links[0]).toEqual([[], [2], []])
    // both wrong answers to question 2 hold mix-up card 1's belief
    expect(links[1]).toEqual([[], [3], [3]])
    expect(links[2]).toEqual([[], [5], []])
    expect(links[3]).toEqual([[], [6], []])
  })

  it('answers question 2 by ear, with its own play button and chips outside the heading', () => {
    const q2 = QUIZ_QUESTIONS[1]
    expect(q2.slot).toContain('data-quiz-pair')
    expect(q2.slot).toContain('data-pair-chip="1"')
    expect(q2.slot).toContain('data-pair-chip="2"')
    expect(q2.question).not.toContain('<button')
  })

  it('makes every ♯ and ♭ it prints speakable', () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(bareSigns(q.question)).toEqual([])
      for (const o of q.options) {
        expect(bareSigns(o.text)).toEqual([])
        expect(bareSigns(o.feedback)).toEqual([])
      }
    }
    expect(QUIZ_QUESTIONS[2].question).toContain(
      '<span class="sr"> sharp</span>',
    )
  })
})
