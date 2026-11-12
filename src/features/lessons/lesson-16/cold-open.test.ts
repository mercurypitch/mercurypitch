// ============================================================
// Lesson 16 cold open tests — the staff of five plain notes, Tavi's two tries and the predict
// ============================================================
//
// On the page's own markup, with the kit's runs a recorder (WEB-SPEC,
// Toys 1; FACTS 32, 33, 35, 66): at first paint the treble staff shows
// five plain notes and nothing lit; both tries wait for a choice, and the
// tour waits for it too; with no note first Tavi sings F, G, A, G, F, each
// orange note drawn one place under its written note as it sounds; with
// one note first G4 sounds in the soft tone, lighting the first written
// note, and her notes land on the written ones; only the note sounding
// keeps its halo; the reveal waits for both tries heard to their end, and
// a try cut short changes nothing; Merc listens and Tavi sings while she
// sings, and Tavi gives one quiet "oh" at the reveal; and a step change
// stops a try, keeping what it drew.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as FrameLoop from '@/features/lessons/kit/frame-loop'
import type { Drawer } from '@/features/lessons/kit/frame-loop'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import { hz } from '@/features/lessons/kit/notes'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { contourLength } from '@/features/lessons/kit/sound'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import type { ColdOpen, Try } from './cold-open'
import { COLD_PREDICT, heroMarks, initColdOpen, REST_VIEW, SUNG, TRY_SAID, TRY_SEC, } from './cold-open'
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
const singing: [string, number, boolean][] = []
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuoModule>()),
  mercCelebrate: (which: string) => {
    cheers.push(which)
  },
  mercListen: (which: string, on: boolean) => {
    listening.push([which, on])
  },
  mercSing: (which: string, midi: number, on: boolean) => {
    singing.push([which, midi, on])
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
  singing.length = 0
  held.length = 0
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mountHero(): StepDeck & { readonly hero: ColdOpen } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  const hero = initColdOpen(deck)
  return Object.assign(deck, { hero })
}

const play = (what: Try) =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const choose = (c: 'jumble' | 'tune') => {
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
}
const hint = (): string => words(el('#predict .lock-hint'))
const reveal = () => el('#predict .reveal')
const said = (): string => words(el('[data-hero-said]'))
/** Draws a frame of the hero, as the frame loop would. */
const frame = (): void => {
  for (const d of drawers) d.draw(0, 0.016)
}
const count = (selector: string): number =>
  document.querySelectorAll(`#heroStaff ${selector}`).length
/** The runs one try asked for: the note first, if any, and Tavi's line. */
const tryRuns = (): RecordedRun[] => runs.slice(-2)

/** Plays `what` and ends it as the test says: heard to its end, or cut short. */
async function hear(what: Try, heard = true): Promise<void> {
  play(what).click()
  await settle()
  for (const r of runs) if (!r.over) r.end(heard)
  await settle()
}

describe('the stage at first paint', () => {
  it('draws a treble staff with five plain notes: no names, no house, nothing lit', () => {
    // Act
    mountHero()
    frame()

    // Assert: FACTS 32
    expect(count('.st-clef')).toBe(1)
    expect(count('.st-head')).toBe(5)
    expect(count('.st-head.is-lit, .st-head.is-orange')).toBe(0)
    expect(count('.st-home, .st-name, .st-syl, .st-halo')).toBe(0)
    expect(el('[data-hero-staff]').getAttribute('aria-label')).toBe(
      'Treble staff with five notes: G, A, B, A, G',
    )
    expect(said()).toBe('')
  })

  it('writes G, A, B, A, G, and draws each of Tavi’s notes where she sang it', () => {
    // Act
    const rest = heroMarks(REST_VIEW)
    const alone = heroMarks({ ...REST_VIEW, what: 'alone', sung: 5 })
    const note = heroMarks({ ...REST_VIEW, what: 'note', sung: 5 })

    // Assert: one place under each written note, just to its right; then on them
    expect(rest.map((m) => midiOf(m.note))).toEqual([67, 69, 71, 69, 67])
    expect(alone.slice(5).map((m) => [midiOf(m.note), m.col, m.tone])).toEqual([
      [65, 0.3, 'orange'],
      [67, 1.3, 'orange'],
      [69, 2.3, 'orange'],
      [67, 3.3, 'orange'],
      [65, 4.3, 'orange'],
    ])
    expect(note.slice(5).map((m) => [midiOf(m.note), m.col])).toEqual([
      [67, 0],
      [69, 1],
      [71, 2],
      [69, 3],
      [67, 4],
    ])
  })
})

