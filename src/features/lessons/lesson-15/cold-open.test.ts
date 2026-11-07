// ============================================================
// Lesson 15 cold open tests — the pitch line, the fold, and the predict it answers
// ============================================================
//
// On the page's own markup: before a choice the hero draws the pitch line
// alone, with no line, clef or letter that would count the places (FACTS
// 1a); Play the climb plays E4 to F5 and lights each lane as it sounds,
// revealing nothing; Play it on the five lines waits for a choice, folds
// the pitch line into a staff and plays the climb on it, and the reveal
// waits for that climb heard to its end with sound on. A play cut short
// changes nothing, and the welcome tour waits for the choice. Each lit
// lane's return to rest is a timer of the hero's own, which a run that ends
// or stops clears: one left pending fired after the file's document had
// gone ("document is not defined", a failed run with every test passed), so
// each test also stops every cold open it mounted.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { ColdOpen } from './cold-open'
import { CLIMB_NOTES, COLD_PREDICT, HERO_SAID, initColdOpen, LINES_NOTES, } from './cold-open'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const tour = vi.hoisted(() => ({ held: [] as Promise<unknown>[] }))
vi.mock('@/features/lessons/kit/tour-gate', () => ({
  holdTour: (until: Promise<unknown>) => {
    tour.held.push(until)
    return true
  },
}))

// reduced by default, so the reveal lands at once (jsdom has no animate)
const motion = vi.hoisted(() => ({ reduced: true }))
vi.mock('@/features/lessons/kit/motion-switch', async (actual) => ({
  ...(await actual<typeof MotionModule>()),
  reducedMotion: () => motion.reduced,
}))

const deck = { subscribe: () => () => undefined }

/** Every cold open the test mounted, for its cleanup to stop. */
const mounted: ColdOpen[] = []

/** Mounts the cold open on the page's hero, as the page does. */
function mount(): ColdOpen {
  const cold = initColdOpen(deck)
  mounted.push(cold)
  return cold
}

/** The timers the hero sets, faked, so a test can count and advance them. */
const fakeTimers = (): void => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
}

beforeEach(() => {
  loadPage()
  resetRuns()
  soundOn()
  tour.held.length = 0
  motion.reduced = true
})

