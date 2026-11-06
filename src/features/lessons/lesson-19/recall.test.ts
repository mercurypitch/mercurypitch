// ============================================================
// Lesson 19 recall and quick check tests — Lesson 17's two, then four
// ============================================================
//
// The questions, pure: the recall is Lesson 17's questions 3 and 2, the
// very objects, in that order (FACTS 7); the quick check is LESSON.md's
// four, three answers each, one right, no line opening as the kit's
// verdict does, the wrong ones that hold a misconception linking back to
// Steps 1, 1, 3 and 4. Then on the page's own markup, carrying Season 2 as
// main.ts does, with the beat clock the kit's recorder: a wrong recall
// answer goes to Lesson 17's step in a new tab, or keeps its words with no
// link where Lesson 17 is not live, and the recall marks no lesson done;
// the quick check marks
// Lesson 19 done once each of its four has an answer; and its question 2
// plays Subdivide's second 6/8 twice on the drums at the page's speed,
// 4 s, its button lit while it sounds, the page's one sound (WEB-SPEC,
// Toys 9; FACTS 68, 69).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { drive, finish, resetRuns, runs, } from '@/features/lessons/kit/beat-clock-recorder.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_QUESTIONS as LESSON_17 } from '@/features/lessons/lesson-17/quiz-questions'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'
import { initQuizzes, QUIZ_BAR } from './recall'
import { SIX_BPM } from './rhythm-views'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (
    await import('@/features/lessons/kit/beat-clock-recorder.test-fixtures')
  ).FakeBeatClock,
}))
const drums: string[] = []
vi.mock('@/lib/drum-voices', () => ({
  triggerDrumVoice: (id: string, _c: unknown, _w: number, level: number) => {
    drums.push(`${id} ${level}`)
  },
}))

beforeEach(() => {
  localStorage.clear()
  drums.length = 0
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
function mountQuizzes(): StepDeck {
  carrySeason(SEASON_2)
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Tap the beat', selector: '#tap' },
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

const play = () => el<HTMLButtonElement>('#qs [data-quiz-bars]')
const lit = (b: HTMLButtonElement) => b.classList.contains('is-on')

describe('the questions', () => {
  it("asks Lesson 17's questions 3 and 2 in the recall, the very objects, in that order (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS).toEqual([
      LESSON_17.find((q) => q.id === 'l17-q3'),
      LESSON_17.find((q) => q.id === 'l17-q2'),
    ])
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_17[2])
    expect(RECALL_QUESTIONS[1]).toBe(LESSON_17[1])
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.question)).toEqual([
      'In 6/8, how many beats are in a bar?',
      'Listen. Is this 6/8 or 3/4?',
      'What does a triplet do?',
      'What makes a rhythm syncopated?',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.options.length)).toEqual([3, 3, 3, 3])
    expect(
      QUIZ_QUESTIONS.map((q) =>
        q.options.filter((o) => o.correct === true).map((o) => o.text),
      ),
    ).toEqual([
      ['Two'],
      ['6/8'],
      ['Fits three notes into the time of two'],
      ['An accent off the beat'],
    ])
    for (const q of QUIZ_QUESTIONS)
      for (const o of q.options)
        expect(o.feedback).not.toMatch(/^(Right|Yes|Correct)\b/)
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 1, 1, 3 and 4', () => {
    // Act
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) => {
        const n = /data-goto-step="(\d)"/.exec(o.feedback)?.[1]
        return n === undefined ? [] : [n]
      }),
    )

    // Assert
    expect(steps).toEqual([['1'], ['1'], ['3'], ['4']])
  })

  it("plays Subdivide's second bar of 6/8, a hit on each eighth, the kick full on 1 (FACTS 68)", () => {
    // Assert
    expect(QUIZ_BAR.map((h) => [h.beat, h.data.voice, h.data.level])).toEqual([
      [0, 'kick', 1],
      [0.5, 'hh-closed', 0.7],
      [1, 'sidestick', 0.7],
      [1.5, 'kick', 0.7],
      [2, 'hh-closed', 0.7],
      [2.5, 'sidestick', 0.7],
    ])
  })
})

describe('the recall', () => {
  it("sends a wrong answer to Lesson 17's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where Lesson 17's draft is live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, 'Two and a half beats').click()
    el('#recall-qs .q:nth-child(2) .opt').click()

    // Assert (WEB-SPEC, Toys 9)
    expect(
      Array.from(document.querySelectorAll('#recall-qs .q h3'), (h) =>
        words(h),
      ),
    ).toEqual([
      'In 4/4, how long does a dotted half note last?',
      'At 120 BPM, with a quarter note on each beat, how long does each quarter note last?',
    ])
    const link = el('#recall-qs').querySelector<HTMLAnchorElement>('.fb a')
    expect(link?.getAttribute('href')).toBe('/learn/17#step-5')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(words(link)).toBe('Try Lesson 17, Step 5 again')
    expect(document.querySelectorAll('#recall-qs .fb')).toHaveLength(2)
    expect([Done.has(17), Done.has(19)]).toEqual([false, false])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it('keeps the words with no link where Lesson 17 is not live', () => {
    // Arrange: a page served with no draft shown
    serve(false)
    mountQuizzes()

    // Act
    option('recall-', 0, 'Two and a half beats').click()

    // Assert
    const fb = el('#recall-fb0')
    expect(fb.querySelector('a')).toBeNull()
    expect(words(fb)).toContain('Try Lesson 17, Step 5 again')
  })
})

describe('the quick check', () => {
  it('asks its four questions and marks Lesson 19 done once each has an answer', () => {
    // Arrange
    mountQuizzes()
    const asked = [document.querySelectorAll('#qs .q').length, words(el('#q0'))]

    // Act
    for (const i of [1, 2, 3]) el(`#qs .q:nth-child(${i}) .opt`).click()
    const three = Done.has(19)
    el('#qs .q:nth-child(4) .opt').click()

    // Assert
    expect(asked).toEqual([4, 'In 6/8, how many beats are in a bar?'])
    expect(three).toBe(false)
    expect(Done.has(19)).toBe(true)
  })

  it("plays question 2's bar twice on the drums at the page's speed, 4 s, its button lit while it sounds", async () => {
    // Arrange
    mountQuizzes()

    // Act
    play().click()
    const run = runs[0]
    const during = lit(play())
    await finish()

    // Assert: two bars of three quarters at 90, four seconds (FACTS 69)
    const beats = [run.o.bar(0)?.beats ?? 0, run.o.bar(1)?.beats ?? 0]
    expect(run.o.bpm()).toBe(SIX_BPM)
    expect(beats).toEqual([3, 3])
    expect(run.o.bar(2)).toBeNull()
    expect(((beats[0] + beats[1]) * 60) / run.o.bpm()).toBe(4)
    expect(run.o.audible).toBe(true)
    expect(drums).toEqual(
      Array.from({ length: 2 }, () => [
        'kick 1',
        'hh-closed 0.7',
        'sidestick 0.7',
        'kick 0.7',
        'hh-closed 0.7',
        'sidestick 0.7',
      ]).flat(),
    )
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
    drive(1)

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(lit(play())).toBe(false)
  })

  it('plays again from the start on a second press, the cut play ending leaving the new one lit', async () => {
    // Arrange
    mountQuizzes()
    play().click()

    // Act
    play().click()
    await settle()
    const after = [runs[0].stopped, runs.length, lit(play())]
    await finish()

    // Assert
    expect(after).toEqual([true, 2, true])
    expect(lit(play())).toBe(false)
  })
})
