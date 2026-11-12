// ============================================================
// Lesson 18 four words tests — each mark written as its sound plays
// ============================================================
//
// On the page's own markup, with the beat clock a recorder (WEB-SPEC, Toys
// 3; FACTS 77): Count-in is four beat pads and nothing written, four
// woodblock clicks at 60 BPM, beat 1 higher, each pad lighting on its
// click; Dynamics, Staccato and Slur are small staves in the learner's
// clef, quarter notes with no time signature, no bar line and no beat
// grid, their notes shown and their marks not yet written, each played at
// 60 BPM with no click, each mark written as its sound starts and staying
// written once heard: mi, re, do at 0.3 of the voice's level under p, then
// after a beat at 1.0 under f; do, mi, so, each 0.15 s, with their dots;
// do, re, mi joined under the slur. A play cut short leaves no mark, a
// play heard says its line, the higher voice moves the staves and the
// sound up an octave, and every play is the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { drive, el, finish, loadPage, resetRuns, runs, settle, soundOn, words, } from './page-dom.test-fixtures'
import { MARK_LINES } from './reads'
import { initWords, WORD_IDS, WORD_LINES } from './words'

/** What the page booked: each knock's beat-1 flag, and each note's frequency, length and levels. */
const booked = vi.hoisted(() => ({
  wood: [] as boolean[],
  notes: [] as { freq: number; dur: number; levels: unknown }[],
}))

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (freq: number, o: { dur: number; levels?: unknown }) => {
    booked.notes.push({ freq, dur: o.dur, levels: o.levels })
    return null
  },
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: (_bus: unknown, _when: number, high: boolean) => {
    booked.wood.push(high)
  },
}))

