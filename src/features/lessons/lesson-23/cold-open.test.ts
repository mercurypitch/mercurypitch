// ============================================================
// Lesson 23 cold open tests — the octave upright between Merc and Tavi, split two ways
// ============================================================
//
// On the page's own markup, with the kit's runs a recorder (WEB-SPEC, Toys
// 2 and 3): before a choice the line shows its two Cs and the octave's size
// alone, and the two splits are locked; Play C up to C works from the start
// and never reveals; each split names its middle note as it sounds, draws
// the thirteen lanes and counts the two leaps; the reveal waits for both
// splits heard to their end, a play cut short changing nothing; the choice
// reaches the steps' toy and the tour waits for it (FACTS 47); and a step
// change stops the hero's play. Each lit note's return to rest is a timer of
// the hero's own, which a play that ends or stops clears: one left pending
// fired after the file's document had gone ("document is not defined", a
// failed run with every test passed), so each test also stops every cold
// open it mounted.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import type { ColdOpen } from './cold-open'
import { COLD_PREDICT, HERO_SAID, initColdOpen, MIDDLE, OCTAVE_NOTES, splitNotes, } from './cold-open'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
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

beforeEach(() => {
  resetRuns()
  cheers.length = 0
  held.length = 0
  soundOn()
})

afterEach(() => {
  // the test stops what it started, before its timers are real again
  for (const cold of mounted.splice(0)) cold.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

let unlocked = 0

/** Every cold open a test mounted, for its cleanup to stop. */
const mounted: ColdOpen[] = []

/** The timers the hero sets, faked, so a test can count and advance them. */
const fakeTimers = (): void => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
}

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mountHero(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  unlocked = 0
  mounted.push(
    initColdOpen(deck, () => {
      unlocked += 1
    }),
  )
  return deck
}

const play = (what: 'octave' | 'g' | 'fs') =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const choose = (c: 'g' | 'fs') =>
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
const reveal = () => el('#predict .reveal')
const hint = () => words(el('#predict .lock-hint'))
const line = () => el('#heroLine')
const texts = (sel: string): string[] =>
  Array.from(line().querySelectorAll(sel)).map((t) => t.textContent ?? '')
const last = () => runs[runs.length - 1]

/** Plays one of the hero's plays, every note started, to its end, heard. */
async function hear(what: 'octave' | 'g' | 'fs'): Promise<void> {
  play(what).click()
  await settle()
  const r = last()
  r.notes.forEach((_n, i) => r.note(i))
  r.end(true)
  await settle()
}

describe('the cold open', () => {
  it('shows the octave upright, its two Cs named and its size, nothing between them, the splits locked', () => {
    // Act
    mountHero()

    // Assert: WEB-SPEC, Toys 2; FACTS 1a, 40
    expect(texts('.hl-name')).toEqual(['C4', 'C5'])
    expect(texts('.hl-octave')).toEqual(['an octave:', '12 semitones'])
    expect(line().querySelectorAll('.hl-lane')).toHaveLength(2)
    expect(line().querySelectorAll('.hl-count')).toHaveLength(0)
    expect(play('octave').disabled).toBe(false)
    expect(play('g').disabled).toBe(true)
    expect(play('fs').disabled).toBe(true)
    expect(
      line().querySelector('[data-hero-svg]')?.getAttribute('aria-label'),
    ).toBe(
      'The pitch line, upright: C4 at its foot and C5 at its top, an octave of 12 semitones',
    )
  })

  it('plays C up to C before a choice, C4, C5, then both, lighting each end, and draws no lane between', async () => {
    // Arrange
    mountHero()

    // Act
    play('octave').click()
    await settle()
    last().note(0)
    const foot = line().querySelectorAll('.hl-lane.is-lit').length
    last().note(1)
    last().end(true)
    await settle()

    // Assert: FACTS 41, 67, 2.6 s
    expect(last().notes).toEqual(OCTAVE_NOTES)
    expect(foot).toBe(1)
    expect(line().querySelectorAll('.hl-lane')).toHaveLength(2)
    expect(reveal().hidden).toBe(true)
  })

  it('splits at G as G sounds: thirteen lanes, G named, 7 and 5 counted, and the polite line says so', async () => {
    // Arrange
    mountHero()
    choose('g')

    // Act
    play('g').click()
    await settle()
    last().note(0)
    last().note(1)

    // Assert: FACTS 44, 67
    expect(last().notes).toEqual(splitNotes(MIDDLE.g))
    expect(line().querySelectorAll('.hl-lane')).toHaveLength(13)
    expect(texts('.hl-name')).toEqual(['C4', 'C5', 'G4'])
    expect(texts('.hl-count')).toEqual(['7', '5'])
    expect(texts('.hl-octave')).toEqual([])
    expect(words(el('[data-hero-said]'))).toBe(HERO_SAID.g)
  })

  it('splits at F sharp into 6 and 6, the line keeping its lanes and the last split', async () => {
    // Arrange
    mountHero()
    choose('fs')
    await hear('g')

    // Act
    await hear('fs')

    // Assert
    expect(line().querySelectorAll('.hl-lane')).toHaveLength(13)
    expect(texts('.hl-name')).toEqual(['C4', 'C5', 'F♯4'])
    expect(texts('.hl-count')).toEqual(['6', '6'])
    expect(words(el('[data-hero-said]'))).toBe(HERO_SAID.fs)
  })

  it('times a split C4, the middle note and C5, 0.7 s apart, then C4 and the middle note together: 3.3 s', () => {
    // Assert: FACTS 67
    const notes = splitNotes(MIDDLE.fs)
    expect(notes.map((n) => [n.t, n.midi, n.dur])).toEqual([
      [0, 60, 0.6],
      [0.7, 66, 0.6],
      [1.4, 72, 0.6],
      [2.1, 60, 1.2],
      [2.1, 66, 1.2],
    ])
    expect(Math.max(...notes.map((n) => n.t + n.dur))).toBeCloseTo(3.3, 9)
  })
})

describe('the predict', () => {
  it('locks the choice, unlocks the two splits and the steps, and says what to do', () => {
    // Arrange
    mountHero()

    // Act
    choose('g')

    // Assert: WEB-SPEC, Toys 3
    expect(play('g').disabled).toBe(false)
    expect(play('fs').disabled).toBe(false)
    expect(unlocked).toBe(1)
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
  })

  it('reveals once both splits are heard to their end, in either order, and Tavi celebrates', async () => {
    // Arrange
    mountHero()
    choose('g')

    // Act
    await hear('fs')
    const afterOne = reveal().hidden
    await hear('g')

    // Assert
    expect(afterOne).toBe(true)
    expect(reveal().hidden).toBe(false)
    expect(words(reveal())).toContain('You said: G')
    expect(cheers).toEqual(['orange'])
  })

  it('never reveals on Play C up to C, and counts a split cut short by a step change as not heard', async () => {
    // Arrange
    const deck = mountHero()
    choose('fs')
    await hear('octave')
    await hear('g')

    // Act: F sharp starts, and the deck moves on
    play('fs').click()
    await settle()
    deck.show(2)
    await settle()

    // Assert
    expect(last().stopped).toBe(true)
    expect(reveal().hidden).toBe(true)
  })

  it('keeps sound off silent and says so', async () => {
    // Arrange
    mountHero()
    choose('g')
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')

    // Act
    await hear('g')

    // Assert
    expect(hint()).toBe(COLD_PREDICT.hints.silent)
  })

  it("holds a first visit's tour until the choice (FACTS 47)", async () => {
    // Arrange
    mountHero()
    let settled = false
    void held[0].then(() => {
      settled = true
    })
    await settle()
    const before = settled

    // Act
    choose('fs')
    await settle()

    // Assert
    expect(held).toHaveLength(1)
    expect([before, settled]).toEqual([false, true])
  })
})

describe("the hero's timers", () => {
  const litNotes = () => line().querySelectorAll('.hl-lane.is-lit').length

  it('puts each lit note back to rest as its note ends', async () => {
    // Arrange
    fakeTimers()
    mountHero()
    play('octave').click()
    await settle()
    last().note(0)
    const lit = litNotes()

    // Act
    vi.advanceTimersByTime(OCTAVE_NOTES[0].dur * 1000)

    // Assert
    expect([lit, litNotes()]).toEqual([1, 0])
  })

  it('leaves no timer pending once a play has been heard to its end', async () => {
    // Arrange
    fakeTimers()
    mountHero()

    // Act
    await hear('octave')

    // Assert: nothing of the play fires after it, or after the page
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves no timer pending when stopped mid-play, and no note lit', async () => {
    // Arrange
    fakeTimers()
    mountHero()
    play('octave').click()
    await settle()
    last().note(0)
    last().note(1)

    // Act
    mounted[mounted.length - 1].stop()

    // Assert
    expect(last().stopped).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    expect(litNotes()).toBe(0)
  })
})
