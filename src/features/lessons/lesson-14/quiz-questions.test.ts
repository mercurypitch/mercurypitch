// ============================================================
// Lesson 14 question tests — the quick check, and the recall from Lesson 5
// ============================================================
//
// WEB-SPEC, Toys 5: four questions, l14-q1 to l14-q4, three answers each,
// the right one first; every line LESSON.md's own; no feedback starts
// "Right", "Yes" or "Correct", since the kit prints "Right." or "Not
// quite." first; every line passes the claims check. Each misconception
// links back to the step whose toy answers it (Steps 2, 2, 3 and 4). And
// the recall: Lesson 5's l05-q2 and l05-q4, word for word, the very objects
// its page asks.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { QuizQuestion } from '@/features/lessons/kit/quiz'
import { lessonOfQuestion } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_5 } from '@/features/lessons/lesson-05/quiz-questions'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'

const LESSON = readFileSync(
  resolve(
    process.cwd(),
    'docs/plans/find-your-pitch/lessons/14-phrasing-whole-song/LESSON.md',
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

/**
 * Every line a question shows, as LESSON.md writes it, each whole: the
 * question after its number, an answer between its dash and the
 * feedback's dot, the feedback in its quotes, its "Try Step N again" in
 * `away`'s words.
 */
function lines(q: QuizQuestion, away = ''): string[] {
  return [
    `. ${q.question} -`,
    ...q.options.flatMap((o) => [
      `- ${o.text} ${o.correct === true ? ' ' : ''}·`,
      `Feedback: "${text(o.feedback)
        .trim()
        .replace(/Try Step/g, `Try ${away}Step`)}"`,
    ]),
  ].map(prose)
}

/** A line as the claims check reads it: the words alone. */
const words = (line: string): string =>
  line.replace(/^\. |^- | -$| ·$|^Feedback: "|"$/g, '').trim()

describe('the quick check', () => {
  it('asks four questions, l14-q1 to l14-q4, three answers each, the right one first, under its own keys', () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l14-q1',
      'l14-q2',
      'l14-q3',
      'l14-q4',
    ])
    expect(QUIZ_KEYS).toEqual({
      seed: 'fyp-l14-seed',
      record: 'fyp-l14-quiz-v1',
    })
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      expect(q.options[0].correct).toBe(true)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Yes|Right|Correct)\b/)
    }
    expect(QUIZ_QUESTIONS.map((q) => lessonOfQuestion(q.id))).toEqual([
      14, 14, 14, 14,
    ])
  })

  it("prints LESSON.md's quick check word for word", () => {
    const quick = section('Quick check')
    for (const line of QUIZ_QUESTIONS.flatMap((q) => lines(q)))
      expect(quick, line).toContain(line)
  })

  it('links back to Steps 2, 2, 3 and 4, one per question, each from a wrong answer', () => {
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
      ['2', false],
      ['3', false],
      ['4', false],
    ])
  })

  it('says only what the lesson showed, in lines the claims check passes', () => {
    for (const line of [...QUIZ_QUESTIONS, ...RECALL_QUESTIONS].flatMap((q) =>
      lines(q).map(words),
    ))
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
  })
})

describe('the recall', () => {
  it("asks Lesson 5's own questions 2 and 4, the objects its page asks, as LESSON.md prints them", () => {
    // Act
    const recall = section('Recall from Lesson 5')

    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l05-q2', 'l05-q4'])
    for (const q of RECALL_QUESTIONS) expect(LESSON_5).toContain(q)
    for (const line of RECALL_QUESTIONS.flatMap((q) => lines(q, 'Lesson 5, ')))
      expect(recall, line).toContain(line)
  })
})
