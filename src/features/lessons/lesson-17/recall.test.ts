// ============================================================
// Lesson 17 recall and quick check tests — on the page's markup and the kit's quiz
// ============================================================
//
// The recall asks Lesson 8's questions 2 and 4, sends a wrong answer to
// Lesson 8's own step in a new tab, marks no lesson done, and its question
// 2 plays Lesson 8's two bars on this quiz's host (WEB-SPEC, Toys 9). The
// quick check asks four and marks Lesson 17 done once each has an answer;
// its question 4 plays two eighths and a quarter at 60 BPM over two clicks
// (FACTS 68), lit while it sounds, and every play here is the page's one
// sound. The beat clock is a recorder, and the woodblock's and the notes'
// bookings are recorded where the clock would book them.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Done } from '@/features/lessons/kit/progress'
import { WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import { Sound } from '@/features/lessons/kit/sound'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { el, finish, loadPage, resetRuns, runs, settle, soundOn, words, } from './page-dom.test-fixtures'
import type { RhythmHit } from './recall'
import { initQuizzes } from './recall'

/** What the page booked: each knock's arguments, and each note's. */
const booked = vi.hoisted(() => ({
  wood: [] as unknown[][],
  notes: [] as unknown[][],
}))

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (...a: unknown[]) => {
    booked.notes.push(a)
    return null
  },
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: (...a: unknown[]) => {
    booked.wood.push(a)
  },
}))

beforeEach(() => {
  localStorage.clear()
  booked.wood.length = 0
  booked.notes.length = 0
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The page's markup and deck, with the quizzes mounted as main.ts mounts them. */
function mountQuizzes(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Tap it', selector: '#sing' },
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

const bars = () => el<HTMLButtonElement>('#recall-qs [data-quiz-play="bars"]')
const rhythm = () => el<HTMLButtonElement>('#qs [data-quiz-rhythm]')
const lit = (b: HTMLButtonElement) => b.classList.contains('is-on')

describe('the recall', () => {
  it("asks Lesson 8's questions 2 and 4 and sends a wrong answer to Lesson 8's own step, in a new tab", () => {
    // Arrange
    mountQuizzes()

    // Act
    option('recall-', 0, '2').click()

    // Assert (WEB-SPEC, Toys 9)
    expect(
      Array.from(document.querySelectorAll('#recall-qs .q h3'), (h) =>
        words(h),
      ),
    ).toEqual([
      'Listen. How many beats are in each bar?',
      'Same song, same speed: the claps move from 1 and 3 to 2 and 4. What changed?',
    ])
    expect(document.querySelectorAll('#recall-qs .q')).toHaveLength(2)
    const link = el('#recall-qs').querySelector<HTMLAnchorElement>('.fb a')
    expect(link?.getAttribute('href')).toBe('/learn/08#step-3')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(words(link)).toBe('Try Lesson 8, Step 3 again')
  })

  it('marks no lesson done once both are answered', () => {
    // Arrange
    mountQuizzes()

    // Act
    for (const i of [0, 1]) el(`#recall-qs .q:nth-child(${i + 1}) .opt`).click()

    // Assert
    expect(document.querySelectorAll('#recall-qs .fb')).toHaveLength(2)
    expect([Done.has(8), Done.has(17)]).toEqual([false, false])
    expect(localStorage.getItem('fyp-done')).toBeNull()
  })

  it("plays Lesson 8's two bars on its own host, and the quick check's rhythm stops them", () => {
    // Arrange
    mountQuizzes()

    // Act
    bars().click()
    const first = [runs.length, lit(bars())]
    rhythm().click()

    // Assert: the page's one sound
    expect(first).toEqual([1, true])
    expect(runs[0].stopped).toBe(true)
    expect(lit(bars())).toBe(false)
    expect(lit(rhythm())).toBe(true)
  })
})

describe('the quick check', () => {
  it('asks its four questions and marks Lesson 17 done once each has an answer', () => {
    // Arrange
    mountQuizzes()
    const asked = [document.querySelectorAll('#qs .q').length, words(el('#q0'))]

    // Act
    for (const i of [0, 1, 2]) el(`#qs .q:nth-child(${i + 1}) .opt`).click()
    const three = Done.has(17)
    el('#qs .q:nth-child(4) .opt').click()

    // Assert
    expect(asked).toEqual([
      4,
      'How many quarter notes last as long as one whole note?',
    ])
    expect(three).toBe(false)
    expect(Done.has(17)).toBe(true)
  })

  it("plays question 4's two eighths and a quarter at 60 BPM over two knocks, beat 1's higher, its button lit while it sounds", async () => {
    // Arrange
    mountQuizzes()

    // Act
    rhythm().click()
    const run = runs[0]
    const tempo = run.o.bpm()
    const bar = run.o.bar(0)
    const sounding = lit(rhythm())
    await finish()

    // Assert (FACTS 68): the clicks on beats 1 and 2, the notes on 1, "and", 2
    expect(tempo).toBe(60)
    expect(bar?.beats).toBe(2)
    expect(run.o.bar(1)).toBeNull()
    expect(run.o.audible).toBe(true)
    expect(sounding).toBe(true)
    expect(booked.wood.map((a) => [a[2], a[3]])).toEqual([
      [true, WOOD_LEVEL],
      [false, WOOD_LEVEL],
    ])
    expect(
      bar?.hits
        .filter((h) => (h.data as RhythmHit).k === 'note')
        .map((h) => h.beat),
    ).toEqual([0, 0.5, 1])
    expect(booked.notes.map((a) => a[0])).toEqual([hz(A3), hz(A3), hz(A3)])
    expect(
      booked.notes.map((a) => (a[1] as { dur: number; kind: string }).dur),
    ).toEqual([heldSeconds(0.5, 60), heldSeconds(0.5, 60), heldSeconds(1, 60)])
    expect(lit(rhythm())).toBe(false)
  })

  it("sings at the higher voice's A for a viewer who chose it", async () => {
    // Arrange
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')
    mountQuizzes()

    // Act
    rhythm().click()
    await finish()

    // Assert
    expect(booked.notes.map((a) => a[0])).toEqual([hz(A4), hz(A4), hz(A4)])
  })

  it('runs silent with sound off', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    mountQuizzes()

    // Act
    rhythm().click()

    // Assert
    expect(runs[0].o.audible).toBe(false)
  })

  it('stops at once when another sound starts, its button put out', () => {
    // Arrange
    mountQuizzes()
    rhythm().click()

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(lit(rhythm())).toBe(false)
  })

  it('plays again from the start on a second press, the cut play ending leaving the new one lit', async () => {
    // Arrange
    mountQuizzes()
    rhythm().click()

    // Act
    rhythm().click()
    await settle()
    const after = [runs[0].stopped, runs.length, lit(rhythm())]
    await finish()

    // Assert
    expect(after).toEqual([true, 2, true])
    expect(lit(rhythm())).toBe(false)
  })

  it('keeps its play across answers', () => {
    // Arrange
    mountQuizzes()
    rhythm().click()

    // Act
    option('', 3, 'Three quarters').click()

    // Assert
    expect(document.querySelectorAll('#qs [data-quiz-rhythm]')).toHaveLength(1)
    expect(runs[0].stopped).toBe(false)
  })
})
