// ============================================================
// Lesson 19 four words tests — the accent on six pads, three written as they play
// ============================================================
//
// On the page's own markup, with the beat clock the kit's recorder
// (WEB-SPEC, Toys 4; FACTS 66): Accent's figure is six pads alone, nothing
// written, its first pad the one numbered larger, and it plays six closed
// hi-hats at 90 quarter notes a minute, an eighth a third of a second, the
// first at full level, with no click; the other three are written on one
// line in their metre, nothing before a play, with no strip, counts or
// pads, and each plays at 60 BPM over the click, writing each symbol as it
// sounds and keeping it: Offbeat's claps on each "and", Triplet's five
// notes on the stored voice's A with its 3, Syncopation's tied note
// sounding once over beat 3. Each says its line once heard to its end, and
// every play is the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { drive, finish, resetRuns, runs, } from '@/features/lessons/kit/beat-clock-recorder.test-fixtures'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { SIX_BPM, STEP_BPM } from './rhythm-views'
import { initWords, WORD_IDS, WORD_LINES } from './words'

/** What the page booked: each knock's arguments, each note's, and each drum struck. */
const booked = vi.hoisted(() => ({
  wood: [] as unknown[][],
  notes: [] as unknown[][],
  drums: [] as string[],
}))

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (
    await import('@/features/lessons/kit/beat-clock-recorder.test-fixtures')
  ).FakeBeatClock,
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (...a: unknown[]) => {
    booked.notes.push(a)
    return null
  },
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: (...a: unknown[]) => {
    booked.wood.push(a)
  },
}))
vi.mock('@/lib/drum-voices', () => ({
  triggerDrumVoice: (id: string, _c: unknown, _w: number, level: number) => {
    booked.drums.push(`${id} ${level}`)
  },
}))

