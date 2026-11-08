// ============================================================
// Lesson 21 recall and quick check tests — on the page's markup and the kit's quiz
// ============================================================
//
// The recall asks Lesson 6's question 2 and Lesson 15's question 2, the
// very objects those pages ask, and sends a wrong answer to that lesson's
// own step in a new tab, or keeps the words where the lesson is not live;
// it marks no lesson done. Lesson 15's question plays E4, F4 and G4 by its
// own handler, the page's one sound (WEB-SPEC, Toys 8; FACTS 7). The quick
// check asks LESSON.md's four, three answers each and one right, sends
// each wrong answer that holds a misconception to the step that answers
// it, and marks Lesson 21 done once each has an answer.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_QUESTIONS as LESSON_6 } from '@/features/lessons/lesson-06/quiz-questions'
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

/** An element's words as the eye reads them: each sign's spoken word (`.sr`) left out. */
function seen(e: Element): string {
  const copy = e.cloneNode(true) as Element
  copy.querySelectorAll('.sr').forEach((h) => h.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe('the questions', () => {
  it("asks Lesson 6's question 2, then Lesson 15's question 2, in the recall, the very objects (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS).toEqual([
      LESSON_6.find((q) => q.id === 'l06-q2'),
      LESSON_15.find((q) => q.id === 'l15-q2'),
    ])
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l21-q1',
      'l21-q2',
      'l21-q3',
      'l21-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      expect(q.options[0].correct).toBe(true)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct|Not quite)\b/)
    }
  })

  it('speaks every sharp and flat it shows', () => {
    // Act
    mountQuizzes()

    // Assert: each sign hidden from a reader, its word beside it
    const box = el('#qs')
    expect(box.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(
      0,
    )
    expect(box.innerHTML).not.toMatch(/[♯♭](?![^<]*<\/span>)/)
    expect(seen(el('#q0'))).toBe('Why does G major need F♯?')
    expect(words(el('#q0'))).toBe('Why does G major need F♯ sharp?')
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 1, 4, 3 and 5', () => {
    // Assert
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) =>
          Number(m[1]),
        ),
      ),
    )
    expect(steps).toEqual([[1], [4], [3], [5]])
  })
})

describe('the recall', () => {
  it("sends a wrong answer to Lesson 6's or Lesson 15's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where both lessons' drafts are live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, '5 semitones: a perfect fourth').click()
    option('recall-', 1, 'Yes: one letter is always one step').click()

    // Assert (WEB-SPEC, Toys 8)
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#recall-qs .fb a'),
      (a) => [a.getAttribute('href'), a.getAttribute('target'), words(a)],
    )
    expect(links).toEqual([
      ['/learn/06#step-5', '_blank', 'Try Lesson 6, Step 5 again'],
      ['/learn/15#step-2', '_blank', 'Try Lesson 15, Step 2 again'],
    ])
    expect([Done.has(6), Done.has(15), Done.has(21)]).toEqual([
      false,
      false,
      false,
    ])
  })

  it('keeps the words with no link where Lessons 6 and 15 are not live', () => {
    // Arrange: a page served with no draft shown
    serve(false)
    mountQuizzes()

    // Act
    option('recall-', 0, '5 semitones: a perfect fourth').click()
    option('recall-', 1, 'Yes: one letter is always one step').click()

    // Assert
    expect(document.querySelector('#recall-qs .fb a')).toBeNull()
    expect(words(el('#recall-fb0'))).toContain('Try Lesson 6, Step 5 again')
    expect(words(el('#recall-fb1'))).toContain('Try Lesson 15, Step 2 again')
  })

  it("plays Lesson 15's three notes, E4, F4 and G4, by its own handler on the recall", async () => {
    // Arrange
    mountQuizzes()

    // Act
    el<HTMLButtonElement>('#recall-qs [data-quiz-three]').click()
    await settle()

    // Assert: Lesson 15 FACTS 65
    const r = runs[runs.length - 1]
    expect(r.notes.map((n) => n.midi)).toEqual([64, 65, 67])
    expect(el('#recall-qs [data-quiz-three]').classList.contains('is-on')).toBe(
      true,
    )
  })
})

describe('the quick check', () => {
  it('asks its four questions and marks Lesson 21 done once each has an answer', () => {
    // Arrange
    mountQuizzes()
    const asked = document.querySelectorAll('#qs .q').length

    // Act
    for (const i of [1, 2, 3]) el(`#qs .q:nth-child(${i}) .opt`).click()
    const three = Done.has(21)
    el('#qs .q:nth-child(4) .opt').click()

    // Assert
    expect(asked).toBe(4)
    expect(three).toBe(false)
    expect(Done.has(21)).toBe(true)
  })
})
