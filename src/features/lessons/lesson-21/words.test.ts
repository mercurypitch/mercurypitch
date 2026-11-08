// ============================================================
// Lesson 21 four words tests — four figures, each lit as its sound plays, one sound
// ============================================================
//
// On the page's own markup (WEB-SPEC, Toys 6; FACTS 62): Key plays G major
// from G3 on a small ring, G major's seven beads lit at rest with no
// thread, each bead lit and threaded to the one before as it sounds; Key
// signature plays G major in the learner's clef on a small staff carrying
// one sharp, each note written as it sounds, F sharp with no sign of its
// own and the signature's sharp lit with it; Circle of fifths plays C3, G3,
// D4 and A4 as the house steps round four beads named C, G, D and A, and
// names no sharp (FACTS 1a); Equal temperament plays C4 up to C5 in
// semitones on thirteen tiles of one width, each lit as it sounds; the
// staff follows Sing it's voice choice; and every play is the page's one
// sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { angleOf } from '@/features/lessons/kit/circle-geometry'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { circleScene, initWords, keyScene, TILES, WORD_IDS, wordNotes, } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  VoiceChoice.set('lower')
  loadPage()
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.textContent = ''
})

const fig = (w: string): SVGSVGElement =>
  el<SVGSVGElement>(`[data-word-fig="${w}"]`)
const count = (w: string, sel: string): number =>
  fig(w).querySelectorAll(sel).length
const press = (w: string): void =>
  el<HTMLButtonElement>(`[data-word-play="${w}"]`).click()
const last = () => runs[runs.length - 1]
const end = (): number =>
  Math.round(Math.max(...last().notes.map((n) => n.t + n.dur)) * 1000) / 1000

describe('the four plays', () => {
  it('plays each word as FACTS 62 has it: G major from G3, G major on the staff, C, G, D and A, and thirteen semitones', () => {
    // Assert
    const midis = (w: (typeof WORD_IDS)[number], clef: 'bass' | 'treble') =>
      wordNotes(w, clef).map((n) => n.midi)
    expect(midis('key', 'bass')).toEqual([55, 57, 59, 60, 62, 64, 66, 67])
    expect(midis('key', 'treble')).toEqual(midis('key', 'bass'))
    expect(midis('signature', 'bass')).toEqual([43, 45, 47, 48, 50, 52, 54, 55])
    expect(midis('signature', 'treble')).toEqual([
      67, 69, 71, 72, 74, 76, 78, 79,
    ])
    expect(midis('circle', 'bass')).toEqual([48, 55, 62, 69])
    expect(midis('equal', 'bass')).toEqual(
      Array.from({ length: TILES }, (_, i) => 60 + i),
    )
  })

  it('times them so: 3.15 s for each scale, 2.3 s for the circle and 3.85 s for the semitones', () => {
    // Arrange
    initWords()
    const timed: Record<string, [number[], number[], number]> = {}

    // Act
    for (const w of WORD_IDS) {
      press(w)
      timed[w] = [
        last().notes.map((n) => n.t),
        [...new Set(last().notes.map((n) => n.dur))],
        end(),
      ]
    }

    // Assert
    expect(timed.key).toEqual([
      [0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8],
      [0.35],
      3.15,
    ])
    expect(timed.signature[2]).toBe(3.15)
    expect(timed.circle).toEqual([[0, 0.6, 1.2, 1.8], [0.5], 2.3])
    expect(timed.equal[1]).toEqual([0.25])
    expect(timed.equal[2]).toBe(3.85)
    expect(last().o.kind).toBe('soft')
  })

  it("is the page's one sound: a newer sound stops it, and its figure goes dark", () => {
    // Arrange
    initWords()
    press('circle')
    last().note(1)
    const lit = count('circle', 'circle.ci-bead.is-lit')

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(lit).toBe(1)
    expect(count('circle', 'circle.ci-bead.is-lit')).toBe(0)
  })
})

describe('Key', () => {
  it("lights G major's seven beads on the ring at rest, F sharp's large, with no thread", () => {
    // Act
    initWords()

    // Assert
    expect(count('key', 'circle.ci-bead')).toBe(12)
    expect(count('key', 'circle.ci-bead.is-lit')).toBe(6)
    expect(count('key', 'circle.ci-bead.is-key')).toBe(1)
    expect(count('key', '.ci-thread')).toBe(0)
    expect(count('key', 'text')).toBe(0)
  })

  it('lights each bead as its note sounds, threaded to the one before, and keeps the thread once the play ends', async () => {
    // Arrange
    initWords()
    press('key')

    // Act
    last().note(0)
    const first = count('key', '.ci-bead.is-lit, .ci-bead.is-key')
    for (let i = 1; i < 7; i++) last().note(i)
    const sixth = keyScene(7).thread
    last().note(7)
    last().end(true)
    await settle()

    // Assert: G, A, B, C, D, E, F sharp and G round the ring
    expect(first).toBe(1)
    expect(sixth).toEqual([7, 9, 11, 0, 2, 4, 6])
    expect(count('key', '.ci-thread')).toBe(1)
    expect(keyScene(8).thread).toEqual([7, 9, 11, 0, 2, 4, 6, 7])
  })
})

