// ============================================================
// Lesson 27 recall and quick check tests — on the page's markup and the kit's quiz
// ============================================================
//
// The recall asks Lesson 12's question 3 and Lesson 23's question 1, the
// very objects those pages ask, and sends a wrong answer to that lesson's
// own step in a new tab, or keeps the words where the lesson is not live;
// it marks no lesson done, and neither question says which note makes V
// pull harder, nor anything of a chord turned over (WEB-SPEC, Toys 7;
// FACTS 1a, 1b, 7). The quick check asks LESSON.md's four, three answers
// each and one right, sends each wrong answer that holds a misconception
// to the step that answers it, plays G3, B3, D4 and F4 together for
// question 4, for everyone, and marks Lesson 27 done once each has an
// answer (FACTS 75 to 78).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { signName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { CHORD4_GAIN } from '@/features/lessons/kit/sound'
import { writtenOf } from '@/features/lessons/kit/staff-places'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { QUIZ_QUESTIONS as LESSON_12 } from '@/features/lessons/lesson-12/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_23 } from '@/features/lessons/lesson-23/quiz-questions'
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
  it("asks Lesson 12's question 3, then Lesson 23's question 1, in the recall, the very objects (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS).toEqual([
      LESSON_12.find((q) => q.id === 'l12-q3'),
      LESSON_23.find((q) => q.id === 'l23-q1'),
    ])
    // neither has a play
    expect(RECALL_QUESTIONS.map((q) => q.slot)).toEqual([undefined, undefined])
  })

  it('asks no recall question that answers the predicts: no F, no seventh, no chord turned over (FACTS 1a, 1b)', () => {
    // Act
    const text = RECALL_QUESTIONS.map(
      (q) => `${q.question} ${q.options.map((o) => o.text).join(' ')}`,
    ).join(' ')

    // Assert
    expect(text).not.toMatch(/F♯|seventh|inversion|in the bass|pull/i)
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l27-q1',
      'l27-q2',
      'l27-q3',
      'l27-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      expect(q.options[0].correct).toBe(true)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct|Not quite)\b/)
    }
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 1, 3, 4 and 1', () => {
    // Assert
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) =>
          Number(m[1]),
        ),
      ),
    )
    expect(steps).toEqual([[1], [3], [4], [1]])
  })
})

describe('the recall', () => {
  it("sends a wrong answer to Lesson 12's or Lesson 23's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where both lessons' drafts are live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, 'C, D, E and F').click()
    option('recall-', 1, '7').click()

    // Assert (WEB-SPEC, Toys 7)
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#recall-qs .fb a'),
      (a) => [a.getAttribute('href'), a.getAttribute('target'), words(a)],
    )
    expect(links).toEqual([
      ['/learn/12#step-4', '_blank', 'Try Lesson 12, Step 4 again'],
      ['/learn/23#step-2', '_blank', 'Try Lesson 23, Step 2 again'],
    ])
    expect([Done.has(12), Done.has(23), Done.has(27)]).toEqual([
      false,
      false,
      false,
    ])
  })

  it('keeps the words with no link where Lessons 12 and 23 are not live', () => {
    // Arrange: a page served with no draft shown
    serve(false)
    mountQuizzes()

    // Act
    option('recall-', 0, 'C, D, E and F').click()
    option('recall-', 1, '7').click()

    // Assert
    expect(document.querySelector('#recall-qs .fb a')).toBeNull()
    expect(words(el('#recall-fb0'))).toContain('Try Lesson 12, Step 4 again')
    expect(words(el('#recall-fb1'))).toContain('Try Lesson 23, Step 2 again')
  })
})

describe('the quick check', () => {
  it('plays G3, B3, D4 and F4 together for question 4, 1.5 s at 0.056 a voice, for everyone, lit while it sounds (FACTS 72, 73, 78)', async () => {
    // Arrange
    mountQuizzes()
    const play = el<HTMLButtonElement>('#qs [data-quiz-play="chord"]')

    // Act: no voice stored, then the higher voice
    play.click()
    await settle()
    const first = runs[runs.length - 1]
    const lit = play.classList.contains('is-on')
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')
    play.click()
    await settle()
    const again = runs[runs.length - 1]

    // Assert
    const heard = (r: typeof first): string[] =>
      r.notes.map((n) => `${n.t} ${signName(writtenOf(n.midi))} ${n.dur}`)
    expect(heard(first)).toEqual([
      '0 G3 1.5',
      '0 B3 1.5',
      '0 D4 1.5',
      '0 F4 1.5',
    ])
    expect(heard(again)).toEqual(heard(first))
    expect(first.notes.every((n) => n.gain === CHORD4_GAIN)).toBe(true)
    expect(first.o.kind).toBe('soft')
    expect(first.stopped).toBe(true)
    expect(lit).toBe(true)
    expect(play.getAttribute('aria-label')).toBe("Play the question's chord")
  })

  it('stops its chord for another sound on the page, and puts its light out', async () => {
    // Arrange
    mountQuizzes()
    const play = el<HTMLButtonElement>('#qs [data-quiz-play="chord"]')
    play.click()
    await settle()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert: WEB-SPEC, Audio
    expect(runs[runs.length - 1].stopped).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('marks Lesson 27 done once all four have an answer', () => {
    // Arrange
    mountQuizzes()

    // Act
    option('', 0, 'A').click()
    option('', 1, 'Down to G').click()
    option('', 2, 'E minor').click()
    option('', 3, 'A dominant seventh chord').click()

    // Assert
    expect(Done.has(27)).toBe(true)
  })
})
