// ============================================================
// Lesson 18 recall and quick check tests — Lessons 16 and 17's, then four
// ============================================================
//
// The questions, pure: the recall is Lesson 16's question 3 and Lesson 17's
// question 1, the very objects, in that order (FACTS 7), neither naming
// what reading note by note costs (FACTS 1a); the quick check is
// LESSON.md's four, three answers each, one right, no line opening as the
// kit's verdict does, the wrong ones that hold a misconception linking back
// to Steps 1 to 4, every line passing the claims check. Then on the page's
// own markup, carrying Season 2 as main.ts does, with the beat clock a
// recorder: a wrong recall answer goes to that lesson's step in a new tab,
// or keeps its words with no link where the lesson is not live, and the
// recall marks no lesson done; the quick check marks Lesson 18 done once
// each of its four has an answer; and its question 4 plays so, fa, mi
// loud, then after a beat the same three quiet, in the learner's octave,
// its button lit while it sounds, the page's one sound (WEB-SPEC, Toys 4;
// FACTS 83).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { Done } from '@/features/lessons/kit/progress'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { Sound } from '@/features/lessons/kit/sound'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { QUIZ_QUESTIONS as LESSON_16 } from '@/features/lessons/lesson-16/quiz-questions'
import { QUIZ_QUESTIONS as LESSON_17 } from '@/features/lessons/lesson-17/quiz-questions'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { el, finish, loadPage, resetRuns, runs, settle, soundOn, words, } from './page-dom.test-fixtures'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { initQuizzes, LOUD_THEN_QUIET_BEATS } from './recall'

/** What the page booked: each note's frequency and options. */
const booked = vi.hoisted(() => ({
  notes: [] as {
    freq: number
    dur: number
    kind: string | undefined
    levels: unknown
  }[],
}))

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (
    freq: number,
    o: { dur: number; kind?: string; levels?: unknown },
  ) => {
    booked.notes.push({ freq, dur: o.dur, kind: o.kind, levels: o.levels })
    return null
  },
}))

