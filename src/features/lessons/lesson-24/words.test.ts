// ============================================================
// Lesson 24 four words tests — each figure, its play, and its drawing as it sounds
// ============================================================
//
// On the page's own markup, with the kit's runs a recorder (WEB-SPEC, Toys
// 4; FACTS 46, 68, 71): Drone's chart stands empty before its first press,
// and its band draws across as A3 sounds alone for 3.0 s, whole at once
// under reduced motion, from its start with motion on, one cut short
// keeping what it drew; Harmonic plays A3's six harmonics as plain tones,
// one at a time, 0.9 s each, each rung lighting in its turn; Equal-tempered
// plays A3 up to A4 in semitones, 0.3 s each and the last 0.6 s; Pure's
// band and its line at 330 Hz stand still, its play held under its lock
// line until the cold open's choice, then sounding the pure fifth for 3.0
// s, glowing steadily; with sound off the figures still draw; and the
// words are the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { brightness } from '@/features/lessons/kit/drone-beats'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { DRONE_HZ, NOTE_GAIN, schedulesOf, WORD_PURE, WORDS } from './sounds'
import type { Words } from './words'
import { DRONE_SPAN, initWords, PURE_SPAN, rungAt } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
// reduced motion, as the doubles set it, unless a test draws as it sounds;
// the doubles go in first, since the switch reads the setting as it loads
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
const lock = () => el('#words [data-word-lock]')

/** Each voice of the latest run: its start, its first frequency, its length. */
const voices = () =>
  runs[runs.length - 1].lines.map((l) => [
    l.t,
    l.points[0].hz,
    (l.points.at(-1)?.t ?? 0) - l.points[0].t,
  ])

describe('at rest', () => {
  it("stands Drone's chart empty, 3 s across, and Pure's band and its line at 330 Hz still", () => {
    // Act
    const { charts } = mountWords()

    // Assert
    const drone = charts.drone
    expect([drone.window, drone.lo, drone.hi]).toEqual([3, ...DRONE_SPAN])
    expect(drone.scene.drone?.drone).toEqual({
      c: 0,
      as: 'band',
      label: 'drone · A3',
      upTo: 0,
    })
    expect(drone.scene.drone?.bright).toBeNull()
    const pure = charts.pure
    expect([pure.window, pure.lo, pure.hi]).toEqual([3, ...PURE_SPAN])
    expect(pure.scene.drone?.drone).toEqual({
      c: 0,
      as: 'band',
      label: 'drone · A3',
    })
    expect(pure.scene.drone?.tops).toEqual([
      {
        stretches: [
          { kind: 'level', from: 0, to: 3, c: expect.closeTo(701.955, 3) },
        ],
        upTo: 3,
      },
    ])
    expect(pure.scene.drone?.bright).toBeNull()
  })

  it("stands Harmonic's six rungs and Equal-tempered's thirteen unlit, their ends named", () => {
    // Act
    const { rungs } = mountWords()

    // Assert
    expect(rungs.harmonic()).toEqual({
      n: 6,
      lit: null,
      ends: ['220 Hz', '1,320 Hz'],
    })
    expect(rungs.tempered()).toEqual({ n: 13, lit: null, ends: ['A3', 'A4'] })
  })

  it("holds Pure's play under its lock line until the cold open's choice", () => {
    // Arrange
    mountWords()

    // Act
    button('pure').click()

    // Assert: FACTS 46; nothing plays the still fifth before the choice
    expect(button('pure').disabled).toBe(true)
    expect(runs).toHaveLength(0)
    expect(lock().hidden).toBe(false)
    expect(words(lock())).toBe('Choose an answer at the top to hear this.')
  })
})

