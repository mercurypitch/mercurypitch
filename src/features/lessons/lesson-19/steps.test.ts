// ============================================================
// Lesson 19 steps tests — one rhythm bar, in each step's state
// ============================================================
//
// On the page's own markup and its own deck, with the beat clock a
// recorder (kit/beat-clock-recorder.test-fixtures.ts): each step shows its
// own row and caption (WEB-SPEC, Toys 6); Step 1's 6/8 · 3/4 regroups the
// six eighths, keeping them written, and plays nothing until Play, which
// strikes the metre's drums with no click (Toys 1; FACTS 18); Step 2's
// tunes on the stored voice's clef, each written as it first sounds and
// kept for the visit, sounding as written, on one system or two, played
// from the text's two buttons too, and Clef (Toys 5); Step 3's triplet and
// Step 4's moved note, the beats they leave kept written, over the click;
// Count by step; and leaving a step stops what it plays.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { drive, finish, resetRuns, runs, } from '@/features/lessons/kit/beat-clock-recorder.test-fixtures'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { el, loadPage, soundOn, words } from './page-dom.test-fixtures'
import { FIG } from './rhythm-views'
import { initSteps, SWITCH_SAID } from './steps'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (
    await import('@/features/lessons/kit/beat-clock-recorder.test-fixtures')
  ).FakeBeatClock,
}))
const voices: number[] = []
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (freq: number) => {
    voices.push(freq)
    return null
  },
}))
const knocks: boolean[] = []
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: (_bus: unknown, _when: number, high: boolean) => {
    knocks.push(high)
  },
}))
const drums: string[] = []
vi.mock('@/lib/drum-voices', () => ({
  triggerDrumVoice: (id: string) => {
    drums.push(id)
  },
}))

/** The steps on the page's own deck, as main.ts mounts them: the deck, the toy, then the deck's start. */
function mountSteps(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Tap the beat', selector: '#tap' },
  })
  initSteps(deck)
  deck.start()
  return deck
}

