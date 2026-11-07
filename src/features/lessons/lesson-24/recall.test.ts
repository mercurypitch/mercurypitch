// ============================================================
// Lesson 24 recall and quick check tests — Lessons 10 and 23's questions, then four
// ============================================================
//
// The questions, pure: the recall is Lesson 10's question 1 and Lesson
// 23's question 3, the very objects, in that order (FACTS 7), neither
// naming a beat, a tuning or a drone (FACTS 1a); the quick check is
// LESSON.md's four, three answers each, one right, no line opening as the
// kit's verdict does, the wrong ones that hold a misconception linking
// back to Steps 1, 2, 4 and 2, question 1 word for word as Lesson 26's
// recall asks it (FACTS 74), and question 4 alone carrying a play, held
// under the Pure word's line. Then on the page's own markup, carrying
// Season 2 as main.ts does, with the kit's runs a recorder: a wrong recall
// answer goes to Lesson 10's or Lesson 23's step in a new tab, or keeps its
// words with no link where that lesson is not live, and the recall marks
// no lesson done; the quick check marks Lesson 24 done once each of its
// four has an answer; its question 4's play waits for the cold open's
// choice, its answers open, then plays A3 with E4 at exactly 330 Hz for
// 4.0 s, its button lit while it sounds, the page's one sound (WEB-SPEC,
// Toys 5; FACTS 46, 70, 77).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { Sound } from '@/features/lessons/kit/sound'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_QUESTIONS as LESSON_10 } from '@/features/lessons/lesson-10/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_23 } from '@/features/lessons/lesson-23/quiz-questions'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { PURE_HELD, QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'
import type { Quizzes } from './recall'
import { initQuizzes } from './recall'
import { DRONE_HZ, PURE } from './sounds'

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

const play = () => el<HTMLButtonElement>('#qs [data-quiz-play="pure"]')
const held = () => el('#qs [data-quiz-held]')
const lit = (b: HTMLButtonElement) => b.classList.contains('is-on')

describe('the questions', () => {
  it("asks Lesson 10's question 1, then Lesson 23's question 3, in the recall, the very objects (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l10-q1', 'l23-q3'])
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_10[0])
    expect(RECALL_QUESTIONS[1]).toBe(LESSON_23[2])
  })

  it('names no beat, tuning or drone in the recall (FACTS 1a)', () => {
    // Act
    const text = RECALL_QUESTIONS.flatMap((q) => [
      q.question,
      ...q.options.flatMap((o) => [o.text, o.feedback]),
    ]).join(' ')

    // Assert
    expect(text).not.toMatch(/beat|\btun(e|ed|ing)\b|drone|\bpure\b|still/i)
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l24-q1',
      'l24-q2',
      'l24-q3',
      'l24-q4',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.question)).toEqual([
      'Two notes, 220 Hz and 223 Hz, sound together. How many times a second do they beat?',
      'Above a drone, the piano plays a fifth, then a major third. What do you hear?',
      'You hold a harmony note while another singer sings a different part. What helps keep the harmony together?',
      'Listen. Is this pair beating or still?',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.options.length)).toEqual([3, 3, 3, 3])
    expect(
      QUIZ_QUESTIONS.map((q) =>
        q.options.filter((o) => o.correct === true).map((o) => o.text),
      ),
    ).toEqual([
      ['3'],
      ['Both beat, the third much faster'],
      ['Listening to the other part'],
      ['Still'],
    ])
    for (const q of QUIZ_QUESTIONS)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct)\b/)
  })

  it("keeps question 1's answers as Lesson 26's recall asks them, its third's feedback without the plan's \"most clearly\" (FACTS 74)", () => {
    // Assert
    expect(QUIZ_QUESTIONS[0].options.map((o) => o.text)).toEqual([
      '3',
      '443',
      "None: they're too close to hear",
    ])
    expect(QUIZ_QUESTIONS[0].options[2].feedback).toBe(
      'Close notes beat; only the same note is still.',
    )
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 1, 2, 4 and 2', () => {
    // Act
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) => {
        const n = /data-goto-step="(\d)"/.exec(o.feedback)?.[1]
        return n === undefined ? [] : [n]
      }),
    )

    // Assert
    expect(steps).toEqual([['1'], ['2'], ['4'], ['2']])
  })

  it("holds question 4's play alone, disabled under the Pure word's line, named for what it plays", () => {
    // Assert: WEB-SPEC, Toys 5; WCAG 2.5.3, its name holding what it shows
    expect(QUIZ_QUESTIONS.map((q) => q.slot !== undefined)).toEqual([
      false,
      false,
      false,
      true,
    ])
    const slot = QUIZ_QUESTIONS[3].slot ?? ''
    expect(slot).toContain('aria-label="Play the question\'s pair"')
    expect(slot).toMatch(/ disabled>.*>Play<\/button>/)
    expect(slot).toContain(PURE_HELD)
    expect(PURE_HELD).toBe('Choose an answer at the top to hear this.')
  })
})