beforeEach(() => {
  localStorage.clear()
  booked.notes.length = 0
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

const play = () => el<HTMLButtonElement>('#qs [data-quiz-play="so-fa-mi"]')
const lit = (b: HTMLButtonElement) => b.classList.contains('is-on')
const D4 = 62
const C4 = 60
const B3 = 59

describe('the questions', () => {
  it("asks Lesson 16's question 3 and Lesson 17's question 1 in the recall, the very objects, in that order (FACTS 7)", () => {
    // Assert
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l16-q3', 'l17-q1'])
    expect(RECALL_QUESTIONS[0]).toBe(LESSON_16.find((q) => q.id === 'l16-q3'))
    expect(RECALL_QUESTIONS[1]).toBe(LESSON_17.find((q) => q.id === 'l17-q1'))
    expect(RECALL_QUESTIONS.map((q) => q.slot)).toEqual([undefined, undefined])
  })

  it('names nothing of what reading note by note costs in the recall (FACTS 1a)', () => {
    // Act
    const said = RECALL_QUESTIONS.flatMap((q) => [
      q.question,
      ...q.options.flatMap((o) => [o.text, o.feedback]),
    ]).join(' ')

    // Assert
    expect(said).not.toMatch(/note by note|behind|late|pattern|on the beat/i)
  })

  it("asks LESSON.md's four, three answers each and one right, no line opening as the kit's verdict does", () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l18-q1',
      'l18-q2',
      'l18-q3',
      'l18-q4',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.question)).toEqual([
      'Someone says: "To sight-sing, work out each note\'s name, then sing it." What does this lesson suggest?',
      'On the staff, two notes side by side on the same line, with no curve joining them, are...',
      'Why does the click count in a bar before you sing?',
      'Listen. What changed the second time?',
    ])
    expect(QUIZ_QUESTIONS.map((q) => q.options.length)).toEqual([3, 3, 3, 3])
    expect(
      QUIZ_QUESTIONS.map((q) =>
        q.options.filter((o) => o.correct === true).map((o) => o.text),
      ),
    ).toEqual([
      ['Read patterns you know, and keep the beat'],
      ['The same note, sung twice'],
      ['To set the tempo'],
      ['Only the loudness'],
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

  it('sends each wrong answer that holds a misconception back to the step that answers it: 1, 2, 3 and 4', () => {
    // Act
    const steps = QUIZ_QUESTIONS.map((q) =>
      q.options.flatMap((o) => {
        const n = /data-goto-step="(\d)"/.exec(o.feedback)?.[1]
        return n === undefined ? [] : [n]
      }),
    )

    // Assert
    expect(steps).toEqual([['1'], ['2'], ['3'], ['4']])
  })

  it("holds question 4's Play in question 4 alone, naming neither loudness and drawn as nothing", () => {
    // Assert: WEB-SPEC, Toys 4; FACTS 83
    expect(QUIZ_QUESTIONS.map((q) => q.slot !== undefined)).toEqual([
      false,
      false,
      false,
      true,
    ])
    const slot = QUIZ_QUESTIONS[3].slot ?? ''
    expect(slot).toContain('data-quiz-play="so-fa-mi"')
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
      { seed: 'fyp-l18-seed', record: 'fyp-l18-quiz-v1' },
      { seed: 'fyp-l18-recall-seed', record: 'fyp-l18-recall-v1' },
    ])
  })
})

describe('the recall', () => {
  it("sends a wrong answer to that lesson's own step, in a new tab, and marks no lesson done once both are answered", () => {
    // Arrange: the dev site, where every draft is live
    serve(true)
    mountQuizzes()

    // Act
    option(
      'recall-',
      0,
      'On three neighbouring places, like line, space, line',
    ).click()
    option('recall-', 1, '2').click()

    // Assert (WEB-SPEC, Toys 4)
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
      ['/learn/16#step-4', '_blank', 'Try Lesson 16, Step 4 again'],
      ['/learn/17#step-1', '_blank', 'Try Lesson 17, Step 1 again'],
    ])
    expect([Done.has(16), Done.has(17), Done.has(18)]).toEqual([
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
    option('recall-', 1, '2').click()

    // Assert
    const fb = el('#recall-fb1')
    expect(fb.querySelector('a')).toBeNull()
    expect(words(fb)).toContain('Try Lesson 17, Step 1 again')
  })

  it('plays nothing', () => {
    // Arrange
    mountQuizzes()

    // Assert
    expect(document.querySelector('#recall-qs [data-quiz-play]')).toBeNull()
  })
})

describe('the quick check', () => {
  it('asks its four questions and marks Lesson 18 done once each has an answer', () => {
    // Arrange
    mountQuizzes()
    const asked = [document.querySelectorAll('#qs .q').length, words(el('#q0'))]

    // Act
    for (const i of [1, 2, 3]) el(`#qs .q:nth-child(${i}) .opt`).click()
    const three = Done.has(18)
    el('#qs .q:nth-child(4) .opt').click()

    // Assert
    expect(asked).toEqual([4, QUIZ_QUESTIONS[0].question])
    expect(three).toBe(false)
    expect(Done.has(18)).toBe(true)
  })

  it("plays question 4's so, fa, mi loud, then after a beat the same three quiet, quarter notes at 60 BPM in the lower voice's octave, its button lit while it sounds", async () => {
    // Arrange
    mountQuizzes()

    // Act
    play().click()
    const during = lit(play())
    const run = runs[0]
    await finish()

    // Assert: FACTS 75, 83: D4, C4, B3, 7.0 s, at 1.0 and then 0.3 of the voice's level
    expect(run.o.bar(0)?.beats).toBe(LOUD_THEN_QUIET_BEATS)
    expect(LOUD_THEN_QUIET_BEATS).toBe(7)
    expect(run.o.bpm()).toBe(60)
    expect(run.o.bar(1)).toBeNull()
    expect(booked.notes.map((n) => n.freq)).toEqual(
      [D4, C4, B3, D4, C4, B3].map(hz),
    )
    expect(booked.notes.map((n) => n.levels)).toEqual([
      [{ at: 0, level: 1 }],
      [{ at: 0, level: 1 }],
      [{ at: 0, level: 1 }],
      [{ at: 0, level: 0.3 }],
      [{ at: 0, level: 0.3 }],
      [{ at: 0, level: 0.3 }],
    ])
    expect(new Set(booked.notes.map((n) => n.dur))).toEqual(
      new Set([heldSeconds(1, 60)]),
    )
    expect(new Set(booked.notes.map((n) => n.kind))).toEqual(new Set(['soft']))
    expect(run.o.bar(0)?.hits.map((h) => h.beat)).toEqual([0, 4, 1, 5, 2, 6])
    expect([during, lit(play())]).toEqual([true, false])
  })

  it('plays in the higher voice once it is chosen, D5, C5 and B4, read at each tap', async () => {
    // Arrange
    mountQuizzes()
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')

    // Act
    play().click()
    await finish()

    // Assert
    expect(booked.notes.map((n) => n.freq).slice(0, 3)).toEqual(
      [D4 + 12, C4 + 12, B3 + 12].map(hz),
    )
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
