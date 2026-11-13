// ============================================================
// Lesson 25 recall and quick check tests — on the page's markup and the kit's quiz
// ============================================================
//
// The recall asks Lesson 10's question 4 and Lesson 21's question 2, the
// very objects those pages ask, and sends a wrong answer to that lesson's
// own step in a new tab, or keeps the words where the lesson is not live;
// it marks no lesson done, and neither question says what a raised note
// does to a chord (WEB-SPEC, Toys 7; FACTS 1a, 7). The quick check asks
// LESSON.md's four, three answers each and one right, sends each wrong
// answer that holds a misconception to the step that answers it, plays A
// melodic minor going up in the learner's octave for question 4, and marks
// Lesson 25 done once each has an answer (FACTS 65 to 69).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { QUIZ_QUESTIONS as LESSON_10 } from '@/features/lessons/lesson-10/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_21 } from '@/features/lessons/lesson-21/quiz-questions'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'
import { initQuizzes, quizScale } from './recall'

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

/** The option of question `q` whose words are `text`, in quiz `prefix`'s list. */
function option(prefix: string, q: number, text: string): HTMLButtonElement {
  const box = el(`#${prefix}q${q}`).closest('.q')
  const found = Array.from(
    box?.querySelectorAll<HTMLButtonElement>('button.opt') ?? [],
  ).find((b) => words(b.querySelector('.opt-t')) === text)
  if (found === undefined) throw new Error(`no "${text}" in ${prefix}q${q}`)
  return found
}

describe('the questions', () => {
  it("asks Lesson 10's question 4, then Lesson 21's question 2, in the recall, the very objects (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS).toEqual([
      LESSON_10.find((q) => q.id === 'l10-q4'),
      LESSON_21.find((q) => q.id === 'l21-q2'),
    ])
    // neither has a play
    expect(RECALL_QUESTIONS.map((q) => q.slot)).toEqual([undefined, undefined])
  })

  it('asks no recall question that says what a raised note does to a chord on so (FACTS 1a)', () => {
    // Act
    const text = RECALL_QUESTIONS.map(
      (q) => `${q.question} ${q.options.map((o) => o.text).join(' ')}`,
    ).join(' ')

    // Assert
    expect(text).not.toMatch(/chord on so|chord before home|E major|E minor/)
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l25-q1',
      'l25-q2',
      'l25-q3',
      'l25-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      expect(q.options[0].correct).toBe(true)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct|Not quite)\b/)
    }
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 3, 1, 4 and 3', () => {
    // Assert
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) =>
          Number(m[1]),
        ),
      ),
    )
    expect(steps).toEqual([[3], [1], [4], [3]])
  })
})

describe('the recall', () => {
  it("sends a wrong answer to Lesson 10's or Lesson 21's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where both lessons' drafts are live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, 'Only E: mi becomes me').click()
    option('recall-', 1, 'On G♯ sharp').click()

    // Assert (WEB-SPEC, Toys 7)
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#recall-qs .fb a'),
      (a) => [a.getAttribute('href'), a.getAttribute('target'), words(a)],
    )
    expect(links).toEqual([
      ['/learn/10#step-5', '_blank', 'Try Lesson 10, Step 5 again'],
      ['/learn/21#step-4', '_blank', 'Try Lesson 21, Step 4 again'],
    ])
    expect([Done.has(10), Done.has(21), Done.has(25)]).toEqual([
      false,
      false,
      false,
    ])
  })

  it('keeps the words with no link where Lessons 10 and 21 are not live', () => {
    // Arrange: a page served with no draft shown
    serve(false)
    mountQuizzes()

    // Act
    option('recall-', 0, 'Only E: mi becomes me').click()
    option('recall-', 1, 'On G♯ sharp').click()

    // Assert
    expect(document.querySelector('#recall-qs .fb a')).toBeNull()
    expect(words(el('#recall-fb0'))).toContain('Try Lesson 10, Step 5 again')
    expect(words(el('#recall-fb1'))).toContain('Try Lesson 21, Step 4 again')
  })
})

describe('the quick check', () => {
  it('plays A melodic minor going up in the learner’s octave for question 4, 3.15 s, lit while it sounds (FACTS 65, 69)', async () => {
    // Arrange
    mountQuizzes()
    const play = el<HTMLButtonElement>('#qs [data-quiz-play="scale"]')

    // Act: no voice stored, then the higher voice
    play.click()
    await settle()
    const lower = runs[runs.length - 1]
    const lit = play.classList.contains('is-on')
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')
    play.click()
    await settle()
    const higher = runs[runs.length - 1]

    // Assert
    expect(lower.notes.map((n) => n.midi)).toEqual([
      45, 47, 48, 50, 52, 54, 56, 57,
    ])
    expect(higher.notes.map((n) => n.midi)).toEqual([
      57, 59, 60, 62, 64, 66, 68, 69,
    ])
    expect(lower.o.kind).toBe('soft')
    expect(lower.stopped).toBe(true)
    expect(lit).toBe(true)
    const last = quizScale('bass')[7]
    expect(last.t + last.dur).toBeCloseTo(3.15, 9)
    expect(el('#qs [data-quiz-play="scale"]').getAttribute('aria-label')).toBe(
      "Play the question's scale",
    )
  })

  it('stops its scale for another sound on the page, and puts its light out', async () => {
    // Arrange
    mountQuizzes()
    const play = el<HTMLButtonElement>('#qs [data-quiz-play="scale"]')
    play.click()
    await settle()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert: WEB-SPEC, Audio
    expect(runs[runs.length - 1].stopped).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('marks Lesson 25 done once all four have an answer', () => {
    // Arrange
    mountQuizzes()

    // Act
    option('', 0, 'G to G♯ sharp: te becomes ti').click()
    option('', 1, 'To turn the key into a major key').click()
    option('', 2, 'A minor').click()
    option('', 3, 'Major').click()

    // Assert
    expect(Done.has(25)).toBe(true)
  })
})
