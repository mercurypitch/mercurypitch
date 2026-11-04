// ============================================================
// Lesson 13 question tests — the quick check, and the recall from Lesson 11
// ============================================================
//
// WEB-SPEC, Recall and quick check, and Tests 10: four questions, l13-q1
// to l13-q4, three answers each, the right one first; every line LESSON.md's
// own; no feedback starts "Right", "Yes" or "Correct", since the kit prints
// "Right." or "Not quite." first; every line passes the claims check. Each
// misconception links back to the step whose toy answers it, on this page,
// since every id is Lesson 13's own. And the recall's questions: Lesson
// 11's l11-q1 and l11-q2, word for word, whose step links name Lesson 11's
// Steps 2 and 3. The quick check's `lesson: 13` is main.ts's, which a unit
// test cannot load, so the end-to-end spec holds it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { lessonOfQuestion } from '@/features/lessons/kit/quiz'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'

const LESSON = readFileSync(
  resolve(
    process.cwd(),
    'docs/plans/find-your-pitch/lessons/13-resonance-vowels/LESSON.md',
  ),
  'utf8',
)

/** Markup as text. */
const text = (html: string): string => html.replace(/<[^>]+>/g, '')

/** LESSON.md's prose with its line breaks and its markdown gone, and straight quotes for curly double ones. */
const prose = (s: string): string =>
  s
    .replace(/\*\*\[correct\]\*\*/g, '')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')

/** The section of LESSON.md under `heading`, up to the next one. */
function section(heading: string): string {
  const from = LESSON.indexOf(`## ${heading}`)
  const to = LESSON.indexOf('\n## ', from + 1)
  return prose(LESSON.slice(from, to))
}

/** Every line a question shows, as LESSON.md writes it: its "Try Step N again" in `away`'s words. */
function lines(q: QuizQuestion, away = ''): string[] {
  return [
    q.question,
    ...q.options.flatMap((o) => [
      o.text,
      text(o.feedback).replace(/Try Step/g, `Try ${away}Step`),
    ]),
  ].map(prose)
}

describe('the quick check', () => {
  it('asks four questions, l13-q1 to l13-q4, three answers each, one of them right', () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l13-q1',
      'l13-q2',
      'l13-q3',
      'l13-q4',
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

  it("prints LESSON.md's quick check word for word", () => {
    // Arrange
    const quick = section('Quick check')

    for (const line of QUIZ_QUESTIONS.flatMap((q) => lines(q)))
      // Assert
      expect(quick, line).toContain(line)
  })

  it("reads each id as Lesson 13's own, so its step links move this page's deck", () => {
    expect(QUIZ_QUESTIONS.map((q) => lessonOfQuestion(q.id))).toEqual([
      13, 13, 13, 13,
    ])
  })

  it('links back to Steps 1, 4, 3 and 4, one per question, each from a wrong answer', () => {
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
      ['1', false],
      ['4', false],
      ['3', false],
      ['4', false],
    ])
  })

  it('has no heard question: no slot, and no control in a question', () => {
    for (const q of [...QUIZ_QUESTIONS, ...RECALL_QUESTIONS]) {
      expect(q.slot, q.id).toBeUndefined()
      expect(q.question, q.id).not.toContain('<')
    }
  })

  it('says only what the lesson showed, in lines the claims check passes and with no sign', () => {
    for (const line of [...QUIZ_QUESTIONS, ...RECALL_QUESTIONS].flatMap((q) =>
      lines(q),
    )) {
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
  it("asks Lesson 11's questions 1 and 2 under Lesson 11's ids", () => {
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l11-q1', 'l11-q2'])
    expect(RECALL_QUESTIONS.map((q) => lessonOfQuestion(q.id))).toEqual([
      11, 11,
    ])
  })

  it("prints LESSON.md's recall word for word, its step links naming Lesson 11", () => {
    // Arrange
    const recall = section('Recall from Lesson 11')

    for (const line of RECALL_QUESTIONS.flatMap((q) => lines(q, 'Lesson 11, ')))
      // Assert
      expect(recall, line).toContain(line)
  })

  it("links back to Lesson 11's Steps 2 and 3, each from a wrong answer", () => {
    // Act
    const links = RECALL_QUESTIONS.flatMap((q) =>
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
    ])
  })
})
