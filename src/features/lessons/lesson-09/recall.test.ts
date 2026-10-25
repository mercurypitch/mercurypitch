// ============================================================
// Lesson 9 recall tests — Lesson 6's own questions, and no lesson done
// ============================================================
//
// WEB-SPEC, Tests 11, on the page's own markup: the recall asks Lesson 6's
// questions 2 and 3, the very objects Lesson 6's page asks, under its own
// `rc-` ids, for everyone; answering both marks no lesson done; a wrong
// answer's step link opens Lesson 6's page at that step in a new tab; and
// question 3's Play is Lesson 6's own C4 then F4 (FACTS 96), the page's one
// sound. The quick check's `lesson: 9` is main.ts's, which a unit test
// cannot load, so End to end 8 holds it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Done } from '@/features/lessons/kit/progress'
import { Sound } from '@/features/lessons/kit/sound'
import { QUIZ_FOURTH } from '@/features/lessons/lesson-06/examples'
import { QUIZ_QUESTIONS as LESSON_6_QUESTIONS } from '@/features/lessons/lesson-06/quiz-questions'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { RECALL_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'

const questions = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('#rc-qs .q'))

beforeEach(() => {
  localStorage.clear()
  soundOn()
  loadPage()
  initRecall()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 9's recall", () => {
  it("asks Lesson 6's questions 2 and 3, the very objects Lesson 6 asks, under its own ids", () => {
    // Act
    const asked = questions().map(
      (q) => el(`#${q.querySelector('h3')?.id ?? ''}`).innerHTML,
    )

    // Assert
    expect(RECALL_QUESTIONS.map((q) => LESSON_6_QUESTIONS.indexOf(q))).toEqual([
      1, 2,
    ])
    expect(asked).toEqual(RECALL_QUESTIONS.map((q) => q.question))
    expect(questions().map((q) => q.querySelector('h3')?.id)).toEqual([
      'rc-q0',
      'rc-q1',
    ])
  })

  it('marks no lesson done once both are answered', () => {
    // Act
    for (const i of [0, 1]) el(`#rc-qs .q:nth-child(${i + 1}) .opt`).click()

    // Assert
    expect(document.querySelectorAll('#rc-qs .fb')).toHaveLength(2)
    expect([Done.has(6), Done.has(9)]).toEqual([false, false])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it("links a wrong answer to Lesson 6's step, in a new tab", () => {
    // Arrange: each question's wrong answer that names a step
    const wrong = (i: number): number =>
      RECALL_QUESTIONS[i].options.findIndex(
        (o) => o.correct !== true && o.feedback.includes('data-goto-step'),
      )

    // Act
    for (const i of [0, 1]) {
      const pick = RECALL_QUESTIONS[i].options[wrong(i)].text
      const opt = Array.from(
        document.querySelectorAll<HTMLElement>(
          `#rc-qs .q:nth-child(${i + 1}) .opt`,
        ),
      ).find((b) => b.querySelector('.opt-t')?.innerHTML === pick)
      opt?.click()
    }

    // Assert
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#rc-qs .fb a'),
    )
    expect(
      links.map((a) => [a.getAttribute('href'), a.target, a.textContent]),
    ).toEqual([
      ['/learn/06#step-5', '_blank', 'Try Lesson 6, Step 5 again'],
      ['/learn/06#step-2', '_blank', 'Try Lesson 6, Step 2 again'],
    ])
  })

  it("plays question 3's pair as Lesson 6 plays it, and stops it for any other sound", async () => {
    // Arrange
    vi.useFakeTimers()
    const voice = vi.spyOn(Sound, 'voice').mockReturnValue(null)
    const play = el('#rc-qs [data-quiz-play="fourth"]')

    // Act
    play.click()
    vi.advanceTimersByTime(Math.max(...QUIZ_FOURTH.map((e) => e.at)) * 1000)
    const playing = play.classList.contains('is-on')
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(voice.mock.calls.map(([f]) => f)).toEqual(
      QUIZ_FOURTH.map((e) => hz(e.midi)),
    )
    expect(playing).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })
})
