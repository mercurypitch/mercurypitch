// ============================================================
// Lesson 26 cold open tests — "Twinkle" with its copy, and the play that answers the predict
// ============================================================
//
// FACTS 15, 31 to 35, 40 and 41 and the WEB-SPEC's Toys 1 and Tests 4, on
// the page's own markup with the kit's runs a recorder: Play the tune free
// from the start, 8.0 s in the soft tone; Play them together locked until
// a choice, then the tune with the copy four semitones up, note against
// note, the lanes lit and the copy drawing a bead at a time as it sounds;
// the reveal after it is heard, the hero's reveal and Steps 1 and 2's held
// words shown and read in order, their held lines put away, Tavi's quiet
// "oh"; Play the copy that stays in the key, the moved copy faded to the
// contrast case; a play cut short revealing nothing; a play bringing the
// drawing back into view and running on while the predict is read; and
// the choice reaching the page and the tour.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollOutOfView } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import type { ColdOpen } from './cold-open'
import { COLD_PREDICT, HERO_SAID, heroEvents, initColdOpen } from './cold-open'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { KEY_COPY, UP4_COPY } from './parts'

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

const last = () => runs[runs.length - 1]
const play = (what: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`[data-play="${what}"]`)
const hint = (): string => words(el('#predict .lock-hint'))
const choose = (c: 'fits' | 'leaves'): void =>
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()

/** Presses a play and lets it run to its end, heard: its sound, and its lights 8.0 s on. */
async function hear(what: string): Promise<void> {
  play(what).click()
  await settle()
  last().end(true)
  vi.advanceTimersByTime(8100)
  await settle()
}

let chosen = 0
let revealed = 0

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mount(): ColdOpen {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
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
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  loadPage()
  soundOn()
  resetRuns()
  cheers.length = 0
  held.length = 0
  chosen = 0
  revealed = 0
})

