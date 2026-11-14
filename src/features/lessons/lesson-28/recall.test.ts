// ============================================================
// Lesson 28 recall and quick check tests — on the page's markup and the kit's quiz
// ============================================================
//
// The recall asks Lesson 18's question 2 and Lesson 26's, their own
// question objects, Lesson 26's asked afresh for everyone with its hold
// and its held line dropped, and sends a wrong answer to that lesson's own
// step in a new tab; it marks no lesson done (WEB-SPEC, Toys 5; FACTS 7).
// The quick check asks LESSON.md's four, three answers each and one right,
// holds question 4's answers and its Play until the cold open's choice
// under "Choose an answer at the top to try this.", plays bars 5 to 8 of
// the song as it kept going by ear, and marks Lesson 28 done once each has
// an answer (FACTS 46, 77 to 80).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_QUESTIONS as LESSON_18 } from '@/features/lessons/lesson-18/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_26 } from '@/features/lessons/lesson-26/quiz-questions'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS, TRY_HELD } from './quiz-questions'
import { initQuizzes, QUIZ_PHRASE } from './recall'
import { BAR_SEC, barsOf, bothNotes, GOING } from './song'

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
  NowPlaying.claim(() => undefined)
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
  document.getElementById('lesson-state')?.remove()
})

/** The page as the site worker serves it: its state, every draft shown (the dev site). */
function serve(): void {
  const tag = document.createElement('script')
  tag.type = 'application/json'
  tag.id = 'lesson-state'
  tag.textContent = JSON.stringify({
    version: 1,
    updatedAt: null,
    lessons: {},
    drafts: true,
  })
  document.head.append(tag)
}

/** The page's markup and deck, with the quizzes mounted as main.ts mounts them, Season 2 carried first. */
function mountQuizzes() {
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

/** The options of question `q` in quiz `prefix`'s list. */
const optionsOf = (prefix: string, q: number): HTMLButtonElement[] =>
  Array.from(
    el(`#${prefix}q${q}`)
      .closest('.q')
      ?.querySelectorAll<HTMLButtonElement>('button.opt') ?? [],
  )

/** The option of question `q` whose words are `text`, in quiz `prefix`'s list. */
function option(prefix: string, q: number, text: string): HTMLButtonElement {
  const found = optionsOf(prefix, q).find(
    (b) => words(b.querySelector('.opt-t')) === text,
  )
  if (found === undefined) throw new Error(`no "${text}" in ${prefix}q${q}`)
  return found
}

/** Question `q`'s held line in the quick check. */
const heldLine = (q: number): HTMLElement | null =>
  el(`#q${q}`).closest('.q')?.querySelector<HTMLElement>('[data-quiz-held]') ??
  null

const phrasePlay = (): HTMLButtonElement =>
  el<HTMLButtonElement>('#qs [data-quiz-play="phrase"]')

describe('the questions', () => {
  it("asks Lesson 18's question 2, then Lesson 26's, asked afresh with no hold (FACTS 7)", () => {
    const l26 = LESSON_26.find((q) => q.id === 'l26-q2')
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_18.find((q) => q.id === 'l18-q2'))
    expect(RECALL_QUESTIONS[1]).toEqual({
      ...l26,
      held: undefined,
      slot: undefined,
    })
    expect(RECALL_QUESTIONS.map((q) => [q.held, q.slot])).toEqual([
      [undefined, undefined],
      [undefined, undefined],
    ])
  })

  it('asks no recall question that names a cadence, a bar or the song (FACTS 1a)', () => {
    const text = RECALL_QUESTIONS.map(
      (q) => `${q.question} ${q.options.map((o) => o.text).join(' ')}`,
    ).join(' ')
    expect(text).not.toMatch(/cadence|bar 8|interrupt|perfect|plagal/i)
  })

  it("asks LESSON.md's four, three answers each and one right, holding only question 4", () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l28-q1',
      'l28-q2',
      'l28-q3',
      'l28-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct|Not quite)\b/)
    }
    expect(QUIZ_QUESTIONS.map((q) => q.held === true)).toEqual([
      false,
      false,
      false,
      true,
    ])
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 1, 2, 3 and 2', () => {
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) =>
          Number(m[1]),
        ),
      ),
    )
    expect(steps).toEqual([[1], [2], [3], [2]])
  })
})

