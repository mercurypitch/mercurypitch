// ============================================================
// Lesson 22 recall and quick check tests — Lessons 5 and 14's questions, then four
// ============================================================
//
// The questions, pure: the recall is Lesson 5's question 3 and Lesson 14's
// question 3, the very objects, in that order (FACTS 7), neither naming a
// vibrato or where a wave's note is heard (FACTS 1a); the quick check is
// LESSON.md's four, three answers each, one right, no line opening as the
// kit's verdict does, the wrong ones that hold a misconception linking
// back to Steps 2, 3, 3 and 4, and question 3 alone carrying a play, held
// under its lock line. Then on the page's own markup, carrying Season 2 as
// main.ts does, with the kit's runs a recorder: a wrong recall answer goes
// to Lesson 5's or Lesson 14's step in a new tab, or keeps its words with
// no link where that lesson is not live, and the recall marks no lesson
// done; the quick check marks Lesson 22 done once each of its four has an
// answer; its question 3's play waits for Step 3's choice, its answers
// open, then plays Step 3's slow wave, ±50 cents at two swings a second on
// A3 for 3.0 s, its button lit while it sounds, the page's one sound
// (WEB-SPEC, Toys 5; FACTS 71).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { Sound } from '@/features/lessons/kit/sound'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_QUESTIONS as LESSON_5 } from '@/features/lessons/lesson-05/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_14 } from '@/features/lessons/lesson-14/quiz-questions'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS, SLOW_HELD } from './quiz-questions'
import type { Quizzes } from './recall'
import { initQuizzes } from './recall'
import { A3 } from './sounds'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
  document.getElementById('lesson-state')?.remove()
})

/** The page as the site worker serves it: its state, every draft shown (the dev site) or none (production). */
function serve(drafts: boolean): void {
  const tag = document.createElement('script')
  tag.type = 'application/json'
  tag.id = 'lesson-state'
  tag.textContent = JSON.stringify({
    version: 1,
    updatedAt: null,
    lessons: {},
    drafts,
  })
  document.head.append(tag)
}

/** The page's markup and deck, with the quizzes mounted as main.ts mounts them, Season 2 carried first. */
function mountQuizzes(): Quizzes {
  carrySeason(SEASON_2)
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  const quizzes = initQuizzes(deck)
  deck.start()
  return quizzes
}

/** The option of question `q` whose words are `text`, in quiz `prefix`'s list. */
function option(prefix: string, q: number, text: string): HTMLButtonElement {
  const box = el(`#${prefix}q${q}`).closest('.q')
  const found = Array.from(
    box?.querySelectorAll<HTMLButtonElement>('button.opt') ?? [],
  ).find((b) => words(b.querySelector('.opt-t')) === text)
  if (found === undefined) throw new Error(`no "${text}" in ${prefix}q${q}`)
  return found
}

const play = () => el<HTMLButtonElement>('#qs [data-quiz-play="slow"]')
const held = () => el('#qs [data-quiz-held]')
const lit = (b: HTMLButtonElement) => b.classList.contains('is-on')

describe('the questions', () => {
  it("asks Lesson 5's question 3, then Lesson 14's, in the recall, the very objects (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l05-q3', 'l14-q3'])
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_5[2])
    expect(RECALL_QUESTIONS[1]).toBe(LESSON_14[2])
  })

  it("names no vibrato in the recall, nor where a wave's note is heard (FACTS 1a)", () => {
    // Act
    const text = RECALL_QUESTIONS.flatMap((q) => [
      q.question,
      ...q.options.flatMap((o) => [o.text, o.feedback]),
    ]).join(' ')

    // Assert
    expect(text).not.toMatch(/vibrato|\bwaves?\b|\bswings?\b|middle|centre/i)
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l22-q1',
      'l22-q2',
      'l22-q3',
      'l22-q4',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.question)).toEqual([
      "A singer's held note swings up and down six times a second. What does “six times a second” measure?",
      'A held note waves evenly, 50 cents up and 50 cents down. Which straight note sounds the same?',
      'Listen. Is this one note with a vibrato, or a note moving up and down?',
      "A friend says: “A held note without a vibrato isn't finished.” What does this lesson say?",
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.options.length)).toEqual([3, 3, 3, 3])
    expect(
      QUIZ_QUESTIONS.map((q) =>
        q.options.filter((o) => o.correct === true).map((o) => o.text),
      ),
    ).toEqual([
      ['Its rate'],
      ['The middle of the swing'],
      ['A note moving up and down'],
      ['Both are used in singing, and a straight note is finished'],
    ])
    for (const q of QUIZ_QUESTIONS)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct)\b/)
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 2, 3, 3 and 4', () => {
    // Act
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) => {
        const n = /data-goto-step="(\d)"/.exec(o.feedback)?.[1]
        return n === undefined ? [] : [n]
      }),
    )

    // Assert
    expect(steps).toEqual([['2'], ['3'], ['3'], ['4']])
  })

  it("holds question 3's play alone, disabled under its lock line, named so it never matches Step 3's plays", () => {
    // Assert: WEB-SPEC, Toys 5; WCAG 2.5.3, its name holding what it shows
    expect(QUIZ_QUESTIONS.map((q) => q.slot !== undefined)).toEqual([
      false,
      false,
      true,
      false,
    ])
    const slot = QUIZ_QUESTIONS[2].slot ?? ''
    expect(slot).toContain('aria-label="Play the question\'s wave"')
    expect(slot).toMatch(/ disabled>.*>Play<\/button>/)
    expect(slot).toContain(SLOW_HELD)
    expect(SLOW_HELD).toBe("Answer Step 3's question first to hear this.")
  })
})

