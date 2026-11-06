// ============================================================
// Lesson 19 cold open tests — six pads, played even and grouped two ways
// ============================================================
//
// On the page's own markup, with the beat clock a recorder (WEB-SPEC, Toys
// 2 and 3): six pads, nothing written and no arc before a play, the
// groupings locked until a choice; Play six notes strikes twelve even
// hi-hats with no hop; each grouping strikes its drums, draws its arcs and
// hops on every kick and snare, started HOP_MS ahead after Lesson 8's lead
// (FACTS 18, 57, 64); the reveal waits for both groupings heard to their
// end, a play cut short changing nothing, and shows its closing line on a
// guess of "In twos" only; the caption names each play without the answer;
// the tour waits for the choice (FACTS 60); and a step change stops the
// hero's play.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { drive, finish, resetRuns, runs, } from '@/features/lessons/kit/beat-clock-recorder.test-fixtures'
import type * as MercHopModule from '@/features/lessons/kit/merc-hop'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { COLD_PREDICT, GROUPING_LEAD, HERO_CAPTION, initColdOpen, } from './cold-open'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (
    await import('@/features/lessons/kit/beat-clock-recorder.test-fixtures')
  ).FakeBeatClock,
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
  triggerDrumVoice: (
    id: string,
    _ctx: unknown,
    _when: number,
    level: number,
  ) => {
    drums.push(`${id} ${level}`)
  },
}))
const hopped: string[] = []
vi.mock('@/features/lessons/kit/merc-hop', async (actual) => ({
  ...(await actual<typeof MercHopModule>()),
  mercHop: (which: string) => {
    hopped.push(which)
  },
}))
const held: Promise<unknown>[] = []
vi.mock('@/features/lessons/kit/tour-gate', async (actual) => ({
  ...(await actual<typeof TourGateModule>()),
  holdTour: (until: Promise<unknown>) => {
    held.push(until)
    return true
  },
}))

beforeEach(() => {
  resetRuns()
  knocks.length = 0
  drums.length = 0
  hopped.length = 0
  held.length = 0
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mountHero(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Tap the beat', selector: '#tap' },
  })
  deck.start()
  initColdOpen(deck)
  return deck
}

const play = (g: 'Six' | 'Threes' | 'Twos') =>
  el<HTMLButtonElement>(`#heroPlay${g}`)
const choose = (c: 'threes' | 'twos') =>
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
const arcs = () =>
  document.querySelectorAll('#heroPads .rb-arc:not(.is-hidden)').length
const reveal = () => el('#predict .reveal')
const hint = () => words(el('#predict .lock-hint'))

/** Plays one of the hero's plays to its end, heard. */
async function hear(g: 'Six' | 'Threes' | 'Twos'): Promise<void> {
  play(g).click()
  await settle()
  await finish()
  await settle()
}