describe('the recall', () => {
  it("sends a wrong answer to Lesson 18's or Lesson 26's own step, in a new tab, and marks no lesson done", () => {
    // Arrange: the dev site, where both lessons are live
    serve()
    mountQuizzes()

    // Act
    option('recall-', 0, 'A step to the next place').click()
    option('recall-', 1, 'Every note stays in the key').click()

    // Assert
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#recall-qs .fb a'),
      (a) => [a.getAttribute('target'), words(a)],
    )
    expect(links).toHaveLength(2)
    expect(links.map((l) => l[0])).toEqual(['_blank', '_blank'])
    expect(links[0]?.[1]).toMatch(/^Try Lesson 18, Step \d again$/)
    expect(links[1]?.[1]).toMatch(/^Try Lesson 26, Step \d again$/)
    expect([Done.has(18), Done.has(26), Done.has(28)]).toEqual([
      false,
      false,
      false,
    ])
  })
})

describe('the quick check', () => {
  it("holds question 4's answers and its Play until the cold open's choice, under its line (FACTS 46)", () => {
    // Arrange
    const quizzes = mountQuizzes()
    const before = {
      q4: optionsOf('', 3).map((b) => b.disabled),
      q4Words: optionsOf('', 3).every((b) => words(b) !== ''),
      line: words(heldLine(3)),
      q1: optionsOf('', 0).some((b) => b.disabled),
      play: phrasePlay().disabled,
    }

    // Act
    quizzes.unlock()

    // Assert
    expect(before).toEqual({
      q4: [true, true, true],
      q4Words: true,
      line: TRY_HELD,
      q1: false,
      play: true,
    })
    expect(optionsOf('', 3).some((b) => b.disabled)).toBe(false)
    expect(phrasePlay().disabled).toBe(false)
    expect(heldLine(3)?.hidden).toBe(true)
  })

  it('holds it again on the next visit', () => {
    mountQuizzes().unlock()
    document.body.textContent = ''
    mountQuizzes()
    expect(optionsOf('', 3).every((b) => b.disabled)).toBe(true)
    expect(phrasePlay().disabled).toBe(true)
  })

  it('plays bars 5 to 8 of the song as it kept going, both parts, 13.33 s, stopping on vi, lit while it sounds (FACTS 80)', async () => {
    // Arrange
    mountQuizzes().unlock()

    // Act
    phrasePlay().click()
    await settle()
    const r = runs[runs.length - 1]
    const lit = phrasePlay().classList.contains('is-on')
    r.end(true)
    await settle()

    // Assert
    expect(r.notes).toEqual(QUIZ_PHRASE)
    expect(QUIZ_PHRASE).toEqual(bothNotes(barsOf(GOING, 5, 8)))
    const end = Math.max(...r.notes.map((n) => n.t + n.dur))
    expect(end).toBeCloseTo(4 * BAR_SEC, 6)
    // bar 8: E3 under G4
    expect(
      r.notes
        .filter((n) => Math.abs(n.t - 3 * BAR_SEC) < 1e-6)
        .map((n) => n.midi)
        .sort(),
    ).toEqual([52, 67])
    expect(lit).toBe(true)
    expect(phrasePlay().classList.contains('is-on')).toBe(false)
  })

  it('marks Lesson 28 done once each question has an answer', () => {
    // Arrange
    const quizzes = mountQuizzes()
    quizzes.unlock()

    // Act
    for (const q of [0, 1, 2, 3]) optionsOf('', q)[0]?.click()

    // Assert
    expect(Done.has(28)).toBe(true)
  })
})
