// ============================================================
// Lesson 16 recall and quick check tests — Lessons 9 and 15's, then four
// ============================================================
//
// The questions, pure: the recall is Lesson 9's question 2 and Lesson 15's
// question 1, the very objects, in that order (FACTS 7), neither naming the
// cold open's answer; the quick check is LESSON.md's four, three answers
// each, one right, no line opening as the kit's verdict does, the wrong
// ones that hold a misconception linking back to Steps 2, 1, 4 and 3. Then
// on the page's own markup, carrying Season 2 as main.ts does, with the
// kit's runs a recorder: a wrong recall answer goes to that lesson's step
// in a new tab, or keeps its words with no link where the lesson is not
// live, and the recall marks no lesson done; the quick check marks Lesson
// 16 done once each of its four has an answer; and its question 4 plays
// do, a second of quiet, then re, in the learner's octave, its button lit
// while it sounds, the page's one sound (WEB-SPEC, Toys 5; FACTS 69).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { QUIZ_QUESTIONS as LESSON_9 } from '@/features/lessons/lesson-09/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_15 } from '@/features/lessons/lesson-15/quiz-questions'
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

const play = () => el<HTMLButtonElement>('#qs [data-quiz-play="do-re"]')
const lit = (b: HTMLButtonElement) => b.classList.contains('is-on')
/** A recorded run's notes as [onset, MIDI note, length]. */
const heard = (i: number) => runs[i].notes.map((n) => [n.t, n.midi, n.dur])

describe('the questions', () => {
  it("asks Lesson 9's question 2 and Lesson 15's question 1 in the recall, the very objects, in that order (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l09-q2', 'l15-q1'])
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_9.find((q) => q.id === 'l09-q2'))
    expect(RECALL_QUESTIONS[1]).toBe(LESSON_15.find((q) => q.id === 'l15-q1'))
    expect(RECALL_QUESTIONS.map((q) => q.slot)).toEqual([undefined, undefined])
  })

  it("names no part of the cold open's answer in the recall (FACTS 1a)", () => {
    // Act
    const text = RECALL_QUESTIONS.flatMap((q) => [
      q.question,
      ...q.options.flatMap((o) => [o.text, o.feedback]),
    ]).join(' ')

    // Assert
    expect(text).not.toMatch(
      /start from|first note|to start|perfect pitch|absolute pitch|relative pitch/i,
    )
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l16-q1',
      'l16-q2',
      'l16-q3',
      'l16-q4',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.question)).toEqual([
      'What does a singer need to sing a new tune on its written notes?',
      "In G, where does the lower voice's do sit on the bass staff?",
      'On the staff, do, mi and so sit...',
      'Listen. What helps most to sing the note after do?',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.options.length)).toEqual([3, 3, 3, 3])
    expect(
      QUIZ_QUESTIONS.map((q) =>
        q.options.filter((o) => o.correct === true).map((o) => o.text),
      ),
    ).toEqual([
      ['A note to start from, such as do'],
      ['In the top space'],
      ['On three lines in a row, or three spaces in a row'],
      ['Hearing it inside before you sing it'],
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.options[0].correct)).toEqual([
      true,
      true,
      true,
      true,
    ])
    for (const q of QUIZ_QUESTIONS)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct)\b/)
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 2, 1, 4 and 3', () => {
    // Act
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) => {
        const n = /data-goto-step="(\d)"/.exec(o.feedback)?.[1]
        return n === undefined ? [] : [n]
      }),
    )

    // Assert
    expect(steps).toEqual([['2'], ['1'], ['4'], ['3']])
  })

  it("holds question 4's play, Play do, then re, in question 4 alone", () => {
    // Assert: WEB-SPEC, Toys 5
    expect(QUIZ_QUESTIONS.map((q) => q.slot !== undefined)).toEqual([
      false,
      false,
      false,
      true,
    ])
    expect(QUIZ_QUESTIONS[3].slot).toContain('data-quiz-play="do-re"')
    expect(QUIZ_QUESTIONS[3].slot).toMatch(/>Play do, then re<\/button>$/)
  })
})

describe('the recall', () => {
  it("sends a wrong answer to that lesson's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where every draft is live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, 'Two major thirds: 4 and 4').click()
    option('recall-', 1, 'The bottom line: E').click()

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
      ['/learn/09#step-3', '_blank', 'Try Lesson 9, Step 3 again'],
      ['/learn/15#step-1', '_blank', 'Try Lesson 15, Step 1 again'],
    ])
    expect([Done.has(9), Done.has(15), Done.has(16)]).toEqual([
      false,
      false,
      false,
    ])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it('keeps the words with no link where the lesson is not live', () => {
    // Arrange: a page served with no draft shown
    serve(false)
    mountQuizzes()

    // Act
    option('recall-', 1, 'The bottom line: E').click()

    // Assert
    const fb = el('#recall-fb1')
    expect(fb.querySelector('a')).toBeNull()
    expect(words(fb)).toContain('Try Lesson 15, Step 1 again')
  })

  it('plays nothing', () => {
    // Arrange
    mountQuizzes()

    // Assert
    expect(document.querySelector('#recall-qs [data-quiz-play]')).toBeNull()
  })
})

describe('the quick check', () => {
  it('asks its four questions and marks Lesson 16 done once each has an answer', () => {
    // Arrange
    mountQuizzes()
    const asked = [document.querySelectorAll('#qs .q').length, words(el('#q0'))]

    // Act
    for (const i of [1, 2, 3]) el(`#qs .q:nth-child(${i}) .opt`).click()
    const three = Done.has(16)
    el('#qs .q:nth-child(4) .opt').click()

    // Assert
    expect(asked).toEqual([4, QUIZ_QUESTIONS[0].question])
    expect(three).toBe(false)
    expect(Done.has(16)).toBe(true)
  })

  it("plays question 4's do, a second of quiet, then re, 2.6 s, in the soft tone and the lower voice's octave before a choice, its button lit while it sounds", async () => {
    // Arrange
    mountQuizzes()

    // Act
    play().click()
    const during = lit(play())
    runs[0].end(true)
    await settle()

    // Assert: FACTS 69, G3 and A3
    expect(heard(0)).toEqual([
      [0, 55, 0.8],
      [1.8, 57, 0.8],
    ])
    expect([runs[0].o.audible, runs[0].o.kind]).toEqual([true, 'soft'])
    expect([during, lit(play())]).toEqual([true, false])
  })

  it('plays in the higher voice once it is chosen, G4 and A4, read at each tap', () => {
    // Arrange
    mountQuizzes()
    play().click()
    VoiceChoice.set('higher')

    // Act
    play().click()

    // Assert
    expect(heard(0)).toEqual([
      [0, 55, 0.8],
      [1.8, 57, 0.8],
    ])
    expect(heard(1)).toEqual([
      [0, 67, 0.8],
      [1.8, 69, 0.8],
    ])
    expect(runs[0].stopped).toBe(true)
  })

  it('keeps a second tap playing when the first run it stopped ends late', async () => {
    // Arrange
    mountQuizzes()
    play().click()
    play().click()

    // Act
    runs[0].end(false)
    await settle()

    // Assert
    expect([runs[0].stopped, runs[1].stopped]).toEqual([true, false])
    expect(lit(play())).toBe(true)
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
