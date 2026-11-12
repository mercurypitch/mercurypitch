// ============================================================
// Lesson 20 recall and quick check tests — Lessons 9 and 10's, then four
// ============================================================
//
// The questions, pure: the recall is Lesson 9's question 2 and Lesson
// 10's question 4, the very objects, in that order (FACTS 7), neither
// naming what went with better playing in the pianists' study (FACTS 1a);
// the quick check is LESSON.md's four, three answers each, one right, no
// line opening as the kit's verdict does, the wrong ones that hold a
// misconception linking back to Steps 1, 1, 3 and 2, every line passing
// the claims check. Then on the page's own markup, carrying Season 2 as
// main.ts does, its runs the kit's recorder: a wrong recall answer goes to
// that lesson's step in a new tab, or keeps its words with no link where
// the lesson is not live, and the recall marks no lesson done; the quick
// check marks Lesson 20 done once each of its four has an answer; and its
// question 4 plays E minor pentatonic, E4 to E5 in the soft tone, 3.15 s,
// the same for everyone, its button lit while it sounds, the page's one
// sound (WEB-SPEC, Toys 8; FACTS 76).

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
import { QUIZ_QUESTIONS as LESSON_10 } from '@/features/lessons/lesson-10/quiz-questions'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
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
function mountQuizzes(): StepDeck {
  carrySeason(SEASON_2)
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: (step) => (step <= 2 ? 1 : 2),
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

/** A line's words, its markup gone. */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const play = () => el<HTMLButtonElement>('#qs [data-quiz-play="e-minor-five"]')
const lit = (b: HTMLButtonElement) => b.classList.contains('is-on')

describe('the questions', () => {
  it("asks Lesson 9's question 2 and Lesson 10's question 4 in the recall, the very objects, in that order (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l09-q2', 'l10-q4'])
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_9.find((q) => q.id === 'l09-q2'))
    expect(RECALL_QUESTIONS[1]).toBe(LESSON_10.find((q) => q.id === 'l10-q4'))
    expect(RECALL_QUESTIONS.map((q) => q.slot)).toEqual([undefined, undefined])
  })

  it('names nothing of what went with better playing in the recall (FACTS 1a)', () => {
    // Act
    const said = RECALL_QUESTIONS.flatMap((q) => [
      q.question,
      ...q.options.flatMap((o) => [o.text, o.feedback]),
    ]).join(' ')

    // Assert
    expect(said).not.toMatch(/practi[cs]|tries|share of|study|slow|accura/i)
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l20-q1',
      'l20-q2',
      'l20-q3',
      'l20-q4',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.question)).toEqual([
      'Which notes of the major scale does the major pentatonic leave out?',
      "Are the pentatonic's steps all the same size?",
      "In the pianists' study, what went with better playing the next day?",
      'Listen. Major or minor pentatonic?',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.options.length)).toEqual([3, 3, 3, 3])
    expect(
      QUIZ_QUESTIONS.map((q) =>
        q.options.filter((o) => o.correct === true).map((o) => o.text),
      ),
    ).toEqual([
      ['Fa and ti'],
      ['No: 2, 2, 3, 2 and 3 semitones'],
      ['A higher share of tries that came out right'],
      ['Minor'],
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.options[0].correct)).toEqual([
      true,
      true,
      true,
      true,
    ])
    for (const q of QUIZ_QUESTIONS)
      for (const o of q.options)
        expect(text(o.feedback), q.id).not.toMatch(/^(Right|Yes|Correct)\b/)
  })

  it('sends each wrong answer that holds a misconception back to the step that answers it: 1, 1, 3 and 2', () => {
    // Act
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) => {
        const n = /data-goto-step="(\d)"/.exec(o.feedback)?.[1]
        return n === undefined ? [] : [n]
      }),
    )

    // Assert
    expect(steps).toEqual([['1'], ['1'], ['3'], ['2']])
  })

  it("holds question 4's Play in question 4 alone, naming neither scale and drawn as nothing", () => {
    // Assert: WEB-SPEC, Toys 8; FACTS 76
    expect(QUIZ_QUESTIONS.map((q) => q.slot !== undefined)).toEqual([
      false,
      false,
      false,
      true,
    ])
    const slot = QUIZ_QUESTIONS[3].slot ?? ''
    expect(slot).toContain('data-quiz-play="e-minor-five"')
    expect(text(slot)).toBe('Play')
    expect(slot.match(/<svg/g)).toHaveLength(1)
    expect(slot).toContain('<svg class="ico"')
  })

  it('says only what the lesson showed, in lines the claims check passes', () => {
    // Act
    const lines = QUIZ_QUESTIONS.flatMap((q) => [
      text(q.question),
      ...q.options.flatMap((o) => [text(o.text), text(o.feedback)]),
    ])

    // Assert
    for (const line of lines)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
  })

  it('stores each quiz under keys of its own', () => {
    // Assert
    expect([QUIZ_KEYS, RECALL_KEYS]).toEqual([
      { seed: 'fyp-l20-seed', record: 'fyp-l20-quiz-v1' },
      { seed: 'fyp-l20-recall-seed', record: 'fyp-l20-recall-v1' },
    ])
  })
})

