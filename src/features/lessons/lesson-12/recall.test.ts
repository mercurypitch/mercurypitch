// ============================================================
// Lesson 12 recall tests — Lesson 10's questions, its chord, and no lesson done
// ============================================================
//
// WEB-SPEC, Toys 8, Tests 11 and End to end 9 at unit level, on the page's
// own markup: the recall asks Lesson 10's questions 1 and 2 under its own
// `recall-` ids, for everyone; answering both marks no lesson done; a
// wrong answer's step link opens Lesson 10's page at that step in a new
// tab where Lesson 10 is live, and keeps its words with no link where it
// is not; the second question's Play is Lesson 10's own D minor, named
// "Play the question's chord", the page's one sound. The quick check's
// `lesson: 12` is main.ts's, which a unit test cannot load, so the
// end-to-end spec holds it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as PageStateModule from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { QUIZ_CHORD } from '@/features/lessons/lesson-10/sounds'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { RECALL_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'

/** Whether the test serves Lesson 10 as live. */
const served = vi.hoisted(() => ({ ten: true }))

vi.mock('@/features/lessons/kit/page-state', async (actual) => {
  const real = await actual<typeof PageStateModule>()
  return {
    ...real,
    lessonLive: (n: number, doc?: Document): boolean =>
      n === 10 ? served.ten : real.lessonLive(n, doc),
  }
})

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

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
  served.ten = true
  resetRuns()
  soundOn()
  loadPage()
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 12's recall", () => {
  it("asks Lesson 10's questions 1 and 2 under its own ids", () => {
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
  })

  it('stores its seed and answers under its own keys, and marks no lesson done once both are answered', () => {
    // Arrange
    initRecall()

    // Act
    for (const i of [0, 1]) el(`#recall-qs .q:nth-child(${i + 1}) .opt`).click()

    // Assert
    expect(document.querySelectorAll('#recall-qs .fb')).toHaveLength(2)
    expect(localStorage.getItem('fyp-l12-recall-seed')).not.toBeNull()
    expect(localStorage.getItem('fyp-l12-recall-v1')).not.toBeNull()
    expect([Done.has(10), Done.has(12)]).toEqual([false, false])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it("links a wrong answer to Lesson 10's step, in a new tab, where Lesson 10 is live", () => {
    // Arrange
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
      ['/learn/10#step-1', '_blank', 'Try Lesson 10, Step 1 again'],
      ['/learn/10#step-3', '_blank', 'Try Lesson 10, Step 3 again'],
    ])
  })

  it('keeps the words and drops the link where Lesson 10 is not live', () => {
    // Arrange
    served.ten = false
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
        (fb) => /Try Lesson 10, Step \d again/.exec(fb.textContent ?? '')?.[0],
      ),
    ).toEqual(['Try Lesson 10, Step 1 again', 'Try Lesson 10, Step 3 again'])
  })

  it("plays Lesson 10's D minor from the second question, named so it shares no name with the cold open's", async () => {
    // Arrange
    initRecall()
    const button = el<HTMLButtonElement>('#recall-qs [data-quiz-play="chord"]')

    // Act
    button.click()
    const lit = button.classList.contains('is-on')
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert: FACTS 67; one sound at a time
    expect(button.getAttribute('aria-label')).toBe("Play the question's chord")
    expect(runs.map((r) => r.notes)).toEqual([QUIZ_CHORD])
    expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
    expect(lit).toBe(true)
    expect(runs[0].stopped).toBe(true)
    expect(button.classList.contains('is-on')).toBe(false)
  })
})
