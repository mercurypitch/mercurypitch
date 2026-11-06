// ============================================================
// Lesson 22 cold open tests — Merc's wave across the band, and which straight note matches it
// ============================================================
//
// On the page's own markup, with the kit's runs a recorder (WEB-SPEC, Toys
// 1; Tests 4 and 6): at first paint the hero draws Merc's wave as a still,
// with no middle; neither straight note plays before a choice, and Play
// Merc's note works before it and never reveals; each answering play is
// the wave, 0.3 s of quiet, then its straight note, with no vibrato; the
// reveal waits for both straight notes heard to their end with sound on, a
// play cut short changing nothing; there is no `next` hint; at the reveal
// Tavi celebrates once and the middle line draws through the wave, over
// 0.6 s with motion on, and stays; with motion on the still lies whole and
// a play draws from its start, one cut short keeping what it drew; the
// choice reaches the steps, and the tour waits for it; nothing the hero
// says before the choice names a note or a middle; and a step change stops
// the hero's play.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import type { ColdOpen } from './cold-open'
import { COLD_PREDICT, HERO_SAID, initColdOpen } from './cold-open'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { A3 } from './sounds'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
const cheers: string[] = []
const singing: [string, boolean][] = []
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuoModule>()),
  mercCelebrate: (which: string) => {
    cheers.push(which)
  },
  mercSing: (which: string, _midi: number, on: boolean) => {
    singing.push([which, on])
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
  singing.length = 0
  held.length = 0
  soundOn()
  vi.mocked(reducedMotion).mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

let unlocked = 0

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mountHero(): StepDeck & { readonly hero: ColdOpen } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  unlocked = 0
  const hero = initColdOpen(deck, () => {
    unlocked += 1
  })
  return Object.assign(deck, { hero })
}

const play = (what: 'wave' | 'top' | 'middle') =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const choose = (c: 'top' | 'middle') => {
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
}
const hint = (): string => words(el('#predict .lock-hint'))
const said = (): string => words(el('#heroChart [data-hero-said]'))

/** Plays `what` and ends it as the test says: heard to its end, or cut short. */
async function hear(what: 'wave' | 'top' | 'middle', heard = true) {
  play(what).click()
  await settle()
  runs[runs.length - 1].end(heard)
  await settle()
}

describe('at first paint', () => {
  it("draws Merc's wave across the band as a still, whole, with no middle", () => {
    // Act
    const { hero } = mountHero()

    // Assert: the cold open's wave, six swings a second at ±50 cents, 3.0 s of the 4.5 s window
    expect(hero.chart.window).toBe(4.5)
    expect(hero.chart.scene.wave).toEqual({
      stretches: [
        {
          kind: 'wave',
          from: 0,
          to: 3,
          rate: 6,
          extent: 50,
          growIn: 0.3,
          drift: 0,
        },
      ],
      upTo: 3,
    })
    expect(hero.chart.scene.middle).toBeNull()
    expect(el('#heroChart canvas').getAttribute('aria-label')).toBe(
      'A band 35 cents either side of a held note, with no note named',
    )
  })

  it('holds both straight notes, and keeps the lock hint', () => {
    // Arrange
    mountHero()

    // Act
    play('top').click()
    play('middle').click()

    // Assert
    expect(play('top').disabled).toBe(true)
    expect(play('middle').disabled).toBe(true)
    expect(runs).toHaveLength(0)
    expect(hint()).toBe('Choose an answer to unlock the two straight notes.')
  })
})

describe("Play Merc's note", () => {
  it('sings the wave on A3 for 3.0 s before a choice, Merc singing and Tavi listening, and reveals nothing', async () => {
    // Arrange
    mountHero()

    // Act
    play('wave').click()
    await settle()
    const sang = [...singing]
    runs[0].end(true)
    await settle()

    // Assert
    expect(runs[0].kind).toBe('line')
    expect(runs[0].o.vibrato).toEqual({ rate: 6, extent: 50, growIn: 0.3 })
    expect(runs[0].points.map((p) => [p.t, p.hz])).toEqual([
      [0, hz(A3)],
      [3, hz(A3)],
    ])
    expect(sang).toEqual([['blue', true]])
    expect(singing.at(-1)).toEqual(['blue', false])
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(hint()).toBe('Choose an answer to unlock the two straight notes.')
  })

  it('says only that the line swings past both edges: no note, no middle', () => {
    // Arrange
    mountHero()

    // Act
    play('wave').click()

    // Assert
    expect(said()).toBe(HERO_SAID.wave)
    expect(said()).not.toMatch(/middle|centre|straight|top|A3|cents/i)
  })
})

describe('the choice', () => {
  it('unlocks both straight notes, reaches the steps once, and lets the tour go', async () => {
    // Arrange
    mountHero()
    let released = false
    void held[0]?.then(() => {
      released = true
    })

    // Act
    choose('top')
    await settle()

    // Assert
    expect(play('top').disabled).toBe(false)
    expect(play('middle').disabled).toBe(false)
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
    expect(unlocked).toBe(1)
    expect(held).toHaveLength(1)
    expect(released).toBe(true)
  })
})

