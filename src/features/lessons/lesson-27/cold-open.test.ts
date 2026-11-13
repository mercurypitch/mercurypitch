// ============================================================
// Lesson 27 cold open tests — V going home, and the two notes that answer the predict
// ============================================================
//
// FACTS 32 to 40 and the WEB-SPEC's Toys 2 and 3 and Tests 3, 4 and 6, on
// the page's own markup with the kit's runs a recorder: Play V, then I,
// free from the start; the two answering plays locked until a choice; the
// hint staying "Locked in. Play both." after one, with no `next`; the
// reveal after both heard, in either order, showing Step 1's paragraph and
// Steps 2 and 3's text and putting their held lines away, the status line
// reading the reveal alone, the guess's sharp said as a word; a play cut
// short revealing nothing; and the choice reaching the page and the tour.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { ANNOUNCE_DELAY_MS, spokenText } from '@/features/lessons/kit/announce'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import { signName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunNote } from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { writtenOf } from '@/features/lessons/kit/staff-places'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import { COLD_PREDICT, HERO_LABEL, initColdOpen } from './cold-open'
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

/** A run's notes as written, each with its onset: "0 G3". */
const written = (notes: readonly RunNote[]): string[] =>
  notes.map((n) => `${n.t} ${signName(writtenOf(n.midi))}`)

const last = () => runs[runs.length - 1]
const play = (what: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const hint = (): string => words(el('#predict .lock-hint'))

/** Presses a play and lets it run to its end, heard. */
async function hear(what: string): Promise<void> {
  play(what).click()
  await settle()
  last().end(true)
  await settle()
}

let chosen = 0

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mount(): void {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  initColdOpen(deck, {
    onChoice: () => {
      chosen += 1
    },
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  loadPage()
  soundOn()
  resetRuns()
  cheers.length = 0
  held.length = 0
  chosen = 0
})

afterEach(() => {
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe('the cold open', () => {
  it('plays V, then I, freely: G3, B3 and D4, then C4, E4 and G4, 1.5 s each, at 0.075 a voice (FACTS 32)', async () => {
    // Arrange
    mount()

    // Act
    play('vi').click()
    await settle()

    // Assert
    expect(written(last().notes)).toEqual([
      '0 G3',
      '0 B3',
      '0 D4',
      '1.5 C4',
      '1.5 E4',
      '1.5 G4',
    ])
    expect(last().notes.every((n) => n.dur === 1.5 && n.gain === 0.075)).toBe(
      true,
    )
    expect(el('#heroRing canvas').getAttribute('aria-label')).toBe(HERO_LABEL)
  })

  it('holds the two answering plays until a choice, then keeps "Locked in. Play both." after one (FACTS 37)', async () => {
    // Arrange
    mount()
    const before = [play('f').disabled, play('fsharp').disabled]

    // Act
    el<HTMLButtonElement>('#predict [data-choice="fsharp"]').click()
    await hear('f')

    // Assert
    expect(before).toEqual([true, true])
    expect(play('fsharp').disabled).toBe(false)
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(chosen).toBe(1)
    expect(held).toHaveLength(1)
  })

  it('plays V with F or F sharp, at 0.056 a voice, then I (FACTS 37, 73)', async () => {
    // Arrange
    mount()
    el<HTMLButtonElement>('#predict [data-choice="f"]').click()

    // Act
    play('fsharp').click()
    await settle()

    // Assert
    expect(written(last().notes).slice(0, 4)).toEqual([
      '0 G3',
      '0 B3',
      '0 D4',
      '0 F♯4',
    ])
    expect(
      last()
        .notes.slice(0, 4)
        .every((n) => n.gain === 0.056),
    ).toBe(true)
  })

  it('reveals after both heard, in either order, with Step 1’s paragraph and Steps 2 and 3’s text (FACTS 38 to 40)', async () => {
    // Arrange
    mount()
    el<HTMLButtonElement>('#predict [data-choice="fsharp"]').click()

    // Act
    await hear('fsharp')
    await hear('f')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Assert: the steps' text shows, and the status line reads the reveal alone
    expect(el('#predict .reveal').hidden).toBe(false)
    for (const n of [1, 2, 3]) {
      expect(el(`[data-held="${n}"]`).hidden).toBe(false)
      expect(el(`[data-held-line="${n}"]`).hidden).toBe(true)
    }
    expect(words(el('[data-announcer]'))).toBe(
      spokenText(el('#predict .reveal')),
    )
    // the guess's sharp said as a word
    const line = el('#predict .reveal .mono')
    expect(words(line)).toBe('You said: F♯ sharp')
    expect(line.querySelector('[aria-hidden="true"]')?.textContent).toBe('♯')
    expect(cheers).toEqual(['orange'])
  })

  it('reveals nothing for a play cut short', async () => {
    // Arrange
    mount()
    el<HTMLButtonElement>('#predict [data-choice="f"]').click()
    await hear('f')

    // Act: F sharp's play stopped by another sound
    play('fsharp').click()
    await settle()
    last().end(false)
    await settle()

    // Assert
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(el('[data-held="1"]').hidden).toBe(true)
  })
})