beforeEach(() => {
  booked.wood.length = 0
  booked.notes.length = 0
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
const marks = (w: string): string[] =>
  Array.from(
    fig(w).querySelectorAll('[data-mark]'),
    (m) => m.getAttribute('data-mark') ?? '',
  )
const button = (w: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`[data-word-play="${w}"]`)
const lit = (w: string): boolean => button(w).classList.contains('is-on')
const said = (): string => words(el('[data-words-said]'))
/** The last run's frame, `beats` from its first, as the clock draws it. */
const frame = (beats: number): void =>
  runs[runs.length - 1].o.onFrame?.({ bar: 0, beat: 0, beats })
const G3 = 55
const A3 = 57
const B3 = 59
const D4 = 62

describe('the four figures', () => {
  it('draws the count-in as four beat pads with nothing written, and each other word as a staff of quarter notes with no 4/4, bar line, pads or marks yet', () => {
    // Act
    initWords()

    // Assert (WEB-SPEC, Toys 3; FACTS 77)
    expect(
      WORD_IDS.map((w) => [
        count(w, '.rb-pad'),
        count(w, '.rb-clef'),
        count(w, '.rb-sym'),
        count(w, '.rb-sym.is-hidden'),
        count(w, '.rb-metre'),
        count(w, '.rb-barline'),
        count(w, '.rb-cell'),
        marks(w).length,
      ]),
    ).toEqual([
      [4, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 6, 0, 0, 0, 0, 0],
      [0, 1, 3, 0, 0, 0, 0, 0],
      [0, 1, 3, 0, 0, 0, 0, 0],
    ])
  })

  it('hides every figure from a screen reader, whose words are the buttons’', () => {
    // Act
    initWords()

    // Assert
    expect(WORD_IDS.map((w) => fig(w).getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
      'true',
      'true',
    ])
    expect(WORD_IDS.map((w) => words(button(w)))).toEqual([
      'Play: four clicks at 60 BPM',
      'Play: mi, re, do, quiet, then loud',
      'Play: do, mi, so, staccato',
      'Play: do, re, mi, slurred',
    ])
  })
})

describe('the plays', () => {
  it('knocks the count-in four times at 60 BPM, beat 1 higher, lighting each pad on its click, and says so once heard', async () => {
    // Arrange
    initWords()

    // Act
    button('countin').click()
    const tempo = runs[0].o.bpm()
    drive(2)
    const now = Array.from(fig('countin').querySelectorAll('.rb-pad'), (p) =>
      p.classList.contains('is-now'),
    )
    await finish()

    // Assert (FACTS 77): 4.0 s, no note
    expect(tempo).toBe(60)
    expect(runs[0].o.bar(0)?.beats).toBe(4)
    expect(now).toEqual([false, true, false, false])
    expect(booked.wood).toEqual([true, false, false, false])
    expect(booked.notes).toEqual([])
    expect(said()).toBe(WORD_LINES.countin)
    expect(lit('countin')).toBe(false)
  })

  it('plays mi, re, do quiet under p, then after a beat the same loud under f, the light following the level, and keeps both marks once heard', async () => {
    // Arrange
    initWords()

    // Act
    button('dynamics').click()
    frame(0.5)
    const quiet = [
      marks('dynamics'),
      fig('dynamics')
        .querySelector('svg')
        ?.style.getPropertyValue('--rd-light'),
    ]
    frame(3.5)
    const rest = marks('dynamics')
    frame(4.5)
    const loud = [
      marks('dynamics'),
      fig('dynamics')
        .querySelector('svg')
        ?.style.getPropertyValue('--rd-light'),
    ]
    await finish()

    // Assert (FACTS 75, 77): 7.0 s, p at 0.3 and f at 1.0, no click
    expect(quiet).toEqual([['p'], '58%'])
    expect(rest).toEqual(['p'])
    expect(loud).toEqual([['p', 'f'], '100%'])
    expect(booked.notes.map((n) => n.freq)).toEqual(
      [B3, A3, G3, B3, A3, G3].map(hz),
    )
    expect(booked.notes.map((n) => n.levels)).toEqual([
      [{ at: 0, level: 0.3 }],
      [{ at: 0, level: 0.3 }],
      [{ at: 0, level: 0.3 }],
      [{ at: 0, level: 1 }],
      [{ at: 0, level: 1 }],
      [{ at: 0, level: 1 }],
    ])
    expect(booked.wood).toEqual([])
    expect(marks('dynamics')).toEqual(['p', 'f'])
    expect(said()).toBe(MARK_LINES.dynamics)
  })

  it('plays do, mi and so for 0.15 s each, writing each dot as its note starts', async () => {
    // Arrange
    initWords()

    // Act
    button('staccato').click()
    frame(0.2)
    const one = marks('staccato')
    frame(2.2)
    const three = marks('staccato')
    await finish()

    // Assert (FACTS 77): 3.0 s
    expect(one).toEqual(['staccato'])
    expect(three).toEqual(['staccato', 'staccato', 'staccato'])
    expect(booked.notes.map((n) => [n.freq, n.dur])).toEqual([
      [hz(G3), 0.15],
      [hz(B3), 0.15],
      [hz(D4), 0.15],
    ])
    expect(runs[0].o.bar(0)?.beats).toBe(3)
    expect(said()).toBe(MARK_LINES.staccato)
  })

  it('plays do, re and mi joined under the slur, written as the first note starts', async () => {
    // Arrange
    initWords()

    // Act
    button('slur').click()
    frame(0.5)
    const first = marks('slur')
    await finish()

    // Assert (FACTS 77): each held to the next, the last let go, 3.0 s
    expect(first).toEqual(['slur'])
    expect(booked.notes.map((n) => [n.freq, n.dur])).toEqual([
      [hz(G3), 1],
      [hz(A3), 1],
      [hz(B3), heldSeconds(1, 60)],
    ])
    expect(marks('slur')).toEqual(['slur'])
    expect(said()).toBe(MARK_LINES.slur)
  })

  it('leaves no mark from a play cut short, and keeps a heard play’s marks through the next play’s start', async () => {
    // Arrange
    initWords()
    button('staccato').click()
    frame(1.2)

    // Act
    button('slur').click()
    await settle()
    const cut = marks('staccato')
    await finish()
    button('staccato').click()
    await finish()
    button('slur').click()
    await settle()

    // Assert
    expect(cut).toEqual([])
    expect(marks('staccato')).toEqual(['staccato', 'staccato', 'staccato'])
    expect(marks('slur')).toEqual([])
  })

  it('moves the staves and the sound to the treble for the higher voice', async () => {
    // Arrange
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')
    initWords()

    // Act
    button('slur').click()
    await finish()

    // Assert
    expect(fig('slur').getAttribute('aria-label')).toBe(
      'Treble staff, a short figure',
    )
    expect(booked.notes.map((n) => n.freq)).toEqual(
      [G3 + 12, A3 + 12, B3 + 12].map(hz),
    )
  })

  it('redraws the staves in the newly chosen clef, keeping the marks heard', async () => {
    // Arrange
    initWords()
    button('staccato').click()
    await finish()

    // Act
    VoiceChoice.set('higher')
    const after = [
      fig('staccato').getAttribute('aria-label'),
      marks('staccato'),
    ]
    VoiceChoice.set('lower')

    // Assert
    expect(after).toEqual([
      'Treble staff, a short figure',
      ['staccato', 'staccato', 'staccato'],
    ])
    expect(fig('staccato').getAttribute('aria-label')).toBe(
      'Bass staff, a short figure',
    )
  })
})

describe('one sound at a time', () => {
  it("stops a word when another sound takes the page's owner, its button put out and nothing said", async () => {
    // Arrange
    initWords()
    button('dynamics').click()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(lit('dynamics')).toBe(false)
    expect(said()).toBe('')
  })

  it("stops one word's play when another word's starts", async () => {
    // Arrange
    initWords()
    button('countin').click()

    // Act
    button('slur').click()
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect([lit('countin'), lit('slur')]).toEqual([false, true])
  })
})
