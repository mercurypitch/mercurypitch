// ============================================================
// Lesson 11 question tests — the recall and the quick check
// ============================================================
//
// WEB-SPEC, Tests 8 and 11: the recall is Lesson 7's questions 1 and 4,
// the very objects Lesson 7's module holds, under ids l07-q1 and l07-q4,
// stored under keys of its own, marking no lesson done, its step links
// opening Lesson 7's page at Steps 1 and 5; the quick check is LESSON.md's
// four questions word for word, l11-q1 to l11-q4, three answers each, one
// right, stored under fyp-l11-seed and fyp-l11-quiz-v1. No feedback starts
// "Right", "Yes" or "Correct", since the kit prints "Right." or "Not
// quite." first, and every line passes the claims check.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { recallStepHref } from '@/features/lessons/kit/quiz'
import { QUIZ_QUESTIONS as LESSON_7 } from '@/features/lessons/lesson-07/quiz-questions'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'
import { RECALL_KEYS } from './recall'

/** Markup as the eye reads it. */
const seen = (html: string): string => html.replace(/<[^>]+>/g, '')

/** LESSON.md's quick check: each question, then each answer and its feedback, in authored order. */
function lessonQuickCheck(): string[] {
  const md = readFileSync(
    resolve(
      process.cwd(),
      'docs/plans/find-your-pitch/lessons/11-registers-break/LESSON.md',
    ),
    'utf8',
  )
  const section = md.slice(md.indexOf('## Quick check'), md.indexOf('## Wrap'))
  // each list item on one line
  const items = section.split('\n').reduce<string[]>((out, line) => {
    if (/^\d+\. |^\s+- /.test(line)) out.push(line.trim())
    else if (/^\s+\S/.test(line) && out.length > 0)
      out[out.length - 1] += ` ${line.trim()}`
    return out
  }, [])
  return items.flatMap((item) => {
    const question = /^\d+\. (.*)$/.exec(item)
    if (question !== null) return [question[1]]
    const answer = /^- (.*?)(?: \*\*\[correct\]\*\*)? · Feedback: "(.*)"$/.exec(
      item,
    )
    return answer === null ? [] : [answer[1], answer[2]]
  })
}

const lines = (): string[] =>
  QUIZ_QUESTIONS.flatMap((q) => [
    q.question,
    ...q.options.flatMap((o) => [o.text, o.feedback]),
  ])

describe('the recall (Toys 5, Tests 11)', () => {
  it("asks Lesson 7's questions 1 and 4, the very objects its module holds", () => {
    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l07-q1', 'l07-q4'])
    for (const q of RECALL_QUESTIONS) expect(LESSON_7).toContain(q)
  })

  it('stores its answers under keys of its own', () => {
    // Assert
    expect(RECALL_KEYS).toEqual({
      seed: 'fyp-l11-recall-seed',
      record: 'fyp-l11-recall-v1',
    })
  })

  it("sends its step links to Lesson 7's page at Steps 1 and 5", () => {
    // Act
    const steps = RECALL_QUESTIONS.flatMap((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) =>
          recallStepHref(7, Number(m[1])),
        ),
      ),
    )

    // Assert
    expect(steps).toEqual(['/learn/07#step-1', '/learn/07#step-5'])
  })
})

describe('the quick check (Toys 5, Tests 11)', () => {
  it('asks four questions, l11-q1 to l11-q4, three answers each, one of them right', () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l11-q1',
      'l11-q2',
      'l11-q3',
      'l11-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      expect(q.options[0].correct).toBe(true)
    }
  })

  it('stores its answer order and record under fyp-l11-seed and fyp-l11-quiz-v1', () => {
    // Assert
    expect(QUIZ_KEYS).toEqual({
      seed: 'fyp-l11-seed',
      record: 'fyp-l11-quiz-v1',
    })
  })

  it("shows LESSON.md's questions, answers and feedback word for word, in authored order", () => {
    // Assert
    expect(lines().map(seen)).toEqual(lessonQuickCheck())
  })

  it('links back to Steps 2, 3, 4 and 5, in that order', () => {
    // Act
    const steps = QUIZ_QUESTIONS.flatMap((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) => m[1]),
      ),
    )

    // Assert
    expect(steps).toEqual(['2', '3', '4', '5'])
  })

  it('starts no feedback line with "Right", "Yes" or "Correct"', () => {
    // Assert
    for (const q of [...QUIZ_QUESTIONS, ...RECALL_QUESTIONS])
      for (const o of q.options)
        expect(seen(o.feedback)).not.toMatch(/^(Yes|Right|Correct)\b/)
  })

  it('passes the claims check', () => {
    for (const line of lines().map(seen)) {
      // Act
      const { violations } = validateGuidedDynamicClaim({
        surface: 'finding',
        text: line,
      })

      // Assert
      expect(violations, line).toEqual([])
    }
  })
})
