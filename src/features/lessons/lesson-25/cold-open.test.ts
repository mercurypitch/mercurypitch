// ============================================================
// Lesson 25 cold open tests — the tune on the minor staircase, and the chord before home
// ============================================================
//
// FACTS 30 to 37 and 59, and the WEB-SPEC's Toys 2 and 3, on the page's own
// markup with the kit's runs a recorder: the tune twice, 17.0 s, on Merc's
// "ooh" with no chord, its second ending's G sharp lifting te to ti; the
// two endings, 4.0 s, over three soft voices at 0.05 each, locked until a
// choice; the chord column drawn only by an ending's chord before home,
// sliding its middle bead for ending 2 and taken away by the tune play;
// the reveal after both endings heard, in either order, showing Step 1's
// paragraph and putting its held line away; a play cut short changing
// nothing; the choice reaching the toys and the tour; and a step change
// stopping the hero's play.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { HARMONIC_MINOR_DEGREES, NATURAL_MINOR_DEGREES, } from '@/features/lessons/kit/chords'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import { COLOR } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunNote } from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { UNDER_GAIN } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as TourGateModule from '@/features/lessons/kit/tour-gate'
import type { ColdOpen } from './cold-open'
import { BEFORE_HOME, COLD_PREDICT, endingNotes, HERO_LABEL, HERO_SAID, initColdOpen, TUNE_NOTES, } from './cold-open'
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

/** The notes the cold open sounds, by MIDI number, spelled in A minor. */
const NAME: Readonly<Record<number, string>> = {
  45: 'A2',
  48: 'C3',
  52: 'E3',
  55: 'G3',
  56: 'G♯3',
  57: 'A3',
  59: 'B3',
  60: 'C4',
  62: 'D4',
  64: 'E4',
  67: 'G4',
  68: 'G♯4',
  69: 'A4',
}

/** A run's notes as written, with their octaves: "A3 C4 E4". */
const written = (notes: readonly RunNote[]): string =>
  notes.map((n) => NAME[n.midi] ?? String(n.midi)).join(' ')

/** The end of a run's last note, s. */
const lengthOf = (notes: readonly RunNote[]): number =>
  Math.max(...notes.map((n) => n.t + n.dur))