describe('the cold open', () => {
  it('shows six pads with nothing written and no arc, the figure hidden from a screen reader, the groupings locked until a choice', () => {
    // Act
    mountHero()

    // Assert (WEB-SPEC, Toys 2)
    expect(document.querySelectorAll('#heroPads .rb-pad')).toHaveLength(6)
    expect(document.querySelectorAll('#heroPads .rb-sym')).toHaveLength(0)
    expect(arcs()).toBe(0)
    expect(el('#heroPads').getAttribute('aria-hidden')).toBe('true')
    expect(words(el('[data-hero-caption]'))).toBe(HERO_CAPTION.six)
    expect([
      play('Six').disabled,
      play('Threes').disabled,
      play('Twos').disabled,
    ]).toEqual([false, true, true])
  })

  it("plays six notes before a choice: twelve closed hi-hats at 0.7, no click, no arc and no hop, from the clock's short lead", async () => {
    // Arrange
    mountHero()

    // Act
    play('Six').click()
    const run = runs[runs.length - 1]
    await finish()

    // Assert (FACTS 64)
    expect(drums).toEqual(Array.from({ length: 12 }, () => 'hh-closed 0.7'))
    expect([knocks, hopped, arcs()]).toEqual([[], [], 0])
    expect([run.o.lead, run.o.early]).toEqual([undefined, undefined])
    expect(hint()).toBe('Choose an answer to unlock the two groupings.')
  })

  it("plays in threes once a choice locks: Subdivide's 6/8 twice, a hop on every kick and snare after Lesson 8's lead, two arcs", async () => {
    // Arrange
    mountHero()
    choose('threes')

    // Act
    play('Threes').click()
    const run = runs[runs.length - 1]
    await finish()

    // Assert: four hops, Merc and Tavi each (FACTS 18, 57)
    expect(drums.slice(0, 6)).toEqual([
      'kick 1',
      'hh-closed 0.7',
      'hh-closed 0.7',
      'snare 0.7',
      'hh-closed 0.7',
      'hh-closed 0.7',
    ])
    expect(drums).toHaveLength(12)
    expect(hopped).toHaveLength(8)
    expect([run.o.lead, run.o.early]).toEqual([GROUPING_LEAD, 0.53])
    expect(arcs()).toBe(2)
    expect(words(el('[data-hero-caption]'))).toBe(HERO_CAPTION.threes)
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
  })

  it('plays in twos: the kick on 1 and the snare on 3 and 5, three hops a bar, three arcs', async () => {
    // Arrange
    mountHero()
    choose('twos')

    // Act
    play('Twos').click()
    await finish()

    // Assert
    expect(drums.slice(0, 6)).toEqual([
      'kick 1',
      'hh-closed 0.7',
      'snare 0.7',
      'hh-closed 0.7',
      'snare 0.7',
      'hh-closed 0.7',
    ])
    expect(hopped).toHaveLength(12)
    expect(arcs()).toBe(3)
  })

  it('reveals only once both groupings have been heard to their end, a play cut short changing nothing, with no closing line for "In threes"', async () => {
    // Arrange
    mountHero()
    choose('threes')

    // Act: threes heard, twos cut short, then twos heard
    await hear('Threes')
    const afterOne = reveal().hidden
    play('Twos').click()
    drive(1)
    play('Six').click()
    await settle()
    const afterCut = reveal().hidden
    await finish()
    await hear('Twos')

    // Assert (FACTS 59)
    expect([afterOne, afterCut]).toEqual([true, true])
    expect(reveal().hidden).toBe(false)
    expect(el('[data-fair-guess]').hidden).toBe(true)
    expect(hint()).toBe(COLD_PREDICT.hints.again)
  })

  it('shows the closing line on a guess of "In twos"', async () => {
    // Arrange
    mountHero()
    choose('twos')

    // Act
    await hear('Twos')
    await hear('Threes')

    // Assert
    expect(reveal().hidden).toBe(false)
    expect(el('[data-fair-guess]').hidden).toBe(false)
  })

  it('names each play in its caption, never which grouping makes two beats, and draws the six even again with no arcs', async () => {
    // Arrange
    mountHero()
    choose('twos')
    await hear('Twos')

    // Act
    await hear('Six')

    // Assert
    expect(words(el('[data-hero-caption]'))).toBe(HERO_CAPTION.six)
    expect(arcs()).toBe(0)
    for (const c of Object.values(HERO_CAPTION))
      expect(c).not.toMatch(/two beats|three beats|compound|6\/8|3\/4/i)
  })

  it('holds the welcome tour until the choice locks (FACTS 60)', async () => {
    // Arrange
    mountHero()
    let choice: unknown = null
    void held[0].then((c) => (choice = c))

    // Act
    choose('twos')
    await settle()

    // Assert
    expect(held).toHaveLength(1)
    expect(choice).toBe('twos')
  })

  it("stops the hero's play as the deck changes step", () => {
    // Arrange
    const deck = mountHero()
    play('Six').click()
    drive(1)

    // Act
    deck.show(2, { scroll: false })

    // Assert
    expect(runs[runs.length - 1].stopped).toBe(true)
  })
})