describe('the two tries', () => {
  it('waits for a choice, and holds the welcome tour until it', async () => {
    // Arrange
    mountHero()
    const before = [play('alone').disabled, play('note').disabled]

    // Act
    choose('tune')

    // Assert: FACTS 35
    expect(before).toEqual([true, true])
    expect([play('alone').disabled, play('note').disabled]).toEqual([
      false,
      false,
    ])
    expect(held).toHaveLength(1)
    await expect(held[0]).resolves.toBe('tune')
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
  })

  it('sings F, G, A, G, F with no note first, 3.0 s, an orange note drawn as each sounds', async () => {
    // Arrange
    vi.useFakeTimers()
    mountHero()
    choose('jumble')

    // Act
    play('alone').click()
    const [line] = runs
    vi.advanceTimersByTime(1)
    frame()
    const first = count('.st-head.is-orange')
    vi.advanceTimersByTime(600)
    frame()
    const second = count('.st-head.is-orange')
    const halos = count('.st-halo')
    line.end(true)
    await settle()
    frame()

    // Assert: FACTS 33 and 66, Tavi's line one voice in Merc's "ooh"
    expect(runs).toHaveLength(1)
    expect(line.kind).toBe('lines')
    expect(line.o.kind).toBe('merc')
    expect(line.lines[0].t).toBe(0)
    const points = line.lines[0].points
    expect(contourLength(points)).toBeCloseTo(TRY_SEC.alone, 9)
    expect(TRY_SEC.alone).toBeCloseTo(3, 9)
    expect(
      [0, 0.6, 1.2, 1.8, 2.4].map(
        (t) => points.find((p) => Math.abs(p.t - t) < 1e-9)?.hz,
      ),
    ).toEqual(SUNG.alone.map((n) => hz(midiOf(n))))
    expect([first, second]).toEqual([1, 2])
    expect(halos).toBe(1)
    expect(count('.st-head.is-orange')).toBe(5)
    expect(count('.st-halo')).toBe(0)
    expect(said()).toBe(TRY_SAID.alone)
  })

  it('plays G4 first in the soft tone, lighting the first written note, then sings on the written notes, 4.4 s', async () => {
    // Arrange
    vi.useFakeTimers()
    mountHero()
    choose('tune')

    // Act
    play('note').click()
    const [start, line] = tryRuns()
    vi.advanceTimersByTime(1)
    frame()
    const lit = count('.st-head.is-lit')
    vi.advanceTimersByTime(1000)
    frame()
    const after = [count('.st-head.is-lit'), count('.st-head.is-orange')]
    vi.advanceTimersByTime(400)
    frame()
    const landed = count('.st-head.is-orange')
    start.end(true)
    line.end(true)
    await settle()

    // Assert: FACTS 66
    expect(start.kind).toBe('notes')
    expect(start.o.kind).toBe('soft')
    expect(start.notes.map((n) => [n.t, n.midi, n.dur])).toEqual([[0, 67, 1]])
    expect(line.lines[0].t).toBeCloseTo(1.4, 9)
    expect(line.lines[0].t + contourLength(line.lines[0].points)).toBeCloseTo(
      TRY_SEC.note,
      9,
    )
    expect(TRY_SEC.note).toBeCloseTo(4.4, 9)
    expect(lit).toBe(1)
    expect(after).toEqual([0, 0])
    expect(landed).toBe(1)
    expect(said()).toBe(TRY_SAID.note)
  })

  it('reveals only once both tries are heard to their end, and a try cut short changes nothing', async () => {
    // Arrange
    mountHero()
    choose('jumble')

    // Act
    await hear('alone')
    const afterOne = reveal().hidden
    await hear('note', false)
    const afterCut = reveal().hidden
    await hear('note')

    // Assert: FACTS 35, `revealAfter: 'all'`
    expect(afterOne).toBe(true)
    expect(afterCut).toBe(true)
    expect(reveal().hidden).toBe(false)
    expect(words(reveal())).toContain(COLD_PREDICT.guess.jumble)
    expect(hint()).toBe(COLD_PREDICT.hints.again)
    expect(cheers).toEqual(['orange'])
  })

  it('has Merc listen and Tavi sing while she sings, both at rest after', async () => {
    // Arrange
    vi.useFakeTimers()
    mountHero()
    choose('tune')

    // Act
    play('alone').click()
    vi.advanceTimersByTime(3000)
    for (const r of runs) r.end(true)
    await settle()

    // Assert: WEB-SPEC, Merc and Tavi
    expect(listening).toEqual([
      ['blue', true],
      ['blue', false],
    ])
    expect(singing.filter(([, , on]) => on).map(([w, m]) => [w, m])).toEqual(
      SUNG.alone.map((n) => ['orange', midiOf(n)]),
    )
    expect(singing[singing.length - 1]).toEqual(['orange', 65, false])
  })

  it('stops a try on a step change, keeping the notes it drew, and starts the next afresh', async () => {
    // Arrange
    vi.useFakeTimers()
    const deck = mountHero()
    choose('tune')
    play('alone').click()
    const line = runs[0]
    vi.advanceTimersByTime(700)

    // Act
    deck.show(2)
    await settle()
    vi.advanceTimersByTime(3000)
    frame()
    const kept = [count('.st-head.is-orange'), count('.st-halo')]
    const quiet = said()
    play('note').click()
    frame()

    // Assert: WEB-SPEC, Audio, the sound rules
    expect(line.stopped).toBe(true)
    expect(kept).toEqual([2, 0])
    expect(quiet).toBe('')
    expect(count('.st-head.is-orange')).toBe(0)
  })
})
