// ============================================================
// Lesson 10 quiz play tests — question 2's chord, the page's one sound
// ============================================================
//
// On the page's own markup, the quick check mounted as main.ts mounts it
// and its runs recorded (kit/run-recorder.test-fixtures.ts): question 2's
// Play sounds D4, F4 and A4 together for 1.4 s in the soft tone (FACTS
// 79); it claims the page's one sound, so the sound before it stops and
// another sound stops it; a second press plays it afresh; with sound off
// it plays silently. The binder is exported, so Lesson 12's recall binds
// it on a host of its own, which the last test does too.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { createQuiz } from '@/features/lessons/kit/quiz'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { bindQuizPlays } from './quiz-play'
import { QUIZ_QUESTIONS } from './quiz-questions'
import { QUIZ_CHORD } from './sounds'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const play = (): HTMLButtonElement =>
  el<HTMLButtonElement>('#qs [data-quiz-play="chord"]')

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  soundOn()
  loadPage()
  const quiz = createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 10,
    keys: { seed: 'fyp-l10-seed', record: 'fyp-l10-quiz-v1' },
  })
  bindQuizPlays(quiz.host)
})

afterEach(() => {
  live().forEach((r) => r.end(false))
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 10's quiz play", () => {
  it("plays question 2's D minor chord, D4, F4 and A4 together for 1.4 s, in the soft tone", () => {
    // Act
    play().click()

    // Assert
    expect(runs.map((r) => r.notes)).toEqual([QUIZ_CHORD])
    expect(QUIZ_CHORD.map((n) => [n.t, n.midi, n.dur])).toEqual([
      [0, 62, 1.4],
      [0, 65, 1.4],
      [0, 69, 1.4],
    ])
    expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
    expect(play().classList.contains('is-on')).toBe(true)
  })

  it('stops the sound before it, and lets the page go once it ends', async () => {
    // Arrange
    let stopped = 0
    NowPlaying.claim(() => {
      stopped += 1
    })

    // Act
    play().click()
    runs[0].end(true)
    await settle()
    NowPlaying.claim(() => undefined)

    // Assert: the sound before it stopped once; the ended chord is not stopped again
    expect(stopped).toBe(1)
    expect(runs[0].stopped).toBe(false)
    expect(play().classList.contains('is-on')).toBe(false)
  })

  it('stops where it stands when another sound claims the page', async () => {
    // Arrange
    play().click()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(play().classList.contains('is-on')).toBe(false)
  })

  it('plays afresh on a second press, the first one stopped', () => {
    // Act
    play().click()
    play().click()

    // Assert
    expect(runs.map((r) => r.stopped)).toEqual([true, false])
    expect(live()).toHaveLength(1)
  })

  it('plays silently with sound off', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)

    // Act
    play().click()

    // Assert
    expect(runs[0].o.audible).toBe(false)
  })

  it("plays from any quiz's host it is bound to, as Lesson 12's recall will bind it", () => {
    // Arrange: another quiz's host, holding question 2's slot
    const host = document.createElement('div')
    host.id = 'laterRecall'
    host.innerHTML = QUIZ_QUESTIONS[1].slot ?? ''
    document.body.appendChild(host)
    bindQuizPlays(host)

    // Act
    el<HTMLButtonElement>('#laterRecall [data-quiz-play="chord"]').click()

    // Assert
    expect(runs.map((r) => r.notes)).toEqual([QUIZ_CHORD])
  })
})
