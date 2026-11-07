// ============================================================
// Lesson 24 cold open tests — the drone, the note above it, and the slide
// ============================================================
//
// On the page's own markup, with the kit's runs a recorder (WEB-SPEC, Toys
// 1; Tests 1 and 4): at first paint the hero draws the drone's band and the
// top note's line at 224 Hz as a still, nothing glowing; the pair plays
// before a choice and never reveals; the slide waits for a choice, the
// drone and the top note from one start, the top holding, gliding and
// holding; the reveal waits for the slide heard to its end with sound on,
// and shows Step 1's text with it; a play cut short changes nothing; Merc
// and Tavi listen while a play sounds, and Tavi gives one quiet "oh" at the
// reveal; the choice reaches the page, and the tour waits for it; nothing
// said before the choice names a beat, a rate or a stop; with motion on
// the slide draws from its start and the band brightens as it sounds; and
// a step change stops the hero's play.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import type { ColdOpen } from './cold-open'
import { COLD_PREDICT, HERO_SAID, HERO_WINDOW, initColdOpen } from './cold-open'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
const cheers: string[] = []
const listening: [string, boolean][] = []
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuoModule>()),
  mercCelebrate: (which: string) => {
    cheers.push(which)
  },
  mercListen: (which: string, on: boolean) => {
    listening.push([which, on])
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
// reduced motion, as the doubles set it, unless a test draws a line as it
// sounds; the doubles go in first, since the switch reads the setting as it loads
vi.mock('@/features/lessons/kit/motion-switch', async (actual) => {
  await import('@/features/lessons/kit/browser-doubles.test-fixtures')
  return {
    ...(await actual<typeof MotionModule>()),
    reducedMotion: vi.fn(() => true),
  }
})

beforeEach(() => {
  resetRuns()
  cheers.length = 0
  listening.length = 0
  held.length = 0
  soundOn()
  vi.mocked(reducedMotion).mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

const calls = { choice: 0, reveal: 0 }

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mountHero(): StepDeck & { readonly hero: ColdOpen } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  calls.choice = 0
  calls.reveal = 0
  const hero = initColdOpen(deck, {
    onChoice: () => {
      calls.choice += 1
    },
    onReveal: () => {
      calls.reveal += 1
    },
  })
  return Object.assign(deck, { hero })
}

const play = (what: 'pair' | 'slide') =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const choose = (c: 'stops' | 'faster') => {
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
}
const hint = (): string => words(el('#predict .lock-hint'))
const said = (): string => words(el('#heroChart [data-hero-said]'))

/** Plays `what` and ends it as the test says: heard to its end, or cut short. */
async function hear(what: 'pair' | 'slide', heard = true) {
  play(what).click()
  await settle()
  runs[runs.length - 1].end(heard)
  await settle()
}

/** What would tell a reader the predict's answer before its choice. */
const ANSWER = /\bbeat|slow|stop|still|faster/i

describe('at first paint', () => {
  it("draws the drone's band and the top note's line at 224 Hz as a still, nothing glowing, on a 10-second window", () => {
    // Act
    const { hero } = mountHero()

    // Assert
    const scene = hero.chart.scene.drone
    expect(hero.chart.window).toBe(HERO_WINDOW)
    expect([hero.chart.lo, hero.chart.hi]).toEqual([-20, 45])
    expect(scene?.drone).toEqual({ c: 0, as: 'band', label: 'drone · A3' })
    expect(scene?.tops).toHaveLength(1)
    expect(scene?.tops[0].upTo).toBe(HERO_WINDOW)
    const [line] = scene?.tops[0].stretches ?? []
    expect(line.kind === 'level' && line.c).toBeCloseTo(31.2, 1)
    expect(scene?.bright).toBeNull()
  })

  it('holds the slide for a choice, and lets the pair play', () => {
    // Act
    mountHero()

    // Assert
    expect(play('slide').disabled).toBe(true)
    expect(play('pair').disabled).toBe(false)
  })
})

describe('the pair', () => {
  it('plays the drone and 224 Hz together for 3.0 s before a choice, Merc and Tavi listening, and never reveals', async () => {
    // Arrange
    mountHero()

    // Act
    play('pair').click()
    await settle()
    const whileSounding = [...listening]
    runs[0].end(true)
    await settle()

    // Assert
    expect(
      runs[0].lines.map((l) => [l.t, l.points[0].hz, l.points.at(-1)?.t]),
    ).toEqual([
      [0, 220, 3],
      [0, 224, 3],
    ])
    expect(whileSounding).toEqual([
      ['blue', true],
      ['orange', true],
    ])
    expect(listening.slice(-2)).toEqual([
      ['blue', false],
      ['orange', false],
    ])
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(said()).toBe(HERO_SAID.pair)
    expect(said()).not.toMatch(ANSWER)
  })
})

describe('the choice and the slide', () => {
  it('opens the slide on a choice, reaches the page, and lets the tour go', async () => {
    // Arrange
    mountHero()
    const tourWaits = held.length

    // Act
    choose('stops')

    // Assert
    expect(tourWaits).toBe(1)
    await expect(held[0]).resolves.toBe('stops')
    expect(calls.choice).toBe(1)
    expect(play('slide').disabled).toBe(false)
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
  })

  it('slides the top note from 224 Hz to 220 against the drone from one start, then reveals with Step 1\'s text and a quiet "oh"', async () => {
    // Arrange
    mountHero()
    choose('faster')

    // Act
    await hear('slide')

    // Assert
    const [drone, top] = runs[0].lines
    expect([drone.t, drone.points[0].hz, top.t]).toEqual([0, 220, 0])
    expect(top.points.map((p) => [p.t, p.hz])).toEqual([
      [0, 224],
      [1.5, 224],
      [7.5, 220],
      [10, 220],
    ])
    expect(el('#predict .reveal').hidden).toBe(false)
    expect(words(el('#predict .reveal'))).toContain(COLD_PREDICT.guess.faster)
    for (const e of document.querySelectorAll<HTMLElement>('[data-reveal1]'))
      expect(e.hidden).toBe(false)
    expect(calls.reveal).toBe(1)
    expect(cheers).toEqual(['orange'])
    expect(hint()).toBe(COLD_PREDICT.hints.again)
  })

  it('reveals nothing after a slide cut short', async () => {
    // Arrange
    mountHero()
    choose('stops')

    // Act
    await hear('slide', false)

    // Assert
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(calls.reveal).toBe(0)
    expect(cheers).toEqual([])
  })

  it('stops its play on a step change of the deck', () => {
    // Arrange
    const deck = mountHero()
    choose('stops')
    play('slide').click()

    // Act
    deck.show(2)

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})

describe('with motion on', () => {
  beforeEach(() => {
    vi.mocked(reducedMotion).mockReturnValue(false)
  })

  it('draws the slide from its start as it sounds, the band brightening, and keeps what a slide cut short drew', async () => {
    // Arrange
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10_000)
    const { hero } = mountHero()
    choose('stops')

    // Act: the slide cut short 4.5 s in
    play('slide').click()
    const started = hero.chart.scene.drone?.tops[0].upTo
    const glowing = hero.chart.scene.drone?.bright
    clock.mockReturnValue(14_500)
    hero.stop()
    await settle()

    // Assert
    expect(started).toBe(0)
    expect(glowing).not.toBeNull()
    expect(runs[0].stopped).toBe(true)
    expect(hero.chart.scene.drone?.tops[0].upTo).toBeCloseTo(4.5, 6)
    expect(hero.chart.scene.drone?.bright).toBeNull()
  })
})