describe('the recall', () => {
  it("sends a wrong answer to Lesson 5's or Lesson 14's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where both lessons' drafts are live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, 'A puff of air first, like “h”').click()
    option('recall-', 1, 'Rise as it grows, then fall').click()

    // Assert (WEB-SPEC, Toys 5)
    expect(
      Array.from(document.querySelectorAll('#recall-qs .q h3'), (h) =>
        words(h),
      ),
    ).toEqual([RECALL_QUESTIONS[0].question, RECALL_QUESTIONS[1].question])
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#recall-qs .fb a'),
      (a) => [a.getAttribute('href'), a.getAttribute('target'), words(a)],
    )
    expect(links).toEqual([
      ['/learn/05#step-4', '_blank', 'Try Lesson 5, Step 4 again'],
      ['/learn/14#step-3', '_blank', 'Try Lesson 14, Step 3 again'],
    ])
    expect([Done.has(5), Done.has(14), Done.has(22)]).toEqual([
      false,
      false,
      false,
    ])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it('keeps the words with no link where Lessons 5 and 14 are not live', () => {
    // Arrange: a page served with no draft shown
    serve(false)
    mountQuizzes()

    // Act
    option('recall-', 0, 'A puff of air first, like “h”').click()
    option('recall-', 1, 'Rise as it grows, then fall').click()

    // Assert
    expect(document.querySelector('#recall-qs .fb a')).toBeNull()
    expect(words(el('#recall-fb0'))).toContain('Try Lesson 5, Step 4 again')
    expect(words(el('#recall-fb1'))).toContain('Try Lesson 14, Step 3 again')
  })
})

describe('the quick check', () => {
  it('asks its four questions and marks Lesson 22 done once each has an answer', () => {
    // Arrange
    mountQuizzes()
    const asked = [document.querySelectorAll('#qs .q').length, words(el('#q0'))]

    // Act
    for (const i of [1, 2, 3]) el(`#qs .q:nth-child(${i}) .opt`).click()
    const three = Done.has(22)
    el('#qs .q:nth-child(4) .opt').click()

    // Assert
    expect(asked).toEqual([4, QUIZ_QUESTIONS[0].question])
    expect(three).toBe(false)
    expect(Done.has(22)).toBe(true)
  })

  it("holds question 3's play until Step 3's choice, under its lock line, its answers open", () => {
    // Arrange
    mountQuizzes()

    // Act
    play().click()
    option('', 2, 'A note moving up and down').click()

    // Assert: FACTS 1a, 24; nothing plays the slow wave before Step 3's choice
    expect(play().disabled).toBe(true)
    expect(runs).toHaveLength(0)
    expect(held().hidden).toBe(false)
    expect(words(held())).toBe(SLOW_HELD)
    expect(words(el('#fb2'))).toBe(
      'Right. At two swings a second, the ear follows the pitch.',
    )
  })

  it("plays Step 3's slow wave once Step 3's choice is made: ±50 cents at two swings a second on A3 for 3.0 s, lit while it sounds", async () => {
    // Arrange
    const quizzes = mountQuizzes()

    // Act
    quizzes.unlockSlow()
    play().click()
    const during = lit(play())
    runs[0].end(true)
    await settle()

    // Assert: FACTS 71
    expect(held().hidden).toBe(true)
    expect(runs[0].kind).toBe('line')
    expect(runs[0].o.vibrato).toEqual({ rate: 2, extent: 50, growIn: 0.3 })
    expect(runs[0].points.map((p) => [p.t, p.hz])).toEqual([
      [0, hz(A3)],
      [3, hz(A3)],
    ])
    expect(runs[0].o.audible).toBe(true)
    expect([during, lit(play())]).toEqual([true, false])
  })

  it('runs silent with sound off', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    mountQuizzes().unlockSlow()

    // Act
    play().click()

    // Assert
    expect(runs[0].o.audible).toBe(false)
  })

  it('plays from the start when pressed again, and stops at once when another sound starts, its button put out', () => {
    // Arrange
    mountQuizzes().unlockSlow()
    play().click()

    // Act
    play().click()
    const again = runs.map((r) => r.stopped)
    NowPlaying.claim(() => undefined)

    // Assert
    expect(again).toEqual([true, false])
    expect(runs[1].stopped).toBe(true)
    expect(lit(play())).toBe(false)
  })
})