describe('Key signature', () => {
  it("carries G major's one sharp in the learner's clef, nothing written before a play", () => {
    // Act
    initWords()

    // Assert: the bass clef with the lower voice (FACTS 8)
    expect(count('signature', '.st-line')).toBe(5)
    expect(count('signature', '.st-keysign')).toBe(1)
    expect(count('signature', '.st-head')).toBe(0)
  })

  it("writes each note as it sounds, over the one before, F sharp with no sign of its own and the signature's sharp lit with it", () => {
    // Arrange
    initWords()
    press('signature')

    // Act: E, then F sharp
    last().note(5)
    const onE = [
      count('signature', '.st-head'),
      count('signature', '.st-keysign.is-blue'),
    ]
    last().note(6)

    // Assert
    expect(onE).toEqual([1, 0])
    expect(count('signature', '.st-head')).toBe(1)
    expect(count('signature', '.st-head.is-blue')).toBe(1)
    expect(count('signature', '.st-sign:not(.st-keysign)')).toBe(0)
    expect(count('signature', '.st-keysign.is-blue')).toBe(1)
  })

  it('lets the note and the sharp go dark as its sound ends, the note still written', () => {
    // Arrange
    vi.useFakeTimers()
    initWords()
    press('signature')
    last().note(6)

    // Act
    vi.advanceTimersByTime(360)

    // Assert
    expect(count('signature', '.st-head')).toBe(1)
    expect(count('signature', '.st-head.is-blue')).toBe(0)
    expect(count('signature', '.st-keysign.is-blue')).toBe(0)
  })

  it("follows Sing it's choice of the higher voice: the treble staff, written afresh, G4 to G5 in orange", async () => {
    // Arrange
    initWords()
    press('signature')
    last().note(2)

    // Act
    VoiceChoice.set('higher')
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(count('signature', '.st-head')).toBe(0)
    press('signature')
    expect(last().notes.map((n) => n.midi)[0]).toBe(67)
    last().note(6)
    expect(count('signature', '.st-keysign.is-orange')).toBe(1)
  })
})

describe('Circle of fifths', () => {
  it('names its four beads C, G, D and A, a fifth apart from C at the top, and no sharp (FACTS 1a)', () => {
    // Act
    initWords()

    // Assert
    expect(
      Array.from(fig('circle').querySelectorAll('text'), (t) => t.textContent),
    ).toEqual(['C', 'G', 'D', 'A'])
    expect(circleScene(0, false).beads.map((b) => b.angle)).toEqual(
      [0, 1, 2, 3].map(angleOf),
    )
    expect(fig('circle').textContent).not.toMatch(/♯|sharp/)
  })

  it('steps the house round as each key sounds, its bead lit while it sounds', () => {
    // Arrange
    initWords()
    press('circle')

    // Act
    last().note(2)

    // Assert: D, the third
    expect(circleScene(2, true).house).toBe(angleOf(2))
    expect(count('circle', '.ci-home')).toBe(1)
    expect(count('circle', 'circle.ci-bead.is-lit')).toBe(1)
    const lit = fig('circle').querySelector('circle.ci-bead.is-lit')
    const named = Array.from(fig('circle').querySelectorAll('text')).find(
      (t) => t.textContent === 'D',
    )
    expect(lit?.getAttribute('cx')).toBe(named?.getAttribute('x'))
  })
})

describe('Equal temperament', () => {
  it('draws thirteen tiles of one width, and lights each as its semitone sounds', () => {
    // Arrange
    initWords()
    const widths = Array.from(fig('equal').querySelectorAll('.et-tile'), (t) =>
      t.getAttribute('width'),
    )
    press('equal')

    // Act
    last().note(4)

    // Assert
    expect(widths).toHaveLength(TILES)
    expect(new Set(widths).size).toBe(1)
    const tiles = Array.from(fig('equal').querySelectorAll('.et-tile'))
    expect(
      tiles.flatMap((t, i) => (t.classList.contains('is-lit') ? [i] : [])),
    ).toEqual([4])
  })
})