afterEach(() => {
  // the test stops what it started, before its timers are real again
  for (const cold of mounted.splice(0)) cold.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const hero = (): SVGSVGElement =>
  el<SVGSVGElement>('#heroStaff [data-hero-svg]')
const count = (sel: string): number => hero().querySelectorAll(sel).length
const climb = (): HTMLButtonElement =>
  el<HTMLButtonElement>('[data-play="climb"]')
const lines = (): HTMLButtonElement =>
  el<HTMLButtonElement>('[data-play="lines"]')
const choose = (c: string): void =>
  el<HTMLButtonElement>(`[data-choice="${c}"]`).click()
const reveal = (): HTMLElement => el('#predict .reveal')

/** Plays every note of the run `i` and ends it heard. */
async function hearAll(i: number): Promise<void> {
  runs[i].notes.forEach((_, k) => runs[i].note(k))
  runs[i].end(true)
  await settle()
  await settle()
}

describe('the hero before a choice', () => {
  it('draws the pitch line alone, D4 to G5, with nothing that counts the places', () => {
    // Act
    mount()

    // Assert: FACTS 1a, 33
    expect(count('.st-lane')).toBe(18)
    expect(count('.st-lane.is-black')).toBe(7)
    expect(count('.st-line, .st-clef, .st-ledger, text')).toBe(0)
    expect(hero().getAttribute('aria-label')).toBe(
      'The pitch line: a lane for every semitone from D4 to G5',
    )
    expect(lines().disabled).toBe(true)
  })

  it('plays the climb, E4 up to F5, each lane lit only while its note sounds, and reveals nothing', async () => {
    // Arrange
    mount()

    // Act
    climb().click()
    await settle()
    const before = count('.st-lane.is-lit')
    runs[0].note(0)
    const first = count('.st-lane.is-lit')
    await hearAll(0)

    // Assert: FACTS 34, 62
    expect(runs[0].notes.map((n) => n.midi)).toEqual([
      64, 65, 67, 69, 71, 72, 74, 76, 77,
    ])
    expect(runs[0].notes.map((n) => n.t)).toEqual(CLIMB_NOTES.map((n) => n.t))
    expect([before, first]).toEqual([0, 1])
    expect(words(el('#heroStaff [data-hero-said]'))).toBe(HERO_SAID.climb)
    expect(reveal().hidden).toBe(true)
    expect(count('.st-line')).toBe(0)
  })
})

describe('the climb on the pitch line, after a choice', () => {
  it('reveals nothing, heard to its end with sound on: only the five lines answer', async () => {
    // Arrange
    mount()
    choose('nine')

    // Act
    climb().click()
    await settle()
    await hearAll(0)

    // Assert: WEB-SPEC, Tests 5
    expect(reveal().hidden).toBe(true)
    expect(words(el('#predict .lock-hint'))).toBe(COLD_PREDICT.hints.chosen)
  })
})

describe('the climb on the five lines', () => {
  it('waits for a choice, then folds the pitch line into a staff as its first note sounds', async () => {
    // Arrange
    motion.reduced = false
    mount()
    choose('five')

    // Act
    lines().click()
    await settle()
    const during = count('.st-line')
    runs[0].note(0)

    // Assert: the fold, then the climb, 6.1 s (FACTS 62)
    expect(lines().disabled).toBe(false)
    expect(runs[0].notes.map((n) => n.t)).toEqual(LINES_NOTES.map((n) => n.t))
    expect(LINES_NOTES[0].t).toBe(0.8)
    expect(during).toBe(0)
    expect(count('.st-line')).toBe(5)
    expect(count('.st-clef')).toBe(1)
    expect(count('.st-head.is-lit')).toBe(1)
    expect(hero().getAttribute('aria-label')).toBe(
      'The treble staff, with the pitch line beside it',
    )
  })

  it('reveals once heard to its end with sound on, with the guess in its own words', async () => {
    // Arrange
    mount()
    choose('nine')
    lines().click()
    await settle()

    // Act
    await hearAll(0)

    // Assert
    expect(reveal().hidden).toBe(false)
    expect(words(reveal().querySelector('.mono'))).toBe(COLD_PREDICT.guess.nine)
    // the staff stays, its nine notes at rest in their columns
    expect(count('.st-line')).toBe(5)
    expect(count('.st-head')).toBe(9)
    expect(count('.st-head.is-lit')).toBe(0)
  })

  it('reveals nothing when another sound cuts it short, and keeps the staff drawn', async () => {
    // Arrange
    const cold = mount()
    choose('five')
    lines().click()
    await settle()

    // Act: a newer sound anywhere on the page
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(reveal().hidden).toBe(true)
    expect(cold.folded).toBe(true)
  })

  it('plays the climb on the staff, the pitch line beside it, once folded', async () => {
    // Arrange
    mount()
    choose('five')
    lines().click()
    await settle()
    await hearAll(0)

    // Act
    climb().click()
    await settle()
    runs[1].note(2)

    // Assert: no second fold, the lane and the place lit together
    expect(runs[1].notes[0].t).toBe(0)
    expect(count('.st-lane.is-lit')).toBe(1)
    expect(count('.st-connector')).toBe(1)
  })

  it('folds the pitch line itself with motion on, the staff drawn as the fold ends', async () => {
    // Arrange
    motion.reduced = false
    mount()
    choose('five')

    // Act
    lines().click()
    await settle()

    // Assert: the lanes, no cross-fade
    expect(count('.st-lane')).toBe(18)
    expect(hero().querySelector('.hero-fade')).toBeNull()
  })

  it('cross-fades the pitch line and the staff with motion reduced', async () => {
    // Arrange
    mount()
    choose('five')

    // Act
    lines().click()
    await settle()

    // Assert: both drawn during the fold, the staff fading in
    expect(count('.st-lanes')).toBe(1)
    expect(hero().querySelector('.hero-fade')).not.toBeNull()
  })
})

describe("the hero's timers", () => {
  it('puts each lane back to rest as its note ends', async () => {
    // Arrange
    fakeTimers()
    mount()
    climb().click()
    await settle()
    runs[0].note(0)
    const lit = count('.st-lane.is-lit')

    // Act
    vi.advanceTimersByTime(CLIMB_NOTES[0].dur * 1000)

    // Assert
    expect([lit, count('.st-lane.is-lit')]).toEqual([1, 0])
  })

  it('leaves no timer pending once the climb has been heard to its end', async () => {
    // Arrange
    fakeTimers()
    mount()
    climb().click()
    await settle()

    // Act
    await hearAll(0)

    // Assert: nothing of the run fires after it, or after the page
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves no timer pending when stopped mid-climb, and no lane lit', async () => {
    // Arrange
    fakeTimers()
    const cold = mount()
    climb().click()
    await settle()
    runs[0].note(0)
    runs[0].note(1)

    // Act
    cold.stop()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    expect(count('.st-lane.is-lit')).toBe(0)
  })
})

describe('the welcome tour', () => {
  it('waits for the choice', async () => {
    // Arrange
    mount()
    let settled = false
    void tour.held[0]?.then(() => {
      settled = true
    })
    await settle()
    const before = settled

    // Act
    choose('nine')
    await settle()

    // Assert
    expect(tour.held).toHaveLength(1)
    expect([before, settled]).toEqual([false, true])
  })
})
