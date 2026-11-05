// ============================================================
// Lesson 14 recall — Lesson 5's two questions, on the page's own markup
// ============================================================
//
// WEB-SPEC, Toys 5: Lesson 5's questions 2 and 4 under the prefix rc-,
// shown to everyone, with no play; answering both marks no lesson done;
// a wrong answer links Lesson 5's own step in a new tab where Lesson 5 is
// live, and keeps its words with no link where it is not.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as PageStateModule from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import { el, loadPage } from './page-dom.test-fixtures'
import { RECALL_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'

/** Whether the test serves Lesson 5 as live. */
const served = vi.hoisted(() => ({ five: true }))

vi.mock('@/features/lessons/kit/page-state', async (actual) => {
  const real = await actual<typeof PageStateModule>()
  return {
    ...real,
    lessonLive: (n: number, doc?: Document): boolean =>
      n === 5 ? served.five : real.lessonLive(n, doc),
  }
})

const questions = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('#rc-qs .q'))

/** Picks each question's wrong answer that names a step. */
function pickWrong(): void {
  RECALL_QUESTIONS.forEach((question, i) => {
    const pick = question.options.find(
      (o) => o.correct !== true && o.feedback.includes('data-goto-step'),
    )?.text
    Array.from(
      document.querySelectorAll<HTMLElement>(
        `#rc-qs .q:nth-child(${i + 1}) .opt`,
      ),
    )
      .find((b) => b.querySelector('.opt-t')?.innerHTML === pick)
      ?.click()
  })
}

beforeEach(() => {
  localStorage.clear()
  served.five = true
  loadPage()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 14's recall", () => {
  it("asks Lesson 5's questions 2 and 4 under the prefix rc-, with no play", () => {
    // Act
    initRecall()

    // Assert
    expect(questions().map((q) => q.querySelector('h3')?.innerHTML)).toEqual(
      RECALL_QUESTIONS.map((q) => q.question),
    )
    expect(questions().map((q) => q.querySelector('h3')?.id)).toEqual([
      'rc-q0',
      'rc-q1',
    ])
    expect(document.querySelector('#rc-qs [data-quiz-play]')).toBeNull()
  })

  it('marks no lesson done once both are answered', () => {
    // Arrange
    initRecall()

    // Act
    for (const i of [0, 1]) el(`#rc-qs .q:nth-child(${i + 1}) .opt`).click()

    // Assert
    expect(document.querySelectorAll('#rc-qs .fb')).toHaveLength(2)
    expect([Done.has(5), Done.has(14)]).toEqual([false, false])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it("links a wrong answer to Lesson 5's step in a new tab where it is live, and keeps only the words where it is not", () => {
    // Arrange
    initRecall()

    // Act
    pickWrong()
    const live = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#rc-qs .fb a'),
      (a) => [a.getAttribute('href'), a.target, a.textContent],
    )
    document.body.textContent = ''
    loadPage()
    served.five = false
    initRecall()
    pickWrong()

    // Assert
    expect(live).toEqual([
      ['/learn/05#step-1', '_blank', 'Try Lesson 5, Step 1 again'],
      ['/learn/05#step-5', '_blank', 'Try Lesson 5, Step 5 again'],
    ])
    expect(document.querySelectorAll('#rc-qs .fb a')).toHaveLength(0)
    expect(el('#rc-qs').textContent).toContain('Try Lesson 5, Step 1 again')
  })
})
