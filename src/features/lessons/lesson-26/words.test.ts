// ============================================================
// Lesson 26 words tests — three words, their notes, their timing and their figures
// ============================================================
//
// The WEB-SPEC's Toys 3 and FACTS 37 to 39 and 76: Part, do re mi re do on
// C4, 3.0 s, then again with mi fa so fa mi above it, 6.0 s in all; Chord
// note, C3, E3 and G3 held 3.0 s at the kit's chord level, E4 joining at
// 1.5 s, gold; Passing note, E4, F4 and G4 a second each over the same
// chord, F hollow; none names a copy moved four semitones or a third's
// size; each figure drawing its beads as they sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { CHORD_GAIN } from '@/features/lessons/kit/sound'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { spoken } from './parts'
import type { WordNote } from './words'
import { initWords, WORD_BEADS, WORD_IDS, WORD_SAID, wordNotes } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

/** A word's notes, each with its onset and length: "0+0.5 C 4". */
const heard = (notes: readonly WordNote[]): string[] =>
  notes.map((n) => `${n.t}+${n.dur} ${spoken(n.midi)}`)

/** How each bead of a word's figure shows. */
const beads = (w: string): (string | undefined)[] =>
  Array.from(
    el(`[data-word-fig="${w}"]`).querySelectorAll<SVGElement>('.w-bead'),
    (b) => b.dataset.state,
  )

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  loadPage()
  soundOn()
  resetRuns()
})

afterEach(() => {
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe('the three words', () => {
  it('plays do re mi re do on C4, 3.0 s, then again with mi fa so fa mi above it, 6.0 s in all (FACTS 76)', () => {
    // Act
    const notes = wordNotes('part')

    // Assert
    expect(heard(notes)).toEqual([
      '0+0.5 C 4',
      '0.5+0.5 D 4',
      '1+0.5 E 4',
      '1.5+0.5 D 4',
      '2+1 C 4',
      '3+0.5 C 4',
      '3+0.5 E 4',
      '3.5+0.5 D 4',
      '3.5+0.5 F 4',
      '4+0.5 E 4',
      '4+0.5 G 4',
      '4.5+0.5 D 4',
      '4.5+0.5 F 4',
      '5+1 C 4',
      '5+1 E 4',
    ])
    // the tune's beads, then the part's, each note on its own
    expect(notes.map((n) => n.bead)).toEqual([
      0, 1, 2, 3, 4, 0, 5, 1, 6, 2, 7, 3, 8, 4, 9,
    ])
  })

  it("holds C3, E3 and G3 for 3.0 s at the kit's chord level, E4 joining at 1.5 s on a gold bead (FACTS 76)", () => {
    // Act
    const notes = wordNotes('chord')

    // Assert
    expect(heard(notes)).toEqual([
      '0+3 C 3',
      '0+3 E 3',
      '0+3 G 3',
      '1.5+1.5 E 4',
    ])
    expect(notes.slice(0, 3).every((n) => n.gain === CHORD_GAIN)).toBe(true)
    expect(notes[3].gain).toBeUndefined()
    expect(WORD_BEADS.chord.map((b) => b.gold === true)).toEqual([
      false,
      false,
      false,
      true,
    ])
  })

  it('steps E4, F4 and G4 a second each over the chord, F drawn hollow and E and G gold (FACTS 46, 76)', () => {
    // Act
    const notes = wordNotes('passing')

    // Assert
    expect(heard(notes)).toEqual([
      '0+3 C 3',
      '0+3 E 3',
      '0+3 G 3',
      '0+1 E 4',
      '1+1 F 4',
      '2+1 G 4',
    ])
    const steps = WORD_BEADS.passing.slice(3)
    expect(steps.map((b) => b.hollow === true)).toEqual([false, true, false])
    expect(steps.map((b) => b.gold === true)).toEqual([true, false, true])
  })

  it("names no copy moved four semitones and no third's size, in a ticket or its words (FACTS 1a, 37 to 39)", () => {
    // Act
    const text = [
      ...WORD_IDS.map((w) => WORD_SAID[w]),
      words(el('#words .tickets')),
    ].join(' ')

    // Assert
    expect(text).not.toMatch(
      /semitone|major third|minor third|leaves? the key|off the key/i,
    )
  })
})

describe('the figures', () => {
  it('draws each bead as its note starts, lit while it sounds, and says the word once heard', async () => {
    // Arrange
    initWords()
    const rest = beads('chord')

    // Act
    el<HTMLButtonElement>('[data-word-play="chord"]').click()
    await settle()
    const r = runs[runs.length - 1]
    const cleared = beads('chord')
    for (let i = 0; i < 4; i++) r.note(i)
    const sounding = beads('chord')
    vi.advanceTimersByTime(3000)
    const after = beads('chord')
    r.end(true)
    await settle()

    // Assert
    expect(rest).toEqual(['rest', 'rest', 'rest', 'rest'])
    expect(cleared).toEqual(['off', 'off', 'off', 'off'])
    expect(sounding).toEqual(['lit', 'lit', 'lit', 'gold'])
    expect(after).toEqual(['drawn', 'drawn', 'drawn', 'drawn'])
    expect(beads('chord')).toEqual(['rest', 'rest', 'rest', 'rest'])
    expect(words(el('[data-words-said]'))).toBe(WORD_SAID.chord)
  })

  it('says nothing for a play cut short, its figure back at rest', async () => {
    // Arrange
    initWords()
    el<HTMLButtonElement>('[data-word-play="part"]').click()
    await settle()
    const part = runs[runs.length - 1]
    part.note(0)

    // Act: a newer sound
    el<HTMLButtonElement>('[data-word-play="passing"]').click()
    await settle()

    // Assert
    expect(part.stopped).toBe(true)
    expect(beads('part').every((s) => s === 'rest')).toBe(true)
    expect(words(el('[data-words-said]'))).toBe('')
  })
})
