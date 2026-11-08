// ============================================================
// Lesson 21 cold open tests — the ring, the keyboard, the three plays and the predict
// ============================================================
//
// On the page's own markup, with the kit's runs a recorder (WEB-SPEC,
// Sections 3 to 5; Toys 3 and 5): at first paint the ring lights D major's
// seven beads, F sharp and C sharp named, with no thread; Play D major
// plays D4 to D5 before a choice and never reveals; the A major plays wait
// for a choice, each A4 to A5 with its own sharp, and draw their small
// staircases, a stair a note; the reveal waits for both heard to their end
// with sound on, and a play cut short changes nothing; Merc and Tavi listen
// while a play sounds, and Tavi gives one quiet "oh" at the reveal; the
// tour waits for the choice; nothing said before the choice names the
// answer; and a step change stops the hero's play.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as FrameLoop from '@/features/lessons/kit/frame-loop'
import type { Drawer } from '@/features/lessons/kit/frame-loop'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import type { ColdOpen } from './cold-open'
import { COLD_PREDICT, HERO_SAID, HERO_SEC, heroScene, initColdOpen, playView, REST_VIEW, } from './cold-open'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
const drawers: Drawer[] = []
vi.mock('@/features/lessons/kit/frame-loop', async (actual) => ({
  ...(await actual<typeof FrameLoop>()),
  addDrawer: (d: Drawer) => {
    drawers.push(d)
  },
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

beforeEach(() => {
  resetRuns()
  drawers.length = 0
  cheers.length = 0
  listening.length = 0
  held.length = 0
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

const chosen: string[] = []

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mountHero(): StepDeck & { readonly hero: ColdOpen } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  chosen.length = 0
  const hero = initColdOpen(deck, { onChoice: (c) => chosen.push(c) })
  return Object.assign(deck, { hero })
}

type Play = 'd-major' | 'with-d-sharp' | 'with-g-sharp'
const play = (what: Play) =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const choose = (c: 'd-sharp' | 'g-sharp') => {
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
}
const hint = (): string => words(el('#predict .lock-hint'))
const reveal = () => el('#predict .reveal')
/** Draws a frame of the hero, as the frame loop would. */
const frame = (): void => {
  for (const d of drawers) d.draw(0, 0.016)
}

/** Plays `what` and ends it as the test says: heard to its end, or cut short. */
async function hear(what: Play, heard = true) {
  play(what).click()
  await settle()
  runs[runs.length - 1].end(heard)
  await settle()
}

describe('the stage at first paint', () => {
  it('lights D major on the ring, F sharp and C sharp named, with no thread', () => {
    // Act
    mountHero()
    frame()

    // Assert: FACTS 33
    expect(document.querySelectorAll('#heroRing .ci-bead')).toHaveLength(12)
    expect(document.querySelectorAll('#heroRing .ci-bead.is-lit')).toHaveLength(
      5,
    )
    expect(document.querySelectorAll('#heroRing .ci-bead.is-key')).toHaveLength(
      2,
    )
    expect(
      Array.from(
        document.querySelectorAll('#heroRing .ci-name'),
        (n) => n.textContent,
      ),
    ).toEqual(['C', 'C♯', 'D', 'E', 'F', 'F♯', 'G', 'A', 'B'])
    expect(document.querySelector('#heroRing .ci-thread')).toBeNull()
  })

  it('asks the frame loop for nothing once drawn, and for every frame while a play sounds', async () => {
    // Arrange
    mountHero()
    frame()
    const atRest = drawers.map((d) => d.wants?.())

    // Act: a frame drawn while it sounds
    play('d-major').click()
    await settle()
    frame()

    // Assert: the page rests while nothing moves (learn-frame-loop.spec.ts)
    expect(atRest).toEqual([false])
    expect(drawers.map((d) => d.wants?.())).toEqual([true])
  })

  it('keeps the A major plays locked until a choice, Play D major free', () => {
    // Act
    mountHero()

    // Assert
    expect(play('d-major').disabled).toBe(false)
    expect(play('with-d-sharp').disabled).toBe(true)
    expect(play('with-g-sharp').disabled).toBe(true)
  })
})

describe('the plays', () => {
  it('plays D major, D4 to D5, at a note every 0.4 s, each 0.35 s long, and reveals nothing', async () => {
    // Arrange
    mountHero()

    // Act
    await hear('d-major')

    // Assert: FACTS 61
    const r = runs[runs.length - 1]
    expect(r.notes.map((n) => n.midi)).toEqual([62, 64, 66, 67, 69, 71, 73, 74])
    expect(r.notes.map((n) => n.t)).toEqual([
      0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8,
    ])
    expect(r.notes.every((n) => n.dur === 0.35)).toBe(true)
    expect(r.o.kind).toBe('soft')
    expect(HERO_SEC).toBeCloseTo(3.15, 6)
    expect(reveal().hidden).toBe(true)
  })

  it('plays A major with D sharp and with G sharp, A4 to A5, once a choice is in', async () => {
    // Arrange
    mountHero()
    choose('d-sharp')

    // Act
    await hear('with-d-sharp')
    const dSharp = runs[runs.length - 1].notes.map((n) => n.midi)
    await hear('with-g-sharp')
    const gSharp = runs[runs.length - 1].notes.map((n) => n.midi)

    // Assert: FACTS 61
    expect(dSharp).toEqual([69, 71, 73, 75, 76, 78, 79, 81])
    expect(gSharp).toEqual([69, 71, 73, 74, 76, 78, 80, 81])
    expect(hint()).toBe(COLD_PREDICT.hints.again)
  })

  it('draws each A major play a small staircase under its own button, a stair a note, its semitones marked', async () => {
    // Arrange
    mountHero()
    choose('g-sharp')

    // Act
    await hear('with-d-sharp')
    frame()
    await hear('with-g-sharp')
    frame()

    // Assert: FACTS 37, tone tone tone semitone tone semitone tone, and Lesson 4's pattern
    const stairs = (w: string) =>
      Array.from(document.querySelectorAll(`[data-mini-stairs="${w}"] rect`))
    const semis = (w: string) =>
      stairs(w).flatMap((s, i) => (s.classList.contains('is-semi') ? [i] : []))
    expect(stairs('with-d-sharp')).toHaveLength(8)
    expect(semis('with-d-sharp')).toEqual([4, 6])
    expect(stairs('with-g-sharp')).toHaveLength(8)
    expect(semis('with-g-sharp')).toEqual([3, 7])
  })

  it('threads each note to the one before on the ring, naming the black keys it plays', () => {
    // Act: A major with D sharp, 1.3 s in
    const mid = heroScene(playView('with-d-sharp', 1.3))
    const end = heroScene(playView('with-d-sharp', HERO_SEC))

    // Assert
    expect(mid.thread).toEqual([9, 11, 1, 3])
    expect(end.thread).toEqual([9, 11, 1, 3, 4, 6, 7, 9])
    expect(
      end.beads.filter((b) => b.look === 'key').map((b) => b.names[0]),
    ).toEqual(['C♯', 'D♯', 'F♯'])
    expect(heroScene(REST_VIEW).thread).toEqual([])
  })

  it('lets Merc and Tavi listen while a play sounds', async () => {
    // Arrange
    mountHero()

    // Act
    await hear('d-major')

    // Assert
    expect(listening).toEqual([
      ['blue', true],
      ['orange', true],
      ['blue', false],
      ['orange', false],
    ])
  })
})

describe('the predict', () => {
  it('waits for both A major plays heard to their end, then shows the reveal with the guess, Tavi saying a quiet "oh"', async () => {
    // Arrange
    mountHero()
    choose('d-sharp')

    // Act
    await hear('with-d-sharp')
    const afterOne = reveal().hidden
    const hintAfterOne = hint()
    await hear('with-g-sharp')

    // Assert: FACTS 36 and 37
    expect(afterOne).toBe(true)
    expect(hintAfterOne).toBe(COLD_PREDICT.hints.chosen)
    expect(reveal().hidden).toBe(false)
    expect(words(reveal())).toContain('You said: D♯')
    expect(cheers).toEqual(['orange'])
  })

  it('reveals nothing for a play cut short', async () => {
    // Arrange
    mountHero()
    choose('g-sharp')

    // Act
    await hear('with-d-sharp', false)
    await hear('with-g-sharp')

    // Assert
    expect(reveal().hidden).toBe(true)
  })

  it('keeps a play cut short at the notes it reached, its staircase short of eight stairs', async () => {
    // Arrange
    mountHero()
    choose('d-sharp')

    // Act
    await hear('with-d-sharp', false)
    frame()

    // Assert
    const stairs = document.querySelectorAll(
      '[data-mini-stairs="with-d-sharp"] rect',
    )
    expect(stairs.length).toBeGreaterThan(0)
    expect(stairs.length).toBeLessThan(8)
  })

  it('tells the page the choice, and holds the welcome tour until it', async () => {
    // Arrange
    mountHero()

    // Act
    choose('g-sharp')

    // Assert: FACTS 1a
    expect(chosen).toEqual(['g-sharp'])
    expect(held).toHaveLength(1)
    await expect(held[0]).resolves.toBe('g-sharp')
  })

  it('says nothing before the choice that names the answer', async () => {
    // Arrange
    mountHero()
    frame()

    // Act: D major, the one play free before the choice
    await hear('d-major')
    frame()

    // Assert: Tests 8, on the ring's words, its label and the hint
    const ring = el('#heroRing')
    const label = el('#heroRing [data-ring-svg]').getAttribute('aria-label')
    const said = `${words(ring)} ${label ?? ''} ${hint()}`
    expect(HERO_SAID['d-major']).not.toMatch(/G♯|G sharp|\bti\b|below do/)
    expect(words(el('#heroRing [data-ring-said]'))).toBe(HERO_SAID['d-major'])
    expect(said).not.toMatch(/G♯|G sharp|\bti\b|below do/)
  })
})

describe('leaving the hero', () => {
  it('stops its play when the deck changes step', async () => {
    // Arrange
    const deck = mountHero()
    play('d-major').click()
    await settle()

    // Act
    deck.show(2)

    // Assert
    expect(runs[runs.length - 1].stopped).toBe(true)
  })
})