beforeEach(() => {
  resetRuns()
  voices.length = 0
  knocks.length = 0
  drums.length = 0
  soundOn()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The figure's written symbols, by row and index. */
const written = (): string[] =>
  Array.from(
    document.querySelectorAll('#toyRhythm .rb-sym:not(.is-hidden)'),
    (g) => g.getAttribute('data-i') ?? '',
  )
const figure = () => el('#toyRhythm [data-rb]')
const said = () => words(el('#toyRhythm [data-rb-said]'))
/** The showing row's button `selector` finds. */
const showing = (selector: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(selector)).find(
    (b) => b.closest('[hidden]') === null,
  ) ?? el<HTMLButtonElement>(selector)
const shownRows = () =>
  Array.from(document.querySelectorAll<HTMLElement>('#toyRhythm [data-rb-for]'))
    .filter((r) => !r.hidden)
    .map((r) => r.dataset.rbFor)
/** The caption's markup, its white space as a reader meets it. */
const caption = () =>
  el('#toyRhythm [data-fig-label]').innerHTML.replace(/\s+/g, ' ').trim()

describe('the four steps', () => {
  it('shows each step its own row, its caption and its bar', () => {
    // Arrange
    const deck = mountSteps()
    const seen: [string[], string, string | null][] = []

    // Act
    for (const n of [1, 2, 3, 4]) {
      deck.show(n, { scroll: false })
      seen.push([
        shownRows() as string[],
        caption(),
        figure().getAttribute('aria-label'),
      ])
    }

    // Assert (WEB-SPEC, Toys 6)
    expect(seen.map((s) => s[0])).toEqual([
      ['metre'],
      ['tunes'],
      ['triplet'],
      ['sync'],
    ])
    expect(seen.map((s) => s[1])).toEqual([FIG[1], FIG[2], FIG[3], FIG[4]])
    expect(seen[0][2]).toBe(
      'One bar of 6/8: six eighth notes, in two groups of three, on one line',
    )
    expect(seen[1][2]).toMatch(/^Four bars of 6\/8: .*, on the bass staff$/)
    expect(seen[3][2]).toBe('One bar of 4/4: four quarter notes, on one line')
  })

  it("regroups Step 1's six eighths as 3/4, saying so and playing nothing, then plays the bar on its drums with no click, an arc under each group (FACTS 18)", async () => {
    // Arrange
    mountSteps()

    // Act
    showing('[data-rb-metre="3-4"]').click()
    const before = runs.length
    showing('[data-rb-play]').click()
    await finish()

    // Assert
    expect(before).toBe(0)
    expect(said()).toBe(SWITCH_SAID['3-4'])
    expect(showing('[data-rb-metre="3-4"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(figure().getAttribute('aria-label')).toMatch(
      /^One bar of 3\/4: .*three groups of two/,
    )
    expect(drums).toEqual([
      'kick',
      'hh-closed',
      'snare',
      'hh-closed',
      'snare',
      'hh-closed',
    ])
    expect([knocks, voices]).toEqual([[], []])
    expect(
      document.querySelectorAll('#toyRhythm .rb-arc:not(.is-hidden)'),
    ).toHaveLength(3)
  })

  it('keeps the six eighths written as they regroup, the arcs gone until the bar plays again', async () => {
    // Arrange
    mountSteps()
    showing('[data-rb-play]').click()
    await finish()

    // Act
    showing('[data-rb-metre="3-4"]').click()

    // Assert
    expect(written()).toEqual(['0', '1', '2', '3', '4', '5'])
    expect(
      document.querySelectorAll('#toyRhythm .rb-arc:not(.is-hidden)'),
    ).toHaveLength(0)
  })

  it("writes Step 2's tune as it first sounds, on the bass staff with no voice stored, sounding from C3, on two systems on a phone", async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2, { scroll: false })
    const before = written()
    const metre = figure()
      .querySelector('.rb-metre')
      ?.classList.contains('is-hidden')

    // Act
    showing('[data-rb-play]').click()
    drive(1)
    const first = written()
    await finish()

    // Assert: only the clef and 6/8 until it plays (Toys 5; FACTS 61)
    expect([before, metre]).toEqual([[], false])
    expect(first.length).toBeGreaterThan(0)
    expect(written()).toHaveLength(15)
    expect(figure().querySelectorAll('.rb-clef')).toHaveLength(2)
    expect(voices.slice(0, 4).map((f) => Number(f.toFixed(2)))).toEqual([
      130.81, 146.83, 164.81, 196,
    ])
    expect(knocks).toEqual([])
  })

  it('plays either tune from the text, and keeps each written for the visit', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2, { scroll: false })

    // Act: the 3/4 tune from the text, then the 6/8 tune shown, then back
    el<HTMLButtonElement>('[data-tune-play="3-4"]').click()
    await finish()
    const heard = written().length
    showing('[data-rb-metre="6-8"]').click()
    const other = written().length
    showing('[data-rb-metre="3-4"]').click()

    // Assert
    expect(heard).toBe(12)
    expect(other).toBe(0)
    expect(written()).toHaveLength(12)
    expect(said()).toBe(SWITCH_SAID.tune['3-4'])
  })

  it("opens Step 2 for a tune's button in its text pressed from another step, and plays that tune there", () => {
    // Arrange
    const deck = mountSteps()

    // Act
    el<HTMLButtonElement>('[data-tune-play="3-4"]').click()

    // Assert
    expect(deck.current).toBe(2)
    expect(shownRows()).toEqual(['tunes'])
    expect(figure().getAttribute('aria-label')).toMatch(/^Four bars of 3\/4: /)
    expect(runs).toHaveLength(1)
  })

  it('lays the tune on one system where the figure is wide', () => {
    // Arrange
    const deck = mountSteps()
    vi.spyOn(figure(), 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 250,
    } as DOMRect)

    // Act
    deck.show(2, { scroll: false })

    // Assert
    expect(figure().querySelectorAll('.rb-clef')).toHaveLength(1)
  })

  it("redraws Step 2's tune on the treble staff keeping what was heard, and sounds it from C4", async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2, { scroll: false })
    showing('[data-rb-play]').click()
    await finish()
    voices.length = 0

    // Act
    showing('[data-rb-clef="treble"]').click()
    const kept = written().length
    showing('[data-rb-play]').click()
    await finish()

    // Assert
    expect(kept).toBe(15)
    expect(said()).toBe(SWITCH_SAID.treble)
    expect(Number(voices[0].toFixed(2))).toBe(261.63)
  })

  it("splits Step 3's beat 3 in three, keeping the beats it leaves written, and plays the bar over the click", async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3, { scroll: false })
    showing('[data-rb-play]').click()
    await finish()
    knocks.length = 0

    // Act
    showing('[data-rb-split="triplet"]').click()
    const kept = written()
    showing('[data-rb-play]').click()
    await finish()

    // Assert: beats 1, 2 and 4 stay; the triplet waits for its sound
    expect(kept).toEqual(['0', '1', '2', '6'])
    expect(said()).toBe(SWITCH_SAID.triplet)
    expect(knocks).toEqual([true, false, false, false])
    expect(written()).toHaveLength(7)
  })

  it('moves Step 4\'s third note to "2 and" and counts the bar by step', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4, { scroll: false })

    // Act
    showing('[data-rb-move="on-2-and"]').click()
    showing('[data-rb-count]').click()
    showing('[data-rb-play]').click()
    await finish()
    const counts = Array.from(
      document.querySelectorAll('#toyRhythm .rb-count:not(.is-hidden)'),
      (c) => c.textContent,
    )
    deck.show(3, { scroll: false })

    // Assert: "1, 2 and (3) 4"; Step 3 keeps its own Count, off
    expect(said()).toBe(SWITCH_SAID['on-2-and'])
    expect(counts).toEqual(['1', '2', 'and', '(3)', '4'])
    expect(document.querySelectorAll('#toyRhythm .rb-count')).toHaveLength(0)
  })

  it('stops what a step plays as the learner leaves it', () => {
    // Arrange
    const deck = mountSteps()
    showing('[data-rb-play]').click()
    drive(1)

    // Act
    deck.show(2, { scroll: false })

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})
