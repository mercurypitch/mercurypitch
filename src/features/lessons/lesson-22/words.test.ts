// ============================================================
// Lesson 22 four words tests — each word's band, its play, and its line as it sounds
// ============================================================
//
// On the page's own markup, with the kit's runs a recorder (WEB-SPEC, Toys
// 4; FACTS 70): each ticket's stub is a band chart round its word's note,
// as wide as its play, with no line at its centre and none drawn before a
// press; a press plays the word's breaths, each with its own wave or none,
// and draws its line from the same schedule, whole at once under reduced
// motion, from its start as it sounds with motion on; a line cut short by
// another sound keeps what it drew; with sound off the line still draws;
// and the words are the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { A3, D3, WORDS } from './sounds'
import type { Words } from './words'
import { initWords } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
// reduced motion, as the doubles set it, unless a test draws a line as it
// sounds; the doubles go in first, since the switch reads the setting as it loads
vi.mock('@/features/lessons/kit/motion-switch', async (actual) => {
  await import('@/features/lessons/kit/browser-doubles.test-fixtures')
  return {
    ...(await actual<typeof MotionModule>()),
    reducedMotion: vi.fn(() => true),
  }
})

beforeEach(() => {
  resetRuns()
  soundOn()
  vi.mocked(reducedMotion).mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** The page's markup with the four words mounted, as main.ts mounts them. */
function mountWords(): Words {
  loadPage()
  return initWords()
}

const button = (w: string) =>
  el<HTMLButtonElement>(`#words [data-word-play="${w}"]`)
const lit = (w: string) => button(w).classList.contains('is-on')

describe("each word's band", () => {
  it("stands round its word's note, as wide as its play, with no line at its centre and none drawn before a press", () => {
    // Act
    const { charts } = mountWords()

    // Assert: Rate and Extent are two 2.0 s notes, 0.4 s apart
    expect(
      Object.values(charts).map((c) => [c.window, c.scene.wave ?? null]),
    ).toEqual([
      [2.5, null],
      [4.4, null],
      [4.4, null],
      [2, null],
    ])
    expect(Object.keys(charts)).toEqual([
      'vibrato',
      'rate',
      'extent',
      'straight',
    ])
  })
})

describe('a press', () => {
  it('plays Rate as two breaths, five swings a second and then seven, 0.4 s apart, and lands its line whole under reduced motion', async () => {
    // Arrange
    const { charts } = mountWords()

    // Act
    button('rate').click()
    await settle()

    // Assert: FACTS 70
    expect(runs[0].kind).toBe('lines')
    expect(runs[0].lines.map((l) => [l.t, l.vibrato])).toEqual([
      [0, { rate: 5, extent: 30, growIn: 0.3 }],
      [2.4, { rate: 7, extent: 30, growIn: 0.3 }],
    ])
    expect(runs[0].lines[0].points[0].hz).toBeCloseTo(hz(A3), 9)
    expect(charts.rate.scene.wave).toEqual({
      stretches: WORDS.rate.play.line,
      upTo: 4.4,
    })
    expect(lit('rate')).toBe(true)
  })

  it('plays Straight note on D3 with no wave, a level line through its band', async () => {
    // Arrange
    const { charts } = mountWords()

    // Act
    button('straight').click()
    await settle()
    runs[0].end(true)
    await settle()

    // Assert: 146.83 Hz, the page's lowest sound
    expect(runs[0].lines.map((l) => [l.t, l.vibrato])).toEqual([[0, null]])
    expect(runs[0].lines[0].points[0].hz).toBeCloseTo(hz(D3), 9)
    expect(hz(D3)).toBeCloseTo(146.83, 2)
    expect(charts.straight.scene.wave?.stretches).toEqual([
      { kind: 'level', from: 0, to: 2, c: 0 },
    ])
    expect(lit('straight')).toBe(false)
  })

  it('draws the line all the same with sound off, its run silent', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    const { charts } = mountWords()

    // Act
    button('vibrato').click()
    await settle()

    // Assert
    expect(runs[0].o.audible).toBe(false)
    expect(charts.vibrato.scene.wave?.upTo).toBe(2.5)
  })
})

describe('with motion on', () => {
  beforeEach(() => {
    vi.mocked(reducedMotion).mockReturnValue(false)
  })

  it('draws the line from its start as it sounds, and keeps what it drew when another word cuts it short', async () => {
    // Arrange
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10_000)
    const { charts } = mountWords()
    button('extent').click()
    await settle()
    const started = charts.extent.scene.wave?.upTo

    // Act: Vibrato pressed 1.5 s in
    clock.mockReturnValue(11_500)
    button('vibrato').click()
    await settle()

    // Assert
    expect(started).toBe(0)
    expect(runs[0].stopped).toBe(true)
    expect(charts.extent.scene.wave?.upTo).toBeCloseTo(1.5, 6)
    expect(lit('extent')).toBe(false)
    expect(charts.vibrato.scene.wave?.upTo).toBe(0)
    expect(lit('vibrato')).toBe(true)
  })
})

describe('one sound at a time', () => {
  it('stops a word when another sound on the page starts, its button put out', async () => {
    // Arrange
    mountWords()
    button('vibrato').click()
    await settle()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(lit('vibrato')).toBe(false)
  })

  it('stops any sound before it, anywhere on the page', async () => {
    // Arrange
    mountWords()
    let other = false
    NowPlaying.claim(() => {
      other = true
    })

    // Act
    button('extent').click()
    await settle()

    // Assert
    expect(other).toBe(true)
    expect(runs).toHaveLength(1)
  })
})