describe('the recall', () => {
  it("sends a wrong answer to Lesson 10's or Lesson 23's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where both lessons' drafts are live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, '4').click()
    option('recall-', 1, 'A third').click()

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
      ['/learn/10#step-1', '_blank', 'Try Lesson 10, Step 1 again'],
      ['/learn/23#step-1', '_blank', 'Try Lesson 23, Step 1 again'],
    ])
    expect([Done.has(10), Done.has(23), Done.has(24)]).toEqual([
      false,
      false,
      false,
    ])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it('keeps the words with no link where Lessons 10 and 23 are not live', () => {
    // Arrange: a page served with no draft shown
    serve(false)
    mountQuizzes()

    // Act
    option('recall-', 0, '4').click()
    option('recall-', 1, 'A third').click()

    // Assert
    expect(document.querySelector('#recall-qs .fb a')).toBeNull()
    expect(words(el('#recall-fb0'))).toContain('Try Lesson 10, Step 1 again')
    expect(words(el('#recall-fb1'))).toContain('Try Lesson 23, Step 1 again')
  })
})

describe('the quick check', () => {
  it('asks its four questions and marks Lesson 24 done once each has an answer', () => {
    // Arrange
    mountQuizzes()
    const asked = [document.querySelectorAll('#qs .q').length, words(el('#q0'))]

    // Act
    for (const i of [1, 2, 3]) el(`#qs .q:nth-child(${i}) .opt`).click()
    const three = Done.has(24)
    el('#qs .q:nth-child(4) .opt').click()

    // Assert
    expect(asked).toEqual([4, QUIZ_QUESTIONS[0].question])
    expect(three).toBe(false)
    expect(Done.has(24)).toBe(true)
  })

  it("holds question 4's play until the cold open's choice, under the Pure word's line, its answers open", () => {
    // Arrange
    mountQuizzes()

    // Act
    play().click()
    option('', 3, 'Still').click()

    // Assert: FACTS 46; nothing plays the still pair before the cold open's choice
    expect(play().disabled).toBe(true)
    expect(runs).toHaveLength(0)
    expect(held().hidden).toBe(false)
    expect(words(held())).toBe(PURE_HELD)
    expect(words(el('#fb3'))).toBe(
      'Right. A pure fifth: its harmonics meet exactly.',
    )
  })

  it("plays A3 with E4 at exactly 330 Hz for 4.0 s once the cold open's choice is in, lit while it sounds", async () => {
    // Arrange
    const quizzes = mountQuizzes()

    // Act
    quizzes.unlockPure()
    play().click()
    const during = lit(play())
    runs[0].end(true)
    await settle()

    // Assert: FACTS 70, 77
    expect(held().hidden).toBe(true)
    expect(runs[0].kind).toBe('lines')
    expect(
      runs[0].lines.map((l) => [
        l.t,
        l.points.map((p) => [p.t, p.hz]),
        l.vibrato,
      ]),
    ).toEqual([
      [
        0,
        [
          [0, DRONE_HZ],
          [4, DRONE_HZ],
        ],
        null,
      ],
      [
        0,
        [
          [0, PURE.so],
          [4, PURE.so],
        ],
        null,
      ],
    ])
    expect(PURE.so).toBe(330)
    expect(runs[0].o.audible).toBe(true)
    expect([during, lit(play())]).toEqual([true, false])
  })

  it('runs silent with sound off', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    mountQuizzes().unlockPure()

    // Act
    play().click()

    // Assert
    expect(runs[0].o.audible).toBe(false)
  })

  it('plays from the start when pressed again, and stops at once when another sound starts, its button put out', () => {
    // Arrange
    mountQuizzes().unlockPure()
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
