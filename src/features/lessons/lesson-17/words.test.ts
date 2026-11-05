// ============================================================
// Lesson 17 four words tests — each figure a short rhythm, written as it plays
// ============================================================
//
// On the page's own markup, with the beat clock a recorder (WEB-SPEC, Toys
// 4; FACTS 65): each ticket's figure is a short rhythm on one line with its
// stopwatch strip, no 4/4 and no bar line, nothing written before a play;
// each play runs at 60 BPM, writes each symbol as it sounds and keeps it,
// each cell reading as its note ends, and says its lengths once heard; the
// tie's two pairs sit a beat apart, the second tied below its heads and
// sounding as one note, its strip reading 1 s, 1 s, then 2 s; and every
// play is the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { drive, el, finish, loadPage, resetRuns, runs, settle, soundOn, words, } from './page-dom.test-fixtures'
import { initWords, WORD_IDS, WORD_LINES } from './words'

/** What the page booked: each knock's arguments, and each note's. */
const booked = vi.hoisted(() => ({
  wood: [] as unknown[][],
  notes: [] as unknown[][],
}))

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
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
const written = (w: string): number[] =>
  Array.from(fig(w).querySelectorAll('.rb-sym:not(.is-hidden)'), (g) =>
    Number(g.getAttribute('data-i')),
  )
const readings = (w: string): string[] =>
  Array.from(
    fig(w).querySelectorAll('.rb-read:not(.is-hidden)'),
    (t) => t.textContent ?? '',
  )
const button = (w: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`[data-word-play="${w}"]`)
const lit = (w: string): boolean => button(w).classList.contains('is-on')
const dur = (a: unknown[]): number => (a[1] as { dur: number }).dur

describe('the four figures', () => {
  it('draws each word as a short rhythm on one line with its strip, nothing written yet, and no 4/4 or bar line', () => {
    // Act
    initWords()

    // Assert (WEB-SPEC, Toys 4; FACTS 65)
    expect(
      WORD_IDS.map((w) => [
        count(w, '.rb-line'),
        count(w, '.rb-sym'),
        count(w, '.rb-cell'),
        written(w).length,
        count(w, '.rb-metre'),
        count(w, '.rb-barline'),
        count(w, '.rb-pad'),
      ]),
    ).toEqual([
      [1, 3, 3, 0, 0, 0, 0],
      [1, 4, 4, 0, 0, 0, 0],
      [1, 2, 2, 0, 0, 0, 0],
      [1, 4, 3, 0, 0, 0, 0],
    ])
  })

  it('names each figure for what it shows, under the ticket that hides it from a screen reader', () => {
    // Act
    initWords()

    // Assert
    expect(fig('dot').getAttribute('aria-label')).toBe(
      'A dotted half note, then a quarter note, on one line',
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
  it('plays Note value at 60 BPM, writing each note as it sounds and keeping it, each cell read as its note ends', async () => {
    // Arrange
    initWords()

    // Act
    button('value').click()
    const tempo = runs[0].o.bpm()
    drive(1)
    const first = [written('value'), readings('value'), lit('value')]
    await finish()

    // Assert (FACTS 65): a whole note, then two halves, 8 s
    expect(tempo).toBe(60)
    expect(first).toEqual([[0], [], true])
    expect(written('value')).toEqual([0, 1, 2])
    expect(readings('value')).toEqual(['4 s', '2 s', '2 s'])
    expect(booked.notes.map(dur)).toEqual([
      heldSeconds(4, 60),
      heldSeconds(2, 60),
      heldSeconds(2, 60),
    ])
    expect(words(el('[data-words-said]'))).toBe(WORD_LINES.value)
    expect(lit('value')).toBe(false)
  })

  it('knocks every beat, only the first higher, since a short rhythm has no bars', async () => {
    // Arrange
    initWords()

    // Act
    button('value').click()
    await finish()

    // Assert: eight beats, the fifth plain, where a bar of 4/4 would knock higher
    expect(booked.wood.map((a) => a[2])).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it('reads every rest and dot as the kit reads them', async () => {
    // Arrange
    initWords()

    // Act
    button('rest').click()
    await finish()
    button('dot').click()
    await finish()

    // Assert: a quarter and a rest twice, 4 s; a dotted half and a quarter, 4 s
    expect(readings('rest')).toEqual(['1 s', '1 s', '1 s', '1 s'])
    expect(count('rest', '.rb-cell.is-rest')).toBe(2)
    expect(readings('dot')).toEqual(['3 s', '1 s'])
    expect(booked.notes.map(dur)).toEqual([
      heldSeconds(1, 60),
      heldSeconds(1, 60),
      heldSeconds(3, 60),
      heldSeconds(1, 60),
    ])
  })

  it("sets the tie's second pair a beat after the first, tied below its heads, one sound of 2 s", async () => {
    // Arrange
    initWords()
    const cellX = (i: number): number =>
      Number(
        fig('tie').querySelectorAll('.rb-cell-box')[i]?.getAttribute('x') ??
          NaN,
      )

    // Act
    button('tie').click()
    await finish()

    // Assert (FACTS 29, 65): 2 s, a beat's pause, 2 s, read 1 s, 1 s, then 2 s
    const beat = cellX(1) - cellX(0)
    expect(cellX(2) - cellX(1)).toBeCloseTo(2 * beat, 0)
    expect(readings('tie')).toEqual(['1 s', '1 s', '2 s'])
    expect(booked.notes.map(dur)).toEqual([
      heldSeconds(1, 60),
      heldSeconds(1, 60),
      heldSeconds(2, 60),
    ])
    expect(booked.wood).toHaveLength(5)
    const tie = fig('tie').querySelector('.rb-tie')
    const d = tie?.getAttribute('d') ?? ''
    const m = /M [\d.-]+ ([\d.-]+) Q [\d.-]+ ([\d.-]+)/.exec(d)
    expect(Number(m?.[2])).toBeGreaterThan(Number(m?.[1]))
    expect(tie?.classList.contains('is-hidden')).toBe(false)
    expect(words(el('[data-words-said]'))).toBe(WORD_LINES.tie)
  })

  it('keeps a figure written across its plays', async () => {
    // Arrange
    initWords()
    button('dot').click()
    await finish()

    // Act
    button('dot').click()

    // Assert
    expect(written('dot')).toEqual([0, 1])
  })

  it("sings at the higher voice's A for a viewer who chose it", async () => {
    // Arrange
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')
    initWords()

    // Act
    button('dot').click()
    await finish()

    // Assert
    expect(booked.notes.map((a) => a[0])).toEqual([hz(A4), hz(A4)])
  })
})

describe('one sound at a time', () => {
  it("stops a word when another sound takes the page's owner, its button put out", async () => {
    // Arrange
    initWords()
    button('value').click()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(lit('value')).toBe(false)
    expect(words(el('[data-words-said]'))).toBe('')
  })

  it("stops one word's play when another word's starts", async () => {
    // Arrange
    initWords()
    button('value').click()

    // Act
    button('tie').click()
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect([lit('value'), lit('tie')]).toEqual([false, true])
  })

  it('ignores a press of the word already playing', () => {
    // Arrange
    initWords()
    button('rest').click()

    // Act
    button('rest').click()

    // Assert
    expect(runs).toHaveLength(1)
    expect(runs[0].stopped).toBe(false)
  })
})