describe('the recall', () => {
  it("sends a wrong answer to that lesson's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where every draft is live
    serve(true)
    mountQuizzes()

    // Act
    option('recall-', 0, 'Two major thirds: 4 and 4').click()
    option('recall-', 1, 'Only E: mi becomes me').click()

    // Assert (WEB-SPEC, Toys 8)
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
      ['/learn/10#step-5', '_blank', 'Try Lesson 10, Step 5 again'],
    ])
    expect([Done.has(9), Done.has(10), Done.has(20)]).toEqual([
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
    option('recall-', 1, 'Only E: mi becomes me').click()

    // Assert
    const fb = el('#recall-fb1')
    expect(fb.querySelector('a')).toBeNull()
    expect(words(fb)).toContain('Try Lesson 10, Step 5 again')
  })

  it('plays nothing', () => {
    // Arrange
    mountQuizzes()

    // Assert
    expect(document.querySelector('#recall-qs [data-quiz-play]')).toBeNull()
  })
})

describe('the quick check', () => {
  it('asks its four questions and marks Lesson 20 done once each has an answer', () => {
    // Arrange
    mountQuizzes()
    const asked = [document.querySelectorAll('#qs .q').length, words(el('#q0'))]

    // Act
    for (const i of [1, 2, 3]) el(`#qs .q:nth-child(${i}) .opt`).click()
    const three = Done.has(20)
    el('#qs .q:nth-child(4) .opt').click()

    // Assert
    expect(asked).toEqual([4, QUIZ_QUESTIONS[0].question])
    expect(three).toBe(false)
    expect(Done.has(20)).toBe(true)
  })

  it("plays question 4's E minor pentatonic, E4, G4, A4, B4, D5 and E5 in the soft tone, 0.45 s a note with the last 0.9 s, its button lit while it sounds", async () => {
    // Arrange
    mountQuizzes()

    // Act
    play().click()
    const during = lit(play())
    const run = runs[0]
    run.end(true)
    await settle()

    // Assert: FACTS 76
    expect(run.kind).toBe('notes')
    expect(run.o).toMatchObject({ audible: true, kind: 'soft' })
    expect(run.notes.map((n) => n.midi)).toEqual([64, 67, 69, 71, 74, 76])
    expect(run.notes.map((n) => Math.round(n.t * 100) / 100)).toEqual([
      0, 0.45, 0.9, 1.35, 1.8, 2.25,
    ])
    expect(run.notes.map((n) => n.dur)).toEqual([
      0.45, 0.45, 0.45, 0.45, 0.45, 0.9,
    ])
    expect([during, lit(play())]).toEqual([true, false])
  })

  it('plays the same for the higher voice', () => {
    // Arrange
    mountQuizzes()
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')

    // Act
    play().click()

    // Assert
    expect(runs[0].notes[0].midi).toBe(64)
  })

  it('starts again from the start on a second tap, and keeps playing when the run it stopped ends late', async () => {
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
