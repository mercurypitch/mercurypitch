// ============================================================
// Lesson 28 cold open tests — a song that sounds as if it ends, then keeps going
// ============================================================
//
// FACTS 33, 40, 43 and 46 and the WEB-SPEC's Toys 1, on the page's own
// markup with the kit's runs a recorder and its score a double: Play the
// song free from the start, the way the song kept going, each bar's two
// boxes lighting as it sounds, never revealing; the choice opening both
// answering plays and telling the page and the tour; each way writing its
// own pair of staffs as it sounds, the ending's above the other's; the
// reveal only after both are heard with sound on, ringing bar 8's note in
// Merc's part on both pairs with their numerals, and Tavi's quiet "oh"; and
// a play cut short revealing nothing and keeping what it drew.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import type { ColdOpen } from './cold-open'
import { COLD_PREDICT, HERO_SAID, initColdOpen, pairScene } from './cold-open'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import type { ScoreDouble } from './score-double.test-fixtures'
import { resetScores, scores } from './score-double.test-fixtures'
import { BAR_SEC, barsOf, bothNotes, GOING } from './song'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
vi.mock(
  '@/features/lessons/kit/score',
  async () => (await import('./score-double.test-fixtures')).scoreDouble,
)
const cheers: string[] = []
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuoModule>()),
  mercCelebrate: (which: string) => {
    cheers.push(which)
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

const lastRun = () => runs[runs.length - 1]
const play = (what: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const hint = (): string => words(el('#predict .lock-hint'))
const choose = (c: 'tavi' | 'merc'): void => {
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
}
/** The pair of staffs a way drew, or undefined. */
const pairOf = (way: string): ScoreDouble | undefined =>
  scores.find((s) => s.figure.dataset.pair === way)
/** The bars whose two boxes are lit. */
const litBars = (): number[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#heroStrip .strip-bars li.is-lit'),
  ).map((b) => Number(b.dataset.bar))

/** Lets the page's promise chains run out. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await settle()
}

/** Presses a way and lets it run to its end, heard: its sound and its staffs' clock. */
async function hear(way: 'ending' | 'going'): Promise<void> {
  play(way).click()
  await flush()
  lastRun().end(true)
  const pair = pairOf(way)
  pair?.clocks[pair.clocks.length - 1]?.end(true)
  await flush()
}

let chosen = 0
let revealed = 0
let deck: StepDeck

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mount(): ColdOpen {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  return initColdOpen(deck, {
    onChoice: () => {
      chosen += 1
    },
    onReveal: () => {
      revealed += 1
    },
  })
}

beforeEach(() => {
  loadPage()
  soundOn()
  resetRuns()
  resetScores()
  cheers.length = 0
  held.length = 0
  chosen = 0
  revealed = 0
})

afterEach(() => {
  // a newer sound stops what the test started
  NowPlaying.claim(() => undefined)
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe('the hero at first paint', () => {
  it('draws the strip of ten empty bars, says so, and holds both ways and the tour (FACTS 40, 46)', () => {
    mount()
    expect(el('[data-hero-strip]').getAttribute('aria-label')).toBe(
      HERO_SAID.rest,
    )
    expect([play('ending').disabled, play('going').disabled]).toEqual([
      true,
      true,
    ])
    expect(el('[data-hero-staffs]').hidden).toBe(true)
    expect(held).toHaveLength(1)
  })
})

describe('Play the song', () => {
  it('plays the way the song kept going, both parts, 33.33 s, free from the start (FACTS 33)', async () => {
    // Arrange
    mount()

    // Act
    play('song').click()
    await flush()

    // Assert
    expect(lastRun().notes).toEqual(bothNotes(GOING))
    const end = Math.max(...lastRun().notes.map((n) => n.t + n.dur))
    expect(end).toBeCloseTo(33.333, 3)
    // bar 8 under it all sounds E3 under G4, never G3
    expect(
      lastRun()
        .notes.filter((n) => Math.abs(n.t - 7 * BAR_SEC) < 1e-6)
        .map((n) => n.midi)
        .sort(),
    ).toEqual([52, 67])
  })

  it("lights each bar's two boxes as it sounds, says what was heard, and never reveals", async () => {
    // Arrange
    mount()
    play('song').click()
    await flush()
    const at = (t: number) =>
      lastRun().notes.findIndex((n) => Math.abs(n.t - t) < 1e-6)

    // Act
    lastRun().note(at(7 * BAR_SEC))
    const lit = litBars()
    lastRun().end(true)
    await flush()

    // Assert
    expect(lit).toEqual([8, 8])
    expect(litBars()).toEqual([])
    expect(words(el('[data-hero-said]'))).toBe(HERO_SAID.song)
    expect(el('[data-hero-strip]').getAttribute('aria-label')).toBe(
      HERO_SAID.song,
    )
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(el('[data-hero-staffs]').hidden).toBe(true)
  })

  it('stops at the choice, which tells the page and the tour, and opens both ways', async () => {
    // Arrange
    mount()
    play('song').click()
    await flush()

    // Act
    choose('merc')
    await flush()

    // Assert
    expect(runs[0]?.stopped).toBe(true)
    expect(chosen).toBe(1)
    await expect(held[0]).resolves.toBe('merc')
    expect([play('ending').disabled, play('going').disabled]).toEqual([
      false,
      false,
    ])
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
  })
})

describe('the two ways', () => {
  it('writes each way on its own pair of staffs as it sounds, the ending above the other (FACTS 43)', async () => {
    // Arrange
    mount()
    choose('tavi')

    // Act: the way it kept going heard first, then the ending
    play('going').click()
    await flush()
    const going = pairOf('going')
    const sound = lastRun().notes
    lastRun().end(true)
    going?.clocks[0]?.end(true)
    await flush()
    await hear('ending')

    // Assert
    expect(sound).toEqual(bothNotes(barsOf(GOING, 7, 8)))
    expect(going?.shown[0]).toEqual({
      scene: pairScene('going', false),
      written: 0,
    })
    expect(going?.clocks[0]?.p).toMatchObject({ write: true })
    expect(going?.clocks[0]?.p.seconds).toBeCloseTo(6.667, 3)
    expect(el('[data-hero-staffs]').hidden).toBe(false)
    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-hero-staffs] [data-pair]',
        ),
      ).map((p) => p.dataset.pair),
    ).toEqual(['ending', 'going'])
    expect(el('[data-hero-strip]').classList.contains('is-open')).toBe(true)
  })

  it('reveals only once both are heard with sound on, ringing bar 8 in Merc\'s part with the numerals, and Tavi says "oh"', async () => {
    // Arrange
    const hero = mount()
    choose('tavi')

    // Act
    await hear('ending')
    const afterOne = [hero.predict.revealed, hint()]
    await hear('going')

    // Assert
    expect(afterOne).toEqual([false, COLD_PREDICT.hints.chosen])
    expect(hero.predict.revealed).toBe(true)
    expect(el('#predict .reveal').hidden).toBe(false)
    expect(el('.held-body[data-held="2"]').hidden).toBe(false)
    expect(revealed).toBe(1)
    expect(cheers).toEqual(['orange'])
    for (const way of ['ending', 'going'] as const)
      expect(pairOf(way)?.last?.scene).toEqual(pairScene(way, true))
    expect(pairScene('going', true).marks).toMatchObject({
      numerals: [
        { bar: 0, text: 'V' },
        { bar: 1, text: 'vi' },
      ],
      rings: [{ staff: 1, note: 2 }],
    })
    expect(words(el('[data-hero-said]'))).toBe(HERO_SAID.going)
  })

  it('reveals nothing for a play cut short, and keeps what its staffs drew', async () => {
    // Arrange
    const hero = mount()
    choose('merc')
    await hear('ending')

    // Act: another sound takes over the going way's play
    play('going').click()
    await flush()
    NowPlaying.claim(() => undefined)
    await flush()

    // Assert
    expect(lastRun().stopped).toBe(true)
    expect(hero.predict.revealed).toBe(false)
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(pairOf('going')?.shown).toHaveLength(1)
    expect(el('[data-hero-staffs] [data-pair="going"]')).not.toBeNull()
  })

  it('stops its play at a step change of the deck', async () => {
    // Arrange
    mount()
    choose('merc')
    play('ending').click()
    await flush()

    // Act
    deck.show(2)
    await flush()

    // Assert
    expect(lastRun().stopped).toBe(true)
  })
})
