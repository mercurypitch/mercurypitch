// ============================================================
// Lesson 11 four words tests — each word heard, its figure lit in turn
// ============================================================
//
// WEB-SPEC, Toys 3 and Tests 14, on the page's own markup, its runs
// recorded (kit/run-recorder.test-fixtures.ts): Register sings one note in
// each gear, Chest voice the lower gear alone and Head voice the upper
// alone, and Flip the cold open's up half in both, at the stored voice's
// notes; each line of a figure lights while its gear sounds; each play is
// the page's one sound, so a word stops a step's slide, and a newer sound
// stops the word, both of its gears.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { contourLength } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { N } from './lines'
import { el, mountSteps, settle, soundOn } from './page-dom.test-fixtures'
import { initWords, LIT } from './words'

const duo = vi.hoisted(() => ({ sing: vi.fn() }))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
}))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const play = (word: string): void =>
  el(`#words [data-word-play="${word}"]`).click()
const lamps = (word: string): string[] =>
  [
    ...document.querySelectorAll<SVGElement>(
      `[data-word="${word}"] [data-lamp]`,
    ),
  ].map((l) => l.style.filter)

beforeEach(() => {
  resetRuns()
  soundOn()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  VoiceChoice.set('lower')
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 11's four words", () => {
  it.each([
    ['register', [false, true], 4.3],
    ['chest', [false], 2],
    ['head', [true], 2],
    ['flip', [false, true], 4],
  ] as const)(
    'sings %s in its gears, upper %j, for %s s',
    async (word, upper, seconds) => {
      // Arrange
      mountSteps()
      initWords()

      // Act
      play(word)
      await settle()

      // Assert
      expect(runs.map((r) => r.o.wave === 'soft')).toEqual(upper)
      for (const r of runs)
        expect(contourLength(r.points)).toBeCloseTo(seconds, 6)
    },
  )

  it("lights Register's thick line for its lower note, then its thin line for its upper", async () => {
    // Arrange
    mountSteps()
    initWords()

    // Act
    play('register')
    await settle()
    vi.advanceTimersByTime(1)
    const first = lamps('register')
    vi.advanceTimersByTime(2100)
    const between = lamps('register')
    vi.advanceTimersByTime(300)
    const second = lamps('register')

    // Assert
    expect(first).toEqual([LIT, ''])
    expect(between).toEqual(['', ''])
    expect(second).toEqual(['', LIT])
  })

  it('sets the Merc of the voice singing while a word sounds', async () => {
    // Arrange
    mountSteps()
    initWords()

    // Act
    play('head')
    await settle()
    const during = duo.sing.mock.calls.at(-1)
    runs[0].end(true)
    await settle()

    // Assert
    expect(during).toEqual(['blue', N.Gs3, true])
    expect(duo.sing.mock.calls.at(-1)).toEqual(['blue', N.Gs3, false])
  })

  it('sings the stored voice: the higher voice at F sharp 4', async () => {
    // Arrange
    mountSteps()
    initWords()
    VoiceChoice.set('higher')

    // Act
    play('chest')
    await settle()

    // Assert
    expect(runs[0].points[0].hz).toBeCloseTo(hz(N.Fs4), 9)
  })

  it("stops a step's slide, both its gears, and is stopped by a newer sound", async () => {
    // Arrange
    const deck = mountSteps()
    initWords()
    deck.show(3)
    el<HTMLButtonElement>('#toyRange [data-slide-n="0"]').click()

    // Act
    play('flip')
    await settle()
    const slide = runs.slice(0, 2).map((r) => r.stopped)
    el<HTMLButtonElement>('#toyRange [data-slide-n="1"]').click()
    await settle()

    // Assert
    expect(slide).toEqual([true, true])
    expect(runs.slice(2, 4).map((r) => r.stopped)).toEqual([true, true])
    expect(lamps('flip')).toEqual(['', ''])
    expect(
      el('#words [data-word-play="flip"]').classList.contains('is-on'),
    ).toBe(false)
  })
})