describe('the answering plays', () => {
  it('play the wave for 2.0 s, then, 0.3 s after, the straight note with no vibrato: the top 226.45 Hz, the middle A3', async () => {
    // Arrange
    mountHero()
    choose('middle')

    // Act
    await hear('top')
    await hear('middle')

    // Assert
    const [top, middle] = runs
    expect(top.kind).toBe('lines')
    expect(top.lines.map((l) => [l.t, l.vibrato])).toEqual([
      [0, { rate: 6, extent: 50, growIn: 0.3 }],
      [2.3, null],
    ])
    expect(top.lines[1].points[0].hz).toBeCloseTo(226.45, 2)
    expect(middle.lines[1].points[0].hz).toBeCloseTo(hz(A3), 9)
  })

  it("draws the straight note's level line at its height after the wave, the whole line at once under reduced motion", () => {
    // Arrange
    const { hero } = mountHero()
    choose('top')

    // Act
    play('top').click()

    // Assert: 50 cents up, 15 above the band's top edge
    expect(hero.chart.scene.wave?.stretches.at(-1)).toEqual({
      kind: 'level',
      from: 2.3,
      to: 4.3,
      c: 50,
    })
    expect(hero.chart.scene.wave?.upTo).toBe(4.3)
    expect(said()).toBe(HERO_SAID.top)
  })
})

describe('the reveal', () => {
  it('waits for both straight notes heard to their end, a play cut short changing nothing', async () => {
    // Arrange
    mountHero()
    choose('top')

    // Act
    await hear('top')
    const afterOne = el('#predict .reveal').hidden
    const hintAfterOne = hint()
    await hear('middle', false)
    const afterCut = el('#predict .reveal').hidden
    await hear('middle')

    // Assert
    expect(afterOne).toBe(true)
    expect(hintAfterOne).toBe(COLD_PREDICT.hints.chosen)
    expect(afterCut).toBe(true)
    expect(el('#predict .reveal').hidden).toBe(false)
    expect(words(el('#predict .reveal .mono'))).toBe('You said: the top')
    expect(hint()).toBe(COLD_PREDICT.hints.again)
  })

  it('waits for a straight note sound off kept silent, with the silent hint', async () => {
    // Arrange
    mountHero()
    choose('middle')
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')

    // Act
    await hear('top')
    await hear('middle')

    // Assert
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(hint()).toBe(COLD_PREDICT.hints.silent)
  })

  it('has Tavi celebrate once, draws the middle through the wave, and keeps it for later plays', async () => {
    // Arrange
    const { hero } = mountHero()
    choose('middle')

    // Act
    await hear('top')
    await hear('middle')
    const middle = hero.chart.scene.middle
    play('wave').click()

    // Assert: under reduced motion the line appears at once
    expect(cheers).toEqual(['orange'])
    expect(middle).toEqual({
      points: [
        { t: 0, c: 0 },
        { t: 2, c: 0 },
      ],
      tone: 'merc',
      share: 1,
    })
    expect(hero.chart.scene.middle?.points.at(-1)).toEqual({ t: 3, c: 0 })
    expect(said()).toBe(HERO_SAID.wave)
  })

  it('says, as it shows, that the dashed line marks the middle', async () => {
    // Arrange
    mountHero()
    choose('top')

    // Act
    await hear('middle')
    await hear('top')

    // Assert
    expect(said()).toBe(HERO_SAID.reveal)
  })
})

describe('with motion on', () => {
  beforeEach(() => {
    vi.mocked(reducedMotion).mockReturnValue(false)
  })

  it("lays the wave down whole at first paint, draws Merc's note from its start as it sounds, and keeps what a play cut short drew", async () => {
    // Arrange
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10_000)
    const { hero } = mountHero()
    const still = hero.chart.scene.wave?.upTo

    // Act: the play cut short 1.2 s in
    play('wave').click()
    const started = hero.chart.scene.wave?.upTo
    clock.mockReturnValue(11_200)
    hero.stop()
    await settle()

    // Assert
    expect(still).toBe(3)
    expect(started).toBe(0)
    expect(runs[0].stopped).toBe(true)
    expect(hero.chart.scene.wave?.upTo).toBeCloseTo(1.2, 6)
  })

  it('draws the middle in over 0.6 s from the reveal, then keeps it whole', async () => {
    // Arrange: both straight notes heard, the reveal at 20 s; with motion
    // on the reveal slides in, through an API the test's DOM lacks
    const clock = vi.spyOn(performance, 'now').mockReturnValue(20_000)
    const { hero } = mountHero()
    const slid = vi.fn()
    Object.assign(el('#predict .reveal'), { animate: slid })
    choose('top')
    await hear('top')
    await hear('middle')
    const atReveal = hero.chart.scene.middle

    // Act: Merc's note 0.3 s after the reveal, then again 0.9 s after it
    clock.mockReturnValue(20_300)
    await hear('wave')
    const half = hero.chart.scene.middle?.share
    clock.mockReturnValue(20_900)
    await hear('wave')

    // Assert
    expect(slid).toHaveBeenCalledTimes(1)
    expect(atReveal).toBeNull()
    expect(half).toBeCloseTo(0.5, 6)
    expect(hero.chart.scene.middle?.share).toBe(1)
  })
})

describe('leaving the hero', () => {
  it('stops its play at a step change, and the line keeps what it drew', async () => {
    // Arrange
    const deck = mountHero()
    play('wave').click()

    // Act
    deck.show(2)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(deck.hero.chart.scene.wave).not.toBeNull()
  })
})
