// ============================================================
// Lesson 10 question tests — LESSON.md's four, the slot, the recall
// ============================================================
//
// WEB-SPEC, Tests 11 and the quiz half of Tests 10: four questions,
// l10-q1 to l10-q4, three answers each, the right one first and the
// words LESSON.md's; one step link each, to Steps 1, 3, 4 and 5;
// question 2's play button in its slot, showing "Play" and named "Play
// the question's chord"; every sign speakable; no feedback starting
// "Right", "Yes" or "Correct", since the kit prints "Right." or "Not
// quite." first; every line through the claims check. The recall asks
// Lesson 6's questions 2 and 3, its very objects, and their step links
// open Lesson 6's page at Steps 5 and 2 in a new tab.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// the kit's quiz reads the motion setting as it loads
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { lessonOfQuestion, linkAway, recallStepHref, } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_6 } from '@/features/lessons/lesson-06/quiz-questions'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'

/** LESSON.md, its lines joined, so a quoted line can be found across a wrap. */
const LESSON = readFileSync(
  resolve(
    process.cwd(),
    'docs/plans/find-your-pitch/lessons/10-major-minor/LESSON.md',
  ),
  'utf8',
).replace(/\s+/g, ' ')

/** Markup as the eye reads it: the signs shown, the spoken words dropped. */
const shown = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')

/** As shown, with LESSON.md's straight quotes in place of the page's curly ones. */
const seen = (html: string): string => shown(html).replace(/[“”]/g, '"')

/** The steps an option's feedback links back to. */
const linksOf = (html: string): number[] =>
  [...html.matchAll(/data-goto-step="(\d)"/g)].map((m) => Number(m[1]))

/** Every ♯ and ♭ outside an aria-hidden span (a sign a screen reader would not say). */
const bareSigns = (html: string): string[] =>
  html.replace(/<span aria-hidden="true">[♯♭]<\/span>/g, '').match(/[♯♭]/g) ??
  []

describe('the quick check', () => {
  it('asks four questions, l10-q1 to l10-q4, three answers each, one of them right', () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l10-q1',
      'l10-q2',
      'l10-q3',
      'l10-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
    }
  })

  it('puts the right answer first in authored order, as LESSON.md lists it', () => {
    for (const q of QUIZ_QUESTIONS) expect(q.options[0].correct).toBe(true)
  })

  it("asks LESSON.md's questions, answers and feedback word for word, in its order", () => {
    QUIZ_QUESTIONS.forEach((q, i) => {
      // Arrange: a heard question shows its [Play] after "Listen."
      const asked = seen(q.question).replace(/^Listen\. /, 'Listen. [Play] ')

      // Assert
      expect(LESSON).toContain(`${i + 1}. ${asked} - `)
      const [right, ...wrong] = q.options
      const lines = [
        `- ${seen(right.text)} **[correct]** · Feedback: "${seen(right.feedback)}"`,
        ...wrong.map(
          (o) => `- ${seen(o.text)} · Feedback: "${seen(o.feedback)}"`,
        ),
      ]
      expect(LESSON).toContain(lines.join(' '))
    })
  })

  it('prints its quotation marks curly, as the series does', () => {
    // Arrange
    const lines = QUIZ_QUESTIONS.flatMap((q) => [
      shown(q.question),
      ...q.options.flatMap((o) => [shown(o.text), shown(o.feedback)]),
    ])

    // Assert
    for (const line of lines) expect(line, line).not.toContain('"')
    expect(QUIZ_QUESTIONS[2].question).toContain('“Minor always sounds sad.”')
  })

  it('links back to Steps 1, 3, 4 and 5, one per question, from its misconception', () => {
    // Act
    const links = QUIZ_QUESTIONS.map((q) =>
      q.options.map((o) => linksOf(o.feedback)),
    )

    // Assert
    expect(links).toEqual([
      [[], [1], []],
      [[], [3], []],
      [[], [4], []],
      [[], [5], []],
    ])
  })

  it('gives question 2 its play button in its slot, showing "Play" and named "Play the question\'s chord"', () => {
    // Arrange
    const box = document.createElement('div')
    box.innerHTML = QUIZ_QUESTIONS[1].slot ?? ''

    // Act
    const button = box.querySelector('button')

    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.slot === undefined)).toEqual([
      true,
      false,
      true,
      true,
    ])
    expect(button?.dataset.quizPlay).toBe('chord')
    expect(button?.textContent?.trim()).toBe('Play')
    expect(button?.getAttribute('aria-label')).toBe("Play the question's chord")
    expect(button?.type).toBe('button')
    for (const q of QUIZ_QUESTIONS) expect(q.question).not.toContain('<button')
  })

  it('makes every ♯ and ♭ it prints speakable', () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(bareSigns(q.question)).toEqual([])
      for (const o of q.options) {
        expect(bareSigns(o.text)).toEqual([])
        expect(bareSigns(o.feedback)).toEqual([])
      }
    }
    expect(QUIZ_QUESTIONS[0].options[2].feedback).toContain(
      '<span class="sr"> flat</span>',
    )
  })

  it('starts no feedback with "Right", "Yes" or "Correct", and passes every line through the claims check', () => {
    // Arrange
    const lines = QUIZ_QUESTIONS.flatMap((q) => [
      seen(q.question),
      ...q.options.flatMap((o) => [seen(o.text), seen(o.feedback)]),
    ])

    // Assert
    for (const q of QUIZ_QUESTIONS)
      for (const o of q.options)
        expect(seen(o.feedback)).not.toMatch(/^(Yes|Right|Correct)\b/)
    for (const line of lines)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
  })
})

describe('the recall', () => {
  it("asks Lesson 6's questions 2 and 3, its very objects, under Lesson 6's ids", () => {
    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l06-q2', 'l06-q3'])
    expect(RECALL_QUESTIONS.map((q) => lessonOfQuestion(q.id))).toEqual([6, 6])
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_6.find((q) => q.id === 'l06-q2'))
    expect(RECALL_QUESTIONS[1]).toBe(LESSON_6.find((q) => q.id === 'l06-q3'))
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
    expect(recallStepHref(6, 5)).toBe('/learn/06#step-5')
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
