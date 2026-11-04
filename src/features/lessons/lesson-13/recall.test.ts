// ============================================================
// Lesson 13 recall tests — Lesson 11's questions, and no lesson done
// ============================================================
//
// WEB-SPEC, Recall and quick check, on the page's own markup: the recall
// asks Lesson 11's questions 1 and 2 under its own `recall-` ids, for
// everyone; answering both marks no lesson done; a wrong answer's step link
// opens Lesson 11's page at that step in a new tab where Lesson 11 is live,
// and keeps its words with no link where it is not; neither question has a
// play. The quick check's `lesson: 13` is main.ts's, which a unit test
// cannot load, so the end-to-end spec holds it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as PageStateModule from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import { el, loadPage } from './page-dom.test-fixtures'
import { RECALL_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'

/** Whether the test serves Lesson 11 as live; its page is another branch's. */
const served = vi.hoisted(() => ({ eleven: false }))

vi.mock('@/features/lessons/kit/page-state', async (actual) => {
  const real = await actual<typeof PageStateModule>()
  return {
    ...real,
    lessonLive: (n: number, doc?: Document): boolean =>
      n === 11 ? served.eleven : real.lessonLive(n, doc),
  }
})

const questions = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('#recall-qs .q'))

/** Picks each question's wrong answer that names a step. */
function pickWrong(): void {
  RECALL_QUESTIONS.forEach((question, i) => {
    const pick = question.options.find(
      (o) => o.correct !== true && o.feedback.includes('data-goto-step'),
    )?.text
    Array.from(
      document.querySelectorAll<HTMLElement>(
        `#recall-qs .q:nth-child(${i + 1}) .opt`,
      ),
    )
      .find((b) => b.querySelector('.opt-t')?.innerHTML === pick)
      ?.click()
  })
}

beforeEach(() => {
  localStorage.clear()
  served.eleven = false
  loadPage()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 13's recall", () => {
  it("asks Lesson 11's questions 1 and 2 under its own ids, and no play", () => {
    // Act
    initRecall()

    // Assert
    expect(questions().map((q) => q.querySelector('h3')?.innerHTML)).toEqual(
      RECALL_QUESTIONS.map((q) => q.question),
    )
    expect(questions().map((q) => q.querySelector('h3')?.id)).toEqual([
      'recall-q0',
      'recall-q1',
    ])
    expect(document.querySelector('#recall-qs [data-quiz-play]')).toBeNull()
  })

  it('marks no lesson done once both are answered', () => {
    // Arrange
    initRecall()

    // Act
    for (const i of [0, 1]) el(`#recall-qs .q:nth-child(${i + 1}) .opt`).click()

    // Assert
    expect(document.querySelectorAll('#recall-qs .fb')).toHaveLength(2)
    expect([Done.has(11), Done.has(13)]).toEqual([false, false])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it("links a wrong answer to Lesson 11's step, in a new tab, where Lesson 11 is live", () => {
    // Arrange
    served.eleven = true
    initRecall()

    // Act
    pickWrong()

    // Assert
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#recall-qs .fb a'),
    )
    expect(
      links.map((a) => [a.getAttribute('href'), a.target, a.textContent]),
    ).toEqual([
      ['/learn/11#step-2', '_blank', 'Try Lesson 11, Step 2 again'],
      ['/learn/11#step-3', '_blank', 'Try Lesson 11, Step 3 again'],
    ])
  })

  it('keeps the words and drops the link where Lesson 11 is not live', () => {
    // Arrange
    initRecall()

    // Act
    pickWrong()

    // Assert
    const fbs = Array.from(
      document.querySelectorAll<HTMLElement>('#recall-qs .fb'),
    )
    expect(document.querySelector('#recall-qs .fb a')).toBeNull()
    expect(
      fbs.map(
        (fb) => /Try Lesson 11, Step \d again/.exec(fb.textContent ?? '')?.[0],
      ),
    ).toEqual(['Try Lesson 11, Step 2 again', 'Try Lesson 11, Step 3 again'])
  })
})
