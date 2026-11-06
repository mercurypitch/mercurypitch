// ============================================================
// Lesson 23 recall and quick check tests — Lesson 6's two, then four
// ============================================================
//
// The questions, pure: the recall is Lesson 6's questions 3 and 4, the
// very objects, in that order (FACTS 7), neither naming the cold open's
// answer; the quick check is LESSON.md's four, three answers each, one
// right, no line opening as the kit's verdict does, the wrong ones that
// hold a misconception linking back to Steps 2, 3, 1 and 4. Then on the
// page's own markup, carrying Season 2 as main.ts does, with the kit's
// runs a recorder: a wrong recall answer goes to Lesson 6's step in a new
// tab, or keeps its words with no link where Lesson 6 is not live, and the
// recall marks no lesson done; its first question plays Lesson 6's pair;
// the quick check marks Lesson 23 done once each of its four has an
// answer; and its question 4 plays B3 and F4 together for 1.5 s, its
// button lit while it sounds, the page's one sound (WEB-SPEC, Toys 7;
// FACTS 68, 73, 78).

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
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_FOURTH } from '@/features/lessons/lesson-06/examples'
import { QUIZ_QUESTIONS as LESSON_6 } from '@/features/lessons/lesson-06/quiz-questions'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'
import { initQuizzes } from './recall'

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
  vi.useRealTimers()
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
function mountQuizzes(): StepDeck {
  carrySeason(SEASON_2)
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  initQuizzes(deck)
  return deck
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

const play = () => el<HTMLButtonElement>('#qs [data-quiz-play="tritone"]')
const lit = (b: HTMLButtonElement) => b.classList.contains('is-on')

describe('the questions', () => {
  it("asks Lesson 6's questions 3 and 4 in the recall, the very objects, in that order (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS).toEqual([
      LESSON_6.find((q) => q.id === 'l06-q3'),
      LESSON_6.find((q) => q.id === 'l06-q4'),
    ])
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_6[2])
    expect(RECALL_QUESTIONS[1]).toBe(LESSON_6[3])
  })

  it("names no part of the cold open's answer in the recall (FACTS 1a)", () => {
    // Act
    const text = RECALL_QUESTIONS.flatMap((q) => [
      q.question,
      ...q.options.flatMap((o) => [o.text, o.feedback]),
    ]).join(' ')

    // Assert
    expect(text).not.toMatch(
      /F♯|F sharp|\bsix\b|\b6 semitones|tritone|middle of the octave/i,
    )
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l23-q1',
      'l23-q2',
      'l23-q3',
      'l23-q4',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.question)).toEqual([
      'How many semitones does the interval that splits the octave in half span?',
      'C up to G is a perfect fifth. Turn it upside down: G up to C. What is it?',
      'Which of these is never called major or minor?',
      'Listen. Which interval is this?',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.options.length)).toEqual([3, 3, 3, 3])
    expect(
      QUIZ_QUESTIONS.map((q) =>
        q.options.filter((o) => o.correct === true).map((o) => o.text),
      ),
    ).toEqual([['6'], ['A perfect fourth'], ['A fifth'], ['A tritone']])
    for (const q of QUIZ_QUESTIONS)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct)\b/)
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 2, 3, 1 and 4', () => {
    // Act
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) => {
        const n = /data-goto-step="(\d)"/.exec(o.feedback)?.[1]
        return n === undefined ? [] : [n]
      }),
    )

    // Assert
    expect(steps).toEqual([['2'], ['3'], ['1'], ['4']])
  })

  it("names question 4's play so it never matches Step 4's, and holds it in question 4 alone", () => {
    // Assert: WEB-SPEC, Toys 7; WCAG 2.5.3, its name holding what it shows
    expect(QUIZ_QUESTIONS.map((q) => q.slot !== undefined)).toEqual([
      false,
      false,
      false,
      true,
    ])
    expect(QUIZ_QUESTIONS[3].slot).toContain(
      'aria-label="Play the question\'s interval"',
    )
    expect(QUIZ_QUESTIONS[3].slot).toMatch(/>Play<\/button>$/)
  })
})

describe('the recall', () => {
  it("sends a wrong answer to Lesson 6's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where Lesson 6's draft is live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, 'A step').click()
    el('#recall-qs .q:nth-child(2) .opt').click()

    // Assert (WEB-SPEC, Toys 7)
    expect(
      Array.from(document.querySelectorAll('#recall-qs .q h3'), (h) =>
        words(h),
      ),
    ).toEqual([RECALL_QUESTIONS[0].question, RECALL_QUESTIONS[1].question])
    const link = el('#recall-qs').querySelector<HTMLAnchorElement>('.fb a')
    expect(link?.getAttribute('href')).toBe('/learn/06#step-2')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(words(link)).toBe('Try Lesson 6, Step 2 again')
    expect(document.querySelectorAll('#recall-qs .fb')).toHaveLength(2)
    expect([Done.has(6), Done.has(23)]).toEqual([false, false])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it('keeps the words with no link where Lesson 6 is not live', () => {
    // Arrange: a page served with no draft shown
    serve(false)
    mountQuizzes()

    // Act
    option('recall-', 0, 'A step').click()

    // Assert
    const fb = el('#recall-fb0')
    expect(fb.querySelector('a')).toBeNull()
    expect(words(fb)).toContain('Try Lesson 6, Step 2 again')
  })

  it("plays its first question's pair as Lesson 6 plays it, C4 then F4, and stops it for any other sound", async () => {
    // Arrange
    mountQuizzes()
    vi.useFakeTimers()
    const voice = vi.spyOn(Sound, 'voice').mockReturnValue(null)
    const play = el('#recall-qs [data-quiz-play="fourth"]')

    // Act
    play.click()
    vi.advanceTimersByTime(Math.max(...QUIZ_FOURTH.map((e) => e.at)) * 1000)
    const playing = play.classList.contains('is-on')
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert: FACTS 68, Lesson 6's own pair on Lesson 6's own plays
    expect(voice.mock.calls.map(([f]) => f)).toEqual(
      QUIZ_FOURTH.map((e) => hz(e.midi)),
    )
    expect(playing).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })
})

describe('the quick check', () => {
  it('asks its four questions and marks Lesson 23 done once each has an answer', () => {
    // Arrange
    mountQuizzes()
    const asked = [document.querySelectorAll('#qs .q').length, words(el('#q0'))]

    // Act
    for (const i of [1, 2, 3]) el(`#qs .q:nth-child(${i}) .opt`).click()
    const three = Done.has(23)
    el('#qs .q:nth-child(4) .opt').click()

    // Assert
    expect(asked).toEqual([4, QUIZ_QUESTIONS[0].question])
    expect(three).toBe(false)
    expect(Done.has(23)).toBe(true)
  })

  it("plays question 4's B3 and F4 together for 1.5 s, its button lit while it sounds", async () => {
    // Arrange
    mountQuizzes()

    // Act
    play().click()
    const during = lit(play())
    runs[0].end(true)
    await settle()

    // Assert: FACTS 73, 78
    expect(runs[0].notes.map((n) => [n.t, n.midi, n.dur])).toEqual([
      [0, 59, 1.5],
      [0, 65, 1.5],
    ])
    expect(runs[0].o.audible).toBe(true)
    expect([during, lit(play())]).toEqual([true, false])
  })

  it('runs silent with sound off', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    mountQuizzes()

    // Act
    play().click()

    // Assert
    expect(runs[0].o.audible).toBe(false)
  })

  it('stops at once when another sound starts, its button put out', () => {
    // Arrange
    mountQuizzes()
    play().click()

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(lit(play())).toBe(false)
  })
})