afterEach(() => {
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe('the hero at first paint', () => {
  it('draws "Twinkle" on plain rows with the house, and says so (FACTS 31, 32)', () => {
    const hero = mount()
    expect(hero.line.shape.lines).toEqual([0, 1])
    expect(hero.line.shape.dress).toEqual({ house: 60 })
    expect(el('[data-hero-canvas]').getAttribute('aria-label')).toBe(
      HERO_SAID.rest,
    )
    expect(play('together').disabled).toBe(true)
  })

  it('waits for the choice before the tour, with no time limit', () => {
    mount()
    expect(held).toHaveLength(1)
  })
})

describe('Play the tune', () => {
  it('plays "Twinkle"\'s two lines in the soft tone, 8.0 s, free from the start, revealing nothing', async () => {
    // Arrange
    mount()

    // Act
    await hear('tune')

    // Assert
    const notes = last().notes
    expect(notes).toHaveLength(14)
    expect(Math.max(...notes.map((n) => n.t + n.dur))).toBe(8)
    expect(last().o.kind).toBe('soft')
    expect(el('#predict .reveal').hidden).toBe(true)
    expect(hint()).toBe('Choose an answer to unlock the copy.')
  })
})

describe('the hero in view', () => {
  it("brings the drawing back into view, centred by the page's scroll, when a play is pressed with it scrolled away above the screen", () => {
    // Arrange
    mount()
    const figure = el('#heroTune')
    const scroll = vi
      .spyOn(window, 'scrollBy')
      .mockImplementation(() => undefined)
    const above = vi
      .spyOn(figure, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, -620, 390, 480))

    // Act
    play('tune').click()

    // Assert: reduced motion is on, so it lands at once; the stage, which
    // clips what overflows it, is never scrolled
    expect(scroll).toHaveBeenCalledWith({
      top: -620 + 240 - window.innerHeight / 2,
      behavior: 'instant',
    })
    expect(el('#heroStage').scrollTop).toBe(0)
    above.mockReturnValue(new DOMRect(0, 40, 390, 480))
    scroll.mockClear()
    play('tune').click()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('stops its play once the hero, its stage and its predict, has been off screen for 600 ms, not the stage alone', async () => {
    // Arrange
    mount()
    play('tune').click()
    await settle()

    // Act: the predict read under the stage
    scrollOutOfView(el('#heroStage'))
    vi.advanceTimersByTime(600)

    // Assert
    expect(last().stopped).toBe(false)
    scrollOutOfView(el('.l26-hero'))
    vi.advanceTimersByTime(600)
    expect(last().stopped).toBe(true)
  })
})

describe('the choice and Play them together', () => {
  it('tells the page and the tour, and opens the answering play', async () => {
    mount()
    choose('leaves')
    await settle()
    expect(chosen).toBe(1)
    expect(await held[0]).toBe('leaves')
    expect(play('together').disabled).toBe(false)
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
  })

  it('plays the tune with the copy four semitones up, note against note, 8.0 s', async () => {
    mount()
    choose('fits')
    play('together').click()
    await settle()
    const notes = last().notes
    expect(notes).toHaveLength(28)
    const at2 = notes.filter((n) => n.t === 2).map((n) => n.midi)
    expect(at2).toEqual([69, 73])
  })

  it('lights the lanes as it starts and draws the copy a bead at a time as it sounds', async () => {
    // Arrange
    const hero = mount()
    choose('leaves')

    // Act
    play('together').click()
    await settle()
    const atStart = hero.line.shape.dress
    vi.advanceTimersByTime(1050)
    const after3 = hero.line.shape.dress?.parts?.map((p) => p.shown)

    // Assert: at 1.05 s the copy's first three notes on line 1 have sounded
    expect(atStart?.lanes).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(atStart?.parts?.map((p) => p.shown)).toEqual([0, 0])
    expect(after3).toEqual([3, 0])
  })

  it('reveals when heard to its end: the hero’s reveal and Steps 1 and 2’s words, read in order, Tavi’s "oh"', async () => {
    // Arrange
    const hero = mount()
    choose('leaves')

    // Act
    await hear('together')

    // Assert
    expect(hero.predict.revealed).toBe(true)
    expect(el('#predict .reveal').hidden).toBe(false)
    expect(el('.held-body[data-held="1"]').hidden).toBe(false)
    expect(el('.held-body[data-held="2"]').hidden).toBe(false)
    expect(words(el('#predict .reveal .mono'))).toBe(
      'You said: some notes leave the key',
    )
    expect(revealed).toBe(1)
    expect(cheers).toEqual(['orange'])
    expect(words(el('[data-hero-said]'))).toBe(HERO_SAID.up4)
    expect(hero.line.shape.dress?.parts?.map((p) => p.shown)).toEqual([7, 7])
  })

  it('reveals nothing for a play cut short, and goes back to how it stood', async () => {
    const hero = mount()
    choose('leaves')
    play('together').click()
    await settle()
    hero.stop()
    await settle()
    expect(hero.predict.revealed).toBe(false)
    expect(hero.line.shape.dress).toEqual({ house: 60 })
    expect(el('[data-hero-canvas]').getAttribute('aria-label')).toBe(
      HERO_SAID.rest,
    )
  })

  it('keeps what it last drew when the Sound switch cuts its play short, and reveals nothing', async () => {
    // Arrange: the copy a few beads in
    const hero = mount()
    choose('leaves')
    const before = words(el('[data-hero-said]'))
    play('together').click()
    await settle()
    vi.advanceTimersByTime(3000)

    // Act: the switch stops every sound, not the page's own stop
    last().end(false)
    await settle()

    // Assert: Edge cases, "A play cut short"
    expect(hero.predict.revealed).toBe(false)
    expect(hero.line.shape.dress).toEqual({ house: 60 })
    expect(el('[data-hero-canvas]').getAttribute('aria-label')).toBe(
      HERO_SAID.rest,
    )
    expect(words(el('[data-hero-said]'))).toBe(before)
  })
})

describe('Play the copy that stays in the key', () => {
  it('plays the key’s copy, fading the moved copy to the contrast case, and says every note is on the rows', async () => {
    // Arrange
    const hero = mount()
    choose('leaves')
    await hear('together')

    // Act
    await hear('key')

    // Assert
    expect(
      last()
        .notes.filter((n) => n.t === 2)
        .map((n) => n.midi),
    ).toEqual([69, 72])
    expect(hero.line.shape.dress?.parts?.[0].at).toEqual(KEY_COPY[0])
    expect(words(el('[data-hero-said]'))).toBe(HERO_SAID.key)
    expect(hint()).toBe(COLD_PREDICT.hints.again)
  })
})

describe('heroEvents', () => {
  it('lights each note of the copy on the bead against the tune’s, by its line', () => {
    const { events, notes, parts } = heroEvents(UP4_COPY)
    expect(events).toHaveLength(28)
    expect(notes.slice(0, 4)).toEqual([0, 0, 1, 1])
    expect(notes.slice(14, 16)).toEqual([7, 7])
    expect(parts.slice(12, 16)).toEqual([null, 0, null, 1])
  })
})