beforeEach(() => {
  booked.wood.length = 0
  booked.notes.length = 0
  booked.drums.length = 0
  resetRuns()
  soundOn()
  loadPage()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const fig = (w: string): HTMLElement => el(`[data-word-fig="${w}"]`)
const count = (w: string, sel: string): number =>
  fig(w).querySelectorAll(sel).length
const written = (w: string): number[] =>
  Array.from(fig(w).querySelectorAll('.rb-sym:not(.is-hidden)'), (g) =>
    Number(g.getAttribute('data-i')),
  )
const digits = (w: string): string[] =>
  Array.from(
    fig(w).querySelectorAll('.rb-metre-digit'),
    (d) => d.textContent ?? '',
  )
const button = (w: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`[data-word-play="${w}"]`)
const lit = (w: string): boolean => button(w).classList.contains('is-on')
const dur = (a: unknown[]): number => (a[1] as { dur: number }).dur
const knocks = (): unknown[] => booked.wood.map((a) => a[2])
/** The beats the last run's first bar strikes its drums on. */
const drumBeats = (): number[] =>
  (runs[runs.length - 1].o.bar(0)?.hits ?? [])
    .filter((h) => (h.data as { drum?: unknown }).drum != null)
    .map((h) => h.beat)

describe('the four figures', () => {
  it('draws the accent as six pads alone and the other three on one line in their metre, nothing written yet', () => {
    // Act
    initWords()

    // Assert (WEB-SPEC, Toys 4; FACTS 66): line, symbols, pads, written, time signature
    expect(
      WORD_IDS.map((w) => [
        count(w, '.rb-line'),
        count(w, '.rb-sym'),
        count(w, '.rb-pad'),
        written(w).length,
        digits(w).join('/'),
      ]),
    ).toEqual([
      [0, 0, 6, 0, ''],
      [1, 8, 0, 0, '4/4'],
      [1, 5, 0, 0, '2/4'],
      [1, 5, 0, 0, '4/4'],
    ])
    expect(
      WORD_IDS.map((w) => count(w, '.rb-strip') + count(w, '.rb-count')),
    ).toEqual([0, 0, 0, 0])
    expect(count('accent', '.rb-arc')).toBe(0)
  })

  it("numbers the accent's first pad larger, the one its accent lights", () => {
    // Act
    initWords()

    // Assert
    expect(
      Array.from(fig('accent').querySelectorAll('.rb-pad.one'), (p) =>
        p.getAttribute('data-pad'),
      ),
    ).toEqual(['0'])
  })

  it('names each figure for what it shows, under the ticket that hides it from a screen reader', () => {
    // Act
    initWords()

    // Assert
    expect(fig('triplet').getAttribute('aria-label')).toBe(
      'One bar of 2/4: two eighth notes and three triplet eighth notes, on one line',
    )
    expect(WORD_IDS.map((w) => fig(w).getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
      'true',
      'true',
    ])
  })
})

describe('the plays', () => {
  it('plays the accent on six closed hi-hats an eighth apart, the first full, with no click, lighting the pads as it sounds', async () => {
    // Arrange
    initWords()

    // Act
    button('accent').click()
    const tempo = runs[0].o.bpm()
    drive(1)
    const during = [count('accent', '.rb-pad.is-now'), lit('accent')]
    await finish()

    // Assert (FACTS 66): 2 s, a hi-hat each third of a second
    expect(tempo).toBe(SIX_BPM)
    expect(during).toEqual([1, true])
    expect(drumBeats()).toEqual([0, 0.5, 1, 1.5, 2, 2.5])
    expect(booked.drums).toEqual([
      'hh-closed 1',
      'hh-closed 0.7',
      'hh-closed 0.7',
      'hh-closed 0.7',
      'hh-closed 0.7',
      'hh-closed 0.7',
    ])
    expect([booked.wood, booked.notes]).toEqual([[], []])
    expect(words(el('[data-words-said]'))).toBe(WORD_LINES.accent)
    expect(lit('accent')).toBe(false)
  })

  it('plays the offbeat at 60 BPM over the click, a clap on each "and", writing each rest and eighth as it comes', async () => {
    // Arrange
    initWords()

    // Act
    button('offbeat').click()
    const tempo = runs[0].o.bpm()
    drive(1)
    const first = written('offbeat')
    await finish()

    // Assert (FACTS 66): 4 s, the claps on 1 and, 2 and, 3 and, 4 and
    expect(tempo).toBe(STEP_BPM)
    expect(first).toEqual([0, 1])
    expect(written('offbeat')).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(drumBeats()).toEqual([0.5, 1.5, 2.5, 3.5])
    expect(booked.drums).toEqual([
      'clap 0.7',
      'clap 0.7',
      'clap 0.7',
      'clap 0.7',
    ])
    expect(knocks()).toEqual([true, false, false, false])
    expect(booked.notes).toEqual([])
    expect(words(el('[data-words-said]'))).toBe(WORD_LINES.offbeat)
  })

  it("plays the triplet in 2/4 at 60 BPM on the stored voice's A, its three a third of a beat apart, the 3 written with them", async () => {
    // Arrange
    initWords()

    // Act
    button('triplet').click()
    await finish()

    // Assert (FACTS 66): 2 s over two knocks
    const third = heldSeconds(1 / 3, 60)
    expect(booked.notes.map((a) => a[0])).toEqual(Array(5).fill(hz(A3)))
    expect(booked.notes.map(dur)).toEqual([
      heldSeconds(0.5, 60),
      heldSeconds(0.5, 60),
      third,
      third,
      third,
    ])
    expect(knocks()).toEqual([true, false])
    expect(written('triplet')).toEqual([0, 1, 2, 3, 4])
    expect(
      fig('triplet').querySelector('.rb-tuplet')?.closest('.is-hidden'),
    ).toBeNull()
    expect(words(el('[data-words-said]'))).toBe(WORD_LINES.triplet)
  })

  it("sings at the higher voice's A for a viewer who chose it", async () => {
    // Arrange
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')
    initWords()

    // Act
    button('syncopation').click()
    await finish()

    // Assert
    expect(booked.notes.map((a) => a[0])).toEqual(Array(4).fill(hz(A4)))
  })

  it("plays Step 4's moved bar, the note on “2 and” tied over beat 3 and sounding once", async () => {
    // Arrange
    initWords()

    // Act
    button('syncopation').click()
    await finish()

    // Assert (FACTS 43, 66): 4 s over four knocks
    expect(booked.notes.map(dur)).toEqual([
      heldSeconds(1, 60),
      heldSeconds(0.5, 60),
      heldSeconds(1.5, 60),
      heldSeconds(1, 60),
    ])
    expect(knocks()).toEqual([true, false, false, false])
    expect(written('syncopation')).toEqual([0, 1, 2, 3, 4])
    expect(fig('syncopation').querySelector('.rb-tie.is-hidden')).toBeNull()
    expect(words(el('[data-words-said]'))).toBe(WORD_LINES.syncopation)
  })

  it('keeps a figure written across its plays', async () => {
    // Arrange
    initWords()
    button('offbeat').click()
    await finish()

    // Act
    button('offbeat').click()

    // Assert
    expect(written('offbeat')).toHaveLength(8)
  })
})

describe('one sound at a time', () => {
  it("stops a word when another sound takes the page's owner, its button put out", async () => {
    // Arrange
    initWords()
    button('accent').click()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(lit('accent')).toBe(false)
    expect(words(el('[data-words-said]'))).toBe('')
  })

  it("stops one word's play when another word's starts", async () => {
    // Arrange
    initWords()
    button('triplet').click()

    // Act
    button('offbeat').click()
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect([lit('triplet'), lit('offbeat')]).toEqual([false, true])
  })

  it('ignores a press of the word already playing', () => {
    // Arrange
    initWords()
    button('syncopation').click()

    // Act
    button('syncopation').click()

    // Assert
    expect(runs).toHaveLength(1)
    expect(runs[0].stopped).toBe(false)
  })
})
