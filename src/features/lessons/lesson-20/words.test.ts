// ============================================================
// Lesson 20 four words tests — each figure lit as its sound plays
// ============================================================
//
// On the page's own markup (WEB-SPEC, Toys 4; FACTS 28): Run is Merc's run
// slowly, D3 at 0.6 s a note, 5.40 s, on nine beads strung together, each
// lit as its note sounds; Pentatonic scale is C4, D4, E4, G4, A4 and C5 on
// the five-note staircase, Minor pentatonic A3, C4, D4, E4, G4 and A4 on
// the same staircase with the house on A, each in the soft tone at 0.45 s
// a note with the last 0.9 s, 3.15 s; Agility has no play and no figure.
// The plays are the same for everyone, each says its line once heard, and
// each is the page's one sound. The run sounds through the kit's runs,
// here the recorder; the staircases through `Sound.voice`, on fake timers.

import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { MAJOR_FIVE, MINOR_FIVE } from '@/features/lessons/kit/stairs-scales'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { initWords, wordSaid } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

let voices: MockInstance<typeof Sound.voice>

beforeEach(() => {
  resetRuns()
  soundOn()
  voices = vi.spyOn(Sound, 'voice').mockReturnValue(null)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  loadPage()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  VoiceChoice.set('lower')
  document.body.textContent = ''
})

const play = (word: string) =>
  el<HTMLButtonElement>(`#words [data-word-play="${word}"]`)
const lit = (word: string) => play(word).classList.contains('is-on')
const said = () => words(el('[data-words-said]'))

/** The MIDI notes the staircases have sounded so far, in order. */
const sounded = (): number[] =>
  voices.mock.calls.map(([f]) => Math.round(69 + 12 * Math.log2(f / 440)))

describe('the four words', () => {
  it('draws the run as nine beads on their string, and the five-note staircase on C4 and from A3, every figure hidden from a screen reader', () => {
    // Act
    const w = initWords()

    // Assert
    expect(w.run.degrees).toHaveLength(9)
    expect(w.run.every).toBe(0.6)
    expect(w.run.chart.scene.beads).toEqual({ string: true })
    const rungs = w.run.chart.scene.rungs ?? []
    expect(rungs).toHaveLength(9)
    expect(rungs.some((r) => r.faint === true)).toBe(false)
    expect([w.stairs.pentatonic.tonic, w.stairs.pentatonic.degrees]).toEqual([
      60,
      MAJOR_FIVE,
    ])
    expect([w.stairs.minor.tonic, w.stairs.minor.degrees]).toEqual([
      57,
      MINOR_FIVE,
    ])
    for (const canvas of document.querySelectorAll(
      '#words [data-word-fig] canvas',
    ))
      expect(canvas.getAttribute('aria-hidden')).toBe('true')
  })

  it("plays Run as Merc's run slowly, D3 at 0.6 s a note, 5.40 s, each bead lit as its note sounds, and says so once heard", async () => {
    // Arrange
    const w = initWords()
    const glow = vi.spyOn(w.run, 'glow')

    // Act
    play('run').click()
    const during = [lit('run'), said()]
    const [line, beads] = runs
    beads.note(0)
    beads.note(8)
    line.end(true)
    beads.end(true)
    await settle()

    // Assert: FACTS 28
    expect(line.o).toMatchObject({ audible: true, kind: 'merc' })
    expect(line.points[0].hz).toBeCloseTo(hz(50), 9)
    expect(line.points[line.points.length - 1].t).toBeCloseTo(5.4, 9)
    expect(beads.o.audible).toBe(false)
    expect(beads.notes.map((n) => n.t)).toEqual([
      0, 0.6, 1.2, 1.8, 2.4, 3, 3.6, 4.2, 4.8,
    ])
    expect(glow.mock.calls.map(([i]) => i)).toEqual([0, 8])
    expect(during).toEqual([true, ''])
    expect(lit('run')).toBe(false)
    expect(said()).toBe("Merc's run, slowly: a note every 0.6 seconds.")
  })

  it('plays Pentatonic scale as C4, D4, E4, G4, A4 and C5 in the soft tone, 0.45 s a note with the last 0.9 s, and says the scale once heard', async () => {
    // Arrange
    initWords()

    // Act
    play('pentatonic').click()
    await vi.advanceTimersByTimeAsync(3200)
    await settle()

    // Assert
    expect(sounded()).toEqual([60, 62, 64, 67, 69, 72])
    expect(voices.mock.calls.map(([, o]) => o?.dur)).toEqual([
      0.45, 0.45, 0.45, 0.45, 0.45, 0.9,
    ])
    expect(voices.mock.calls.every(([, o]) => o?.kind === undefined)).toBe(true)
    expect(lit('pentatonic')).toBe(false)
    expect(said()).toBe(
      'C major pentatonic: C, D, E, G, A, C. Steps of 2, 2, 3, 2 and 3 semitones.',
    )
  })

  it('plays Minor pentatonic as A3, C4, D4, E4, G4 and A4, 3.15 s, the house on A', async () => {
    // Arrange
    initWords()

    // Act
    play('minor').click()
    await vi.advanceTimersByTimeAsync(3200)
    await settle()

    // Assert
    expect(sounded()).toEqual([57, 60, 62, 64, 67, 69])
    expect(said()).toBe(
      'A minor pentatonic: A, C, D, E, G, A. Steps of 3, 2, 2, 3 and 2 semitones.',
    )
    expect(wordSaid('agility')).toBe('')
  })

  it('gives Agility no play and no figure', () => {
    // Act
    initWords()

    // Assert
    const agility = el('#words [data-word="agility"]')
    expect(agility.querySelector('[data-word-play]')).toBeNull()
    expect(agility.querySelector('[data-word-fig]')).toBeNull()
  })

  it('plays the same for the higher voice', async () => {
    // Arrange
    VoiceChoice.set('higher')
    initWords()

    // Act
    play('run').click()
    play('pentatonic').click()
    await vi.advanceTimersByTimeAsync(3200)

    // Assert
    expect(runs[0].points[0].hz).toBeCloseTo(hz(50), 9)
    expect(sounded()[0]).toBe(60)
  })

  it("stops one word's play when another word's starts, the first saying nothing", async () => {
    // Arrange
    initWords()
    play('run').click()

    // Act
    play('minor').click()
    await vi.advanceTimersByTimeAsync(3200)
    await settle()

    // Assert
    expect(runs.every((r) => r.stopped)).toBe(true)
    expect(lit('run')).toBe(false)
    expect(sounded()).toHaveLength(6)
    expect(said()).toMatch(/^A minor pentatonic/)
  })

  it("stops a staircase's play when another sound takes the page, its button put out and nothing said", async () => {
    // Arrange
    initWords()
    play('pentatonic').click()
    await vi.advanceTimersByTimeAsync(1000)

    // Act
    NowPlaying.claim(() => undefined)
    await vi.advanceTimersByTimeAsync(3000)
    await settle()

    // Assert
    expect(sounded()).toEqual([60, 62, 64])
    expect(lit('pentatonic')).toBe(false)
    expect(said()).toBe('')
  })
})
