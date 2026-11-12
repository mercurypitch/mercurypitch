// ============================================================
// Lesson 20 cold open tests — Merc's run fast and slowly, then the predict
// ============================================================
//
// On the page's own markup, its runs the kit's recorder (WEB-SPEC, Toys 2
// and 3): the hero draws Merc's run on D3 for everyone, its beads faint
// until their notes sound; Play the run fast and Play it slowly sing it at
// 0.2 and 0.6 s a note, redrawn for the tempo, each bead glowing as its
// note sounds, Merc and Tavi listening; with sound off the beads still
// light and the hint says nothing played; either play stops the other,
// and a step change ends it. The predict is a research predict: the choice
// hides the lock hint, locks both choices and shows the reveal, the
// keyboard's place on it and the status line speaking it, and on a first
// visit the tour waits for it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { ANNOUNCE_DELAY_MS } from '@/features/lessons/kit/announce'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import { hz } from '@/features/lessons/kit/notes'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { heroSaid, initColdOpen, SILENT_HINT } from './cold-open'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
const listening: [string, boolean][] = []
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuoModule>()),
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
  listening.length = 0
  held.length = 0
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  VoiceChoice.set('lower')
  window.location.hash = ''
  document.body.textContent = ''
})

function mountHero() {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: (step) => (step <= 2 ? 1 : 2),
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  const open = initColdOpen(deck)
  return { deck, open }
}

const button = (play: string) =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${play}"]`)
const lit = (play: string) => button(play).classList.contains('is-on')
const choose = (c: string) =>
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
const D3 = 50

describe('the hero', () => {
  it("draws Merc's run on D3 for everyone, nine faint beads named only by their syllables", () => {
    // Arrange
    VoiceChoice.set('higher')

    // Act
    const { open } = mountHero()

    // Assert: FACTS 8 and 11
    const rungs = open.chart.chart.scene.rungs ?? []
    expect(open.chart.doMidi).toBe(D3)
    expect(rungs.map((r) => r.label)).toEqual([
      'do',
      're',
      'mi',
      'so',
      'la',
      'so',
      'mi',
      're',
      'do',
    ])
    expect(rungs.every((r) => r.faint === true && r.glow === 0)).toBe(true)
  })

  it("plays the run fast: Merc's run at 0.2 s a note, 1.80 s, redrawn for that tempo, each bead glowing as its note sounds", async () => {
    // Arrange
    const { open } = mountHero()
    const glow = vi.spyOn(open.chart, 'glow')

    // Act
    button('fast').click()
    const during = lit('fast')
    const [line, beads] = runs
    beads.note(0)
    beads.note(4)
    line.end(true)
    beads.end(true)
    await settle()

    // Assert: FACTS 12 and 38
    expect(line.kind).toBe('line')
    expect(line.o).toMatchObject({ audible: true, kind: 'merc' })
    expect(line.points[0].hz).toBeCloseTo(hz(D3), 9)
    expect(line.points[line.points.length - 1].t).toBeCloseTo(1.8, 9)
    expect(beads.o.audible).toBe(false)
    expect(beads.notes.map((n) => n.t)).toEqual([
      0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6,
    ])
    expect(open.chart.every).toBe(0.2)
    expect(glow.mock.calls.map(([i]) => i)).toEqual([0, 4])
    expect(words(el('[data-hero-said]'))).toBe(heroSaid(0.2))
    expect(heroSaid(0.2)).toBe("Merc's run, 0.2 seconds a note.")
    expect([during, lit('fast')]).toEqual([true, false])
    expect(listening).toEqual([
      ['blue', true],
      ['orange', true],
      ['blue', false],
      ['orange', false],
    ])
  })

  it('plays it slowly, 0.6 s a note, 5.40 s, and stops the fast run it cuts off', async () => {
    // Arrange
    const { open } = mountHero()
    button('fast').click()
    const fast = runs.slice()

    // Act
    button('slow').click()
    const [line] = runs.slice(2)
    await settle()

    // Assert
    expect(fast.every((r) => r.stopped)).toBe(true)
    expect(lit('fast')).toBe(false)
    expect(lit('slow')).toBe(true)
    expect(line.points[line.points.length - 1].t).toBeCloseTo(5.4, 9)
    expect(open.chart.every).toBe(0.6)
  })

  it('keeps a play lit when it is pressed again, the second run starting over', async () => {
    // Arrange
    mountHero()
    button('fast').click()
    const first = runs.slice()

    // Act
    button('fast').click()
    await settle()

    // Assert
    expect(first.every((r) => r.stopped)).toBe(true)
    expect(runs.slice(2).some((r) => r.stopped)).toBe(false)
    expect(lit('fast')).toBe(true)
  })

  it('lights the beads in time with sound off, and says nothing played', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    const { open } = mountHero()
    const glow = vi.spyOn(open.chart, 'glow')

    // Act
    button('slow').click()
    runs[1].note(0)

    // Assert
    expect(runs[0].o.audible).toBe(false)
    expect(glow).toHaveBeenCalledTimes(1)
    const hint = el('[data-hero-hint]')
    expect(hint.hidden).toBe(false)
    expect(words(hint)).toBe(SILENT_HINT)
    expect(SILENT_HINT).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's run.",
    )
  })

  it('ends a run when the deck changes step, its button put out and every bead at rest', async () => {
    // Arrange
    const { deck, open } = mountHero()
    const rest = vi.spyOn(open.chart, 'rest')
    button('slow').click()
    const rested = rest.mock.calls.length

    // Act
    deck.show(3)
    await settle()

    // Assert
    expect(runs.every((r) => r.stopped)).toBe(true)
    expect(lit('slow')).toBe(false)
    expect(rest.mock.calls.length).toBeGreaterThan(rested)
    expect(listening.slice(-2)).toEqual([
      ['blue', false],
      ['orange', false],
    ])
  })
})

describe('the predict', () => {
  it('shows the reveal on the choice, the lock hint gone, both choices locked, the keyboard on the reveal and the status line speaking it', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mountHero()
    const reveal = el('#predict .reveal')
    const before = [reveal.hidden, el('#predict .lock-hint').hidden]

    // Act
    choose('time')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Assert: FACTS 15
    expect(before).toEqual([true, false])
    expect(reveal.hidden).toBe(false)
    expect(reveal.hasAttribute('aria-live')).toBe(false)
    expect(el('#predict .lock-hint').hidden).toBe(true)
    const choices = Array.from(
      document.querySelectorAll<HTMLButtonElement>('#predict .choice'),
      (b) => [b.dataset.choice, b.getAttribute('aria-pressed'), b.disabled],
    )
    expect(choices).toEqual([
      ['time', 'true', true],
      ['share', 'false', true],
    ])
    expect(document.activeElement).toBe(reveal)
    const status = words(el('[data-announcer]'))
    expect(status).toMatch(/^What share of their tries came out right\./)
    expect(status).toContain('a fair guess')
    expect(runs).toHaveLength(0)
  })

  it('holds a first visit’s tour until the choice', async () => {
    // Arrange
    mountHero()
    let letGo = false
    void held[0]?.then(() => {
      letGo = true
    })
    await settle()
    const waiting = letGo

    // Act
    choose('share')
    await settle()

    // Assert
    expect(held).toHaveLength(1)
    expect([waiting, letGo]).toEqual([false, true])
  })
})