describe('a press', () => {
  it("plays Drone, A3 alone for 3.0 s in the drone's tone, and lands its band whole under reduced motion", async () => {
    // Arrange
    const { charts } = mountWords()

    // Act
    button('drone').click()
    await settle()
    const sounding = charts.drone.scene.drone
    runs[0].end(true)
    await settle()

    // Assert: FACTS 68
    expect(runs[0].kind).toBe('lines')
    expect(voices()).toEqual([[0, DRONE_HZ, 3]])
    expect([runs[0].o.kind, runs[0].o.gain, runs[0].o.vibrato]).toEqual([
      'merc',
      NOTE_GAIN,
      null,
    ])
    expect(sounding?.drone.upTo).toBe(3)
    expect(sounding?.bright).toEqual({ slow: null, fast: null })
    expect(charts.drone.scene.drone?.drone.upTo).toBe(3)
    expect(charts.drone.scene.drone?.bright).toBeNull()
  })

  it("plays Harmonic, A3's six harmonics as plain tones, one at a time, 0.9 s each", async () => {
    // Arrange
    mountWords()

    // Act
    button('harmonic').click()
    await settle()

    // Assert: FACTS 68, 220 to 1,320 Hz
    expect(voices()).toEqual(
      [0, 0.9, 1.8, 2.7, 3.6, 4.5].map((t, i) => [t, 220 * (i + 1), 0.9]),
    )
    expect(runs[0].o.kind).toBe('soft')
  })

  it('plays Equal-tempered, A3 up to A4 in semitones, 0.3 s each and the last 0.6 s', async () => {
    // Arrange
    mountWords()

    // Act
    button('tempered').click()
    await settle()

    // Assert: FACTS 68, 4.2 s in all
    const v = voices()
    expect(v.map(([t]) => t)).toEqual(
      Array.from({ length: 13 }, (_, i) => Math.round(i * 300) / 1000),
    )
    expect(v.map(([, , d]) => d)).toEqual([...Array<number>(12).fill(0.3), 0.6])
    expect(v[0][1]).toBe(220)
    expect(v[12][1]).toBeCloseTo(440, 9)
    for (let i = 1; i < 13; i++)
      expect(1200 * Math.log2(v[i][1] / v[i - 1][1])).toBeCloseTo(100, 9)
    expect(WORDS.tempered.sec).toBe(4.2)
  })

  it("plays Pure once the cold open's choice is in: A3 with E4 at exactly 330 Hz for 3.0 s, its lock line gone", async () => {
    // Arrange
    const w = mountWords()

    // Act
    w.unlockPure()
    button('pure').click()
    await settle()

    // Assert: FACTS 46, 68
    expect(lock().hidden).toBe(true)
    expect(voices()).toEqual([
      [0, DRONE_HZ, 3],
      [0, 330, 3],
    ])
    expect(runs[0].o.kind).toBe('merc')
  })

  it('still draws with sound off, its run silent', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    const { charts } = mountWords()

    // Act
    button('drone').click()
    await settle()

    // Assert
    expect(runs[0].o.audible).toBe(false)
    expect(charts.drone.scene.drone?.drone.upTo).toBe(3)
  })
})

describe('the rungs as they sound', () => {
  it("light one at a time, each from its tone's start, and none once the play is over", async () => {
    // Arrange
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10_000)
    const { rungs } = mountWords()

    // Act: Harmonic pressed at 10 s, read at 10, 11, 14.6 and 15.4 s
    button('harmonic').click()
    const seen: (number | null)[] = []
    for (const ms of [10_000, 11_000, 14_600, 15_400]) {
      clock.mockReturnValue(ms)
      seen.push(rungs.harmonic().lit)
    }
    runs[0].end(true)
    await settle()

    // Assert
    expect(seen).toEqual([0, 1, 5, null])
    expect(rungs.harmonic().lit).toBeNull()
  })

  it("light Equal-tempered's last rung through its longer note, from the schedule", () => {
    // Assert
    expect(
      [0, 0.29, 0.3, 3.59, 3.6, 4.19, 4.2].map((t) =>
        rungAt(WORDS.tempered, t),
      ),
    ).toEqual([0, 0, 1, 11, 12, 12, null])
  })
})

describe('with motion on', () => {
  beforeEach(() => {
    vi.mocked(reducedMotion).mockReturnValue(false)
  })

  it("draws Drone's band from its start as A3 sounds, and keeps what a play cut short drew", async () => {
    // Arrange
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10_000)
    const { charts } = mountWords()

    // Act: cut short 1.2 s in by another sound
    button('drone').click()
    const started = charts.drone.scene.drone?.drone.upTo
    clock.mockReturnValue(11_200)
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(started).toBe(0)
    expect(runs[0].stopped).toBe(true)
    expect(charts.drone.scene.drone?.drone.upTo).toBeCloseTo(1.2, 6)
    expect(lit('drone')).toBe(false)
  })

  it("glows Pure's band and line steadily while the pure fifth sounds, since it does not beat", async () => {
    // Arrange
    vi.spyOn(performance, 'now').mockReturnValue(10_000)
    const w = mountWords()
    w.unlockPure()

    // Act
    button('pure').click()
    const glow = w.charts.pure.scene.drone?.bright
    runs[0].end(true)
    await settle()

    // Assert: the same brightness all through, the fifth's harmonics meeting exactly
    expect(glow?.slow).toEqual(expect.any(Number))
    expect(glow?.fast).toBeNull()
    for (const t of [0.5, 1.25, 2.9])
      expect(brightness(schedulesOf(WORD_PURE), t)).toEqual({
        slow: expect.closeTo(glow?.slow ?? NaN, 9),
        fast: null,
      })
    expect(w.charts.pure.scene.drone?.bright).toBeNull()
  })
})

describe('one sound', () => {
  it('stops one word for another, and a word for any newer sound on the page, its button put out', async () => {
    // Arrange
    mountWords()
    button('drone').click()
    await settle()

    // Act
    button('harmonic').click()
    await settle()
    const first = runs[0].stopped
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(first).toBe(true)
    expect(runs[1].stopped).toBe(true)
    expect([lit('drone'), lit('harmonic')]).toEqual([false, false])
  })
})
