// ============================================================
// Lesson 26 recall and quick check tests — on the page's markup and the kit's quiz
// ============================================================
//
// The recall asks Lesson 12's question 3 and Lesson 24's question 1, the
// very objects those pages ask, and sends a wrong answer to that lesson's
// own step in a new tab, or keeps the words where the lesson is not live;
// it marks no lesson done, and neither question names a third, a key's
// notes or a harmony (WEB-SPEC, Toys 4; FACTS 1a, 7). The quick check
// asks LESSON.md's four, three answers each and one right, sends each
// wrong answer that holds a misconception to the step that answers it,
// holds question 2's answers and question 4's Play until the cold open's
// choice, plays question 4's two parts by ear, and marks Lesson 26 done
// once each has an answer (FACTS 40, 71 to 74).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_QUESTIONS as LESSON_12 } from '@/features/lessons/lesson-12/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_24 } from '@/features/lessons/lesson-24/quiz-questions'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { spoken } from './parts'
import { HEAR_HELD, QUIZ_QUESTIONS, RECALL_QUESTIONS, TRY_HELD, } from './quiz-questions'
import { initQuizzes, QUIZ_PARTS } from './recall'

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

const partsPlay = (): HTMLButtonElement =>
  el<HTMLButtonElement>('#qs [data-quiz-play="parts"]')

describe('the questions', () => {
  it("asks Lesson 12's question 3, then Lesson 24's question 1, in the recall, the very objects (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS).toEqual([
      LESSON_12.find((q) => q.id === 'l12-q3'),
      LESSON_24.find((q) => q.id === 'l24-q1'),
    ])
    expect(RECALL_QUESTIONS.map((q) => q.slot)).toEqual([undefined, undefined])
  })

  it('asks no recall question that answers the predict: no third, no semitones, no harmony (FACTS 1a)', () => {
    // Act
    const text = RECALL_QUESTIONS.map(
      (q) => `${q.question} ${q.options.map((o) => o.text).join(' ')}`,
    ).join(' ')

    // Assert
    expect(text).not.toMatch(/third|semitone|harmon|leave/i)
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l26-q1',
      'l26-q2',
      'l26-q3',
      'l26-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
      expect(q.options[0].correct).toBe(true)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct|Not quite)\b/)
    }
    // only the predict's question asked again waits for the choice (FACTS 72)
    expect(QUIZ_QUESTIONS.map((q) => q.held === true)).toEqual([
      false,
      true,
      false,
      false,
    ])
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 1, 2, 4 and 2', () => {
    // Assert
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) =>
          Number(m[1]),
        ),
      ),
    )
    expect(steps).toEqual([[1], [2], [4], [2]])
  })
})

describe('the recall', () => {
  it("sends a wrong answer to Lesson 12's or Lesson 24's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where both lessons are live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, 'C, D, E and F').click()
    option('recall-', 1, '443').click()

    // Assert (WEB-SPEC, Toys 4)
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#recall-qs .fb a'),
      (a) => [a.getAttribute('href'), a.getAttribute('target'), words(a)],
    )
    expect(links).toEqual([
      ['/learn/12#step-4', '_blank', 'Try Lesson 12, Step 4 again'],
      ['/learn/24#step-1', '_blank', 'Try Lesson 24, Step 1 again'],
    ])
    expect([Done.has(12), Done.has(24), Done.has(26)]).toEqual([
      false,
      false,
      false,
    ])
  })

  it('keeps the words with no link where Lessons 12 and 24 are not live', () => {
    // Arrange: a page served with no draft shown
    serve(false)
    mountQuizzes()

    // Act
    option('recall-', 0, 'A, E, F and D').click()
    option('recall-', 1, '443').click()

    // Assert
    expect(document.querySelector('#recall-qs .fb a')).toBeNull()
    expect(words(el('#recall-fb0'))).toContain('Try Lesson 12, Step 2 again')
    expect(words(el('#recall-fb1'))).toContain('Try Lesson 24, Step 1 again')
  })
})

