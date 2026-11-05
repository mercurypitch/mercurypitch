// ============================================================
// Lesson 17 questions tests — the quick check's four and the recall's two
// ============================================================
//
// WEB-SPEC, Toys 9: the recall's questions are Lesson 8's own objects,
// imported, not copied, its question 1 left out; the quick check is l17-q1
// to l17-q4, three answers each and one right, in LESSON.md's words, each
// misconception linked back to its step, no feedback line starts with
// "Right", "Yes" or "Correct", since the kit prints its own, and every line
// passes the claims check.

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { QUIZ_QUESTIONS as LESSON_8_QUESTIONS } from '@/features/lessons/lesson-08/quiz-questions'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'

const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

describe('the quick check', () => {
  it('asks l17-q1 to l17-q4, three answers each, one of them right', () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l17-q1',
      'l17-q2',
      'l17-q3',
      'l17-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options, q.id).toHaveLength(3)
      expect(
        q.options.filter((o) => o.correct === true),
        q.id,
      ).toHaveLength(1)
    }
    expect(QUIZ_QUESTIONS.map((q) => text(q.options[0].text))).toEqual([
      '4',
      'Half a second',
      'Three beats',
      'Two eighths, then a quarter',
    ])
  })

  it('gives every answer a line of its own that starts with none of the kit’s words', () => {
    for (const q of QUIZ_QUESTIONS)
      for (const o of q.options) {
        expect(text(o.feedback).length, q.id).toBeGreaterThan(10)
        expect(text(o.feedback), q.id).not.toMatch(/^(Right|Yes|Correct)\b/)
      }
  })

  it('links each misconception back to the step whose toy answers it', () => {
    const links = QUIZ_QUESTIONS.map((q) =>
      q.options
        .map((o) => /data-goto-step="(\d)"/.exec(o.feedback)?.[1])
        .filter((n) => n !== undefined),
    )
    expect(links).toEqual([['1'], ['2'], ['5'], ['3']])
  })

  it("plays question 4's rhythm from its slot, drawn as nothing", () => {
    const q4 = QUIZ_QUESTIONS[3]
    expect(text(q4.question)).toBe('Listen. Which rhythm did you hear?')
    expect(q4.slot).toContain('data-quiz-rhythm')
    expect(text(q4.slot ?? '')).toBe('Play the rhythm')
    expect(q4.slot).not.toContain('<svg class="l17')
  })

  it('says only what the lesson showed, in lines the claims check passes', () => {
    const lines = QUIZ_QUESTIONS.flatMap((q) => [
      text(q.question),
      ...q.options.flatMap((o) => [text(o.text), text(o.feedback)]),
    ])
    for (const line of lines)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
  })

  it('stores its answers under its own keys', () => {
    expect(QUIZ_KEYS).toEqual({
      seed: 'fyp-l17-seed',
      record: 'fyp-l17-quiz-v1',
    })
  })
})

describe('the recall', () => {
  it("asks Lesson 8's questions 2 and 4, the very objects Lesson 8's page asks, and leaves its question 1 out", () => {
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l08-q2', 'l08-q4'])
    for (const q of RECALL_QUESTIONS) expect(LESSON_8_QUESTIONS).toContain(q)
    expect(RECALL_QUESTIONS[0].slot).toContain('data-quiz-play="bars"')
  })

  it('stores its answers apart from the quick check', () => {
    expect(RECALL_KEYS).toEqual({
      seed: 'fyp-l17-recall-seed',
      record: 'fyp-l17-recall-v1',
    })
  })
})