describe("the cold open's sounds", () => {
  it('plays the tune twice on Merc’s "ooh", 8.0 s, 1.0 s of quiet, then with G sharp 4, 17.0 s, and no chord (FACTS 30, 31, 59)', () => {
    // Arrange
    const once = TUNE_NOTES.filter((n) => n.t < 8)
    const again = TUNE_NOTES.filter((n) => n.t >= 9)

    // Assert
    expect(written(once)).toBe('A3 C4 E4 C4 D4 C4 B3 C4 B3 A3 E4 G4 A4')
    expect(written(again)).toBe('A3 C4 E4 C4 D4 C4 B3 C4 B3 A3 E4 G♯4 A4')
    expect(once.map((n) => n.dur)).toEqual([
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1,
    ])
    expect(lengthOf(once)).toBe(8)
    expect(again[0].t).toBe(9)
    expect(lengthOf(TUNE_NOTES)).toBe(17)
    // one note at a time, in the run's own voice
    expect(new Set(TUNE_NOTES.map((n) => n.t)).size).toBe(TUNE_NOTES.length)
    expect(TUNE_NOTES.every((n) => n.kind === undefined)).toBe(true)
  })

  it('plays each ending’s last two bars over A minor, the chord before home and A minor, 4.0 s, the chords at 0.05 a voice (FACTS 34, 59)', () => {
    // Act
    const end1 = endingNotes(false)
    const end2 = endingNotes(true)
    const chords = (notes: RunNote[]): string[] =>
      [0, 2, 3].map((t) =>
        written(notes.filter((n) => n.kind === 'soft' && n.t === t)),
      )

    // Assert
    expect(written(end1.filter((n) => n.kind === undefined))).toBe(
      'C4 B3 A3 E4 G4 A4',
    )
    expect(written(end2.filter((n) => n.kind === undefined))).toBe(
      'C4 B3 A3 E4 G♯4 A4',
    )
    expect(chords(end1)).toEqual(['A2 C3 E3', 'E3 G3 B3', 'A3 C4 E4'])
    expect(chords(end2)).toEqual(['A2 C3 E3', 'E3 G♯3 B3', 'A3 C4 E4'])
    expect(
      end1.filter((n) => n.kind === 'soft').map((n) => [n.t, n.dur]),
    ).toEqual([
      [0, 2],
      [0, 2],
      [0, 2],
      [2, 1],
      [2, 1],
      [2, 1],
      [3, 1],
      [3, 1],
      [3, 1],
    ])
    expect(
      end2.filter((n) => n.kind === 'soft').every((n) => n.gain === UNDER_GAIN),
    ).toBe(true)
    expect(BEFORE_HOME).toEqual({ t: 2, dur: 1 })
    expect(lengthOf(end1)).toBe(4)
    expect(lengthOf(end2)).toBe(4)
  })
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
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

/** Every cold open a test mounted, for its cleanup to stop. */
const mounted: ColdOpen[] = []
let choices = 0

/** The hero on the page's own markup and deck, as main.ts mounts it. */
function mountHero(): { cold: ColdOpen; deck: StepDeck } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  deck.start()
  choices = 0
  const cold = initColdOpen(deck, {
    unlocks: [el<HTMLButtonElement>('#toyMinor [data-raise="te"]')],
    onChoice: () => {
      choices += 1
    },
  })
  mounted.push(cold)
  return { cold, deck }
}

const play = (what: 'tune' | 'end1' | 'end2'): HTMLButtonElement =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const choose = (c: 'major' | 'minor'): void => {
  el<HTMLButtonElement>(`#predict [data-choice="${c}"]`).click()
}
const reveal = (): HTMLElement => el('#predict .reveal')
const hint = (): string => words(el('#predict .lock-hint'))
const said = (): string => words(el('#heroStairs [data-hero-said]'))
const label = (): string | null =>
  el('[data-hero-canvas]').getAttribute('aria-label')
const last = (): RecordedRun => runs[runs.length - 1]

/** Starts one of the hero's plays; the run it asked for. */
async function start(what: 'tune' | 'end1' | 'end2'): Promise<RecordedRun> {
  play(what).click()
  await settle()
  return last()
}

/** Plays one of the hero's plays, every note started, to its end, heard. */
async function hear(what: 'tune' | 'end1' | 'end2'): Promise<RecordedRun> {
  const r = await start(what)
  r.notes.forEach((_n, i) => r.note(i))
  r.end(true)
  await settle()
  return r
}

describe('the cold open', () => {
  it('stands the minor staircase on A alone before a choice, no column, the endings locked', () => {
    // Act
    const { cold } = mountHero()

    // Assert: WEB-SPEC, Toys 2; FACTS 1a
    expect(label()).toBe(HERO_LABEL.rest)
    expect(cold.core.tonic).toBe(57)
    expect(cold.core.degrees).toEqual(NATURAL_MINOR_DEGREES)
    expect(cold.column.shown).toBe(false)
    expect(play('tune').disabled).toBe(false)
    expect(play('end1').disabled).toBe(true)
    expect(play('end2').disabled).toBe(true)
    expect(hint()).toBe(
      'Choose an answer to unlock the two endings with their chords.',
    )
  })

  it('plays the tune before a choice, lighting the stairs in Merc’s blue, te lifting to ti for the G sharp and settling back, no chord drawn', async () => {
    // Arrange
    const { cold } = mountHero()
    const lights = vi.spyOn(cold.core, 'play')

    // Act
    const r = await start('tune')
    const first = said()
    const sharp = r.notes.findIndex((n) => n.midi === 68)
    for (let i = 0; i <= sharp; i++) r.note(i)
    const lifted = cold.core.degrees
    const second = said()
    r.end(true)
    await settle()

    // Assert: FACTS 31; the stairs silent, the run Merc's "ooh"
    expect(r.notes).toEqual(TUNE_NOTES)
    expect(r.o.kind).toBe('merc')
    expect(lights.mock.calls[0][1]).toBe(false)
    expect(lights.mock.calls[0][2]).toMatchObject({ color: COLOR.blue })
    expect(lights.mock.calls[0][0][sharp]).toMatchObject({ midi: 68, stair: 6 })
    expect([first, second]).toEqual([HERO_SAID.tune, HERO_SAID.ti])
    expect(lifted).toEqual(HARMONIC_MINOR_DEGREES)
    expect(cold.core.degrees).toEqual(NATURAL_MINOR_DEGREES)
    expect(cold.column.shown).toBe(false)
    // heard before a choice, it brings the lock line back and reveals nothing
    expect(hint()).toBe(
      'Choose an answer to unlock the two endings with their chords.',
    )
    expect(reveal().hidden).toBe(true)
  })

  it('unlocks the endings and Step 1’s Raise te at the choice, tells the toys and lets the tour go on', async () => {
    // Arrange
    mountHero()
    const te = el<HTMLButtonElement>('#toyMinor [data-raise="te"]')
    const before = te.disabled

    // Act
    choose('minor')
    await settle()

    // Assert: FACTS 36, 37
    expect(before).toBe(true)
    expect(te.disabled).toBe(false)
    expect(play('end1').disabled).toBe(false)
    expect(play('end2').disabled).toBe(false)
    expect(choices).toBe(1)
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
    await expect(held[0]).resolves.toBe('minor')
  })

  it('draws the column as ending 1’s chord before home sounds, E, G and B, lit while it sounds, named with no octave', async () => {
    // Arrange
    const { cold } = mountHero()
    choose('major')
    await settle()
    const r = await start('end1')
    const opening = said()

    // Act: the chord before home starts
    const before = r.notes.findIndex(
      (n) => n.kind === 'soft' && n.t === BEFORE_HOME.t,
    )
    for (let i = 0; i < before; i++) r.note(i)
    const early = cold.column.shown
    r.note(before)

    // Assert: FACTS 34
    expect(opening).toBe(HERO_SAID.end1)
    expect(early).toBe(false)
    expect(cold.column.shown).toBe(true)
    expect(cold.column.chord).toEqual({
      notes: [64, 67, 71],
      names: ['E', 'G', 'B'],
      label: 'E minor',
    })
    expect(said()).toBe('E, G, B: 3 and 4 semitones, E minor.')
    expect(label()).toBe(HERO_LABEL.column(false))
  })

  it('slides the middle bead up a row for ending 2, te lifting as G sharp sounds, and keeps the column after', async () => {
    // Arrange
    const { cold } = mountHero()
    choose('major')
    await settle()
    await hear('end1')
    const set = vi.spyOn(cold.column, 'set')

    // Act
    const r = await start('end2')
    const kept = cold.column.chord?.label
    const sharp = r.notes.findIndex((n) => n.midi === 68)
    for (let i = 0; i < r.notes.length; i++) r.note(i)
    const lifted = cold.core.degrees
    r.end(true)
    await settle()

    // Assert: WEB-SPEC, Toys 2
    expect(sharp).toBeGreaterThanOrEqual(0)
    expect(kept).toBe('E minor')
    expect(set).toHaveBeenCalledTimes(1)
    expect(cold.column.chord).toEqual({
      notes: [64, 68, 71],
      names: ['E', 'G♯', 'B'],
      label: 'E major',
    })
    expect(lifted).toEqual(HARMONIC_MINOR_DEGREES)
    expect(cold.core.degrees).toEqual(NATURAL_MINOR_DEGREES)
    expect(cold.column.shown).toBe(true)
  })

  it('reveals only after both endings are heard, in either order, with Step 1’s paragraph, its held line put away, and Tavi’s one cheer', async () => {
    // Arrange
    mountHero()
    choose('minor')
    await settle()

    // Act: ending 2 first, then the tune, then ending 1
    await hear('end2')
    const afterOne = [reveal().hidden, hint()]
    await hear('tune')
    const afterTune = reveal().hidden
    await hear('end1')

    // Assert: FACTS 35 to 37
    expect(afterOne).toEqual([true, COLD_PREDICT.hints.chosen])
    expect(afterTune).toBe(true)
    expect(reveal().hidden).toBe(false)
    expect(words(reveal())).toMatch(
      /^You said: it stays minor It turns major\./,
    )
    expect(el('[data-chord-para]').hidden).toBe(false)
    expect(el('[data-held-line]').hidden).toBe(true)
    expect(hint()).toBe(COLD_PREDICT.hints.again)
    expect(cheers).toEqual(['orange'])
  })

  it('counts an ending cut short as not heard: no reveal, the hint as it was, the column as it last drew', async () => {
    // Arrange
    const { cold } = mountHero()
    choose('major')
    await settle()
    await hear('end1')

    // Act: ending 2 starts, and another sound on the page stops it
    const r = await start('end2')
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(r.stopped).toBe(true)
    expect(reveal().hidden).toBe(true)
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
    expect(cold.column.chord?.label).toBe('E minor')
    expect(cold.core.degrees).toEqual(NATURAL_MINOR_DEGREES)
  })

  it('takes the column away when the tune plays again, since the tune draws no chord', async () => {
    // Arrange
    const { cold } = mountHero()
    choose('major')
    await settle()
    await hear('end1')

    // Act
    await start('tune')

    // Assert: WEB-SPEC, Toys 2
    expect(cold.column.shown).toBe(false)
    expect(label()).toBe(HERO_LABEL.rest)
  })

  it('ends the tune at the choice, so Play ending 1, which takes the focus, plays at the first press', async () => {
    // Arrange
    mountHero()
    const tune = await start('tune')

    // Act
    choose('major')
    await settle()
    const focused = document.activeElement === play('end1')
    const ending = await start('end1')

    // Assert: the predict lets one of its plays sound at a time
    expect(tune.stopped).toBe(true)
    expect(focused).toBe(true)
    expect(ending).not.toBe(tune)
    expect(ending.stopped).toBe(false)
  })

  it('stops its play at a step change of the deck', async () => {
    // Arrange
    const { deck } = mountHero()
    const r = await start('tune')

    // Act
    deck.show(2)
    await settle()

    // Assert: WEB-SPEC, Audio, rule 2
    expect(r.stopped).toBe(true)
  })
})