describe('the quick check', () => {
  it("holds question 2's answers and question 4's Play until the cold open's choice, each under its line (FACTS 40, 72, 74)", () => {
    // Arrange
    const quizzes = mountQuizzes()
    const before = {
      q2: optionsOf('', 1).map((b) => b.disabled),
      q2Words: words(heldLine(1)),
      q1: optionsOf('', 0).some((b) => b.disabled),
      play: partsPlay().disabled,
      q4Words: words(heldLine(3)),
    }

    // Act
    quizzes.unlock()

    // Assert
    expect(before).toEqual({
      q2: [true, true, true],
      q2Words: TRY_HELD,
      q1: false,
      play: true,
      q4Words: HEAR_HELD,
    })
    expect(optionsOf('', 1).some((b) => b.disabled)).toBe(false)
    expect(heldLine(1)?.hidden).toBe(true)
    expect(partsPlay().disabled).toBe(false)
    expect(heldLine(3)?.hidden).toBe(true)
  })

  it('holds both again on the next visit', () => {
    // Arrange: a visit that made the choice
    mountQuizzes().unlock()
    document.body.textContent = ''

    // Act
    mountQuizzes()

    // Assert
    expect(optionsOf('', 1).every((b) => b.disabled)).toBe(true)
    expect(partsPlay().disabled).toBe(true)
    expect(heldLine(3)?.hidden).toBe(false)
  })

  it("plays do re mi re do with the part four semitones up, then after a second with the key's thirds, 7.0 s, lit while it sounds (FACTS 74)", async () => {
    // Arrange
    mountQuizzes().unlock()

    // Act
    partsPlay().click()
    await settle()
    const r = runs[runs.length - 1]
    const lit = partsPlay().classList.contains('is-on')
    r.end(true)
    await settle()

    // Assert
    expect(r.notes).toEqual(QUIZ_PARTS)
    const at = (t0: number): string[] =>
      r.notes
        .filter((n) => n.t >= t0 && n.t < t0 + 3)
        .map((n) => `${n.t - t0}+${n.dur} ${spoken(n.midi)}`)
    expect(at(0)).toEqual([
      '0+0.5 C 4',
      '0+0.5 E 4',
      '0.5+0.5 D 4',
      '0.5+0.5 F sharp 4',
      '1+0.5 E 4',
      '1+0.5 G sharp 4',
      '1.5+0.5 D 4',
      '1.5+0.5 F sharp 4',
      '2+1 C 4',
      '2+1 E 4',
    ])
    expect(at(4)).toEqual([
      '0+0.5 C 4',
      '0+0.5 E 4',
      '0.5+0.5 D 4',
      '0.5+0.5 F 4',
      '1+0.5 E 4',
      '1+0.5 G 4',
      '1.5+0.5 D 4',
      '1.5+0.5 F 4',
      '2+1 C 4',
      '2+1 E 4',
    ])
    expect(Math.max(...r.notes.map((n) => n.t + n.dur))).toBe(7)
    expect(r.o.kind).toBe('soft')
    expect(lit).toBe(true)
    expect(partsPlay().classList.contains('is-on')).toBe(false)
  })

  it('stops its parts for another sound on the page, and puts its light out', async () => {
    // Arrange
    mountQuizzes().unlock()
    partsPlay().click()
    await settle()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert: WEB-SPEC, Audio
    expect(runs[runs.length - 1].stopped).toBe(true)
    expect(partsPlay().classList.contains('is-on')).toBe(false)
  })

  it('marks Lesson 26 done once all four have an answer', () => {
    // Arrange
    mountQuizzes().unlock()

    // Act
    option('', 0, 'F').click()
    option('', 1, 'Some notes leave the key').click()
    option('', 2, 'Fa').click()
    option('', 3, 'The second').click()

    // Assert
    expect(Done.has(26)).toBe(true)
  })
})
