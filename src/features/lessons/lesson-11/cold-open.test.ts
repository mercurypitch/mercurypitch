// ============================================================
// Lesson 11 cold open tests — two sirens, the predict, heard means finished
// ============================================================
//
// WEB-SPEC, Tests 10 and 15, on the page's own markup, its runs recorded
// (kit/run-recorder.test-fixtures.ts) and Merc and Tavi's renderer left
// out. Before any play the compact chart holds Tavi's siren whole, its
// seam labelled "Merc's model". Play Tavi's siren works before a choice
// and never reveals; Merc's waits for a choice; the reveal waits until
// Merc's siren has been heard to its end with sound on, and a siren cut
// short, by another sound or a stop, counts as not heard and reveals
// nothing. At the reveal each seam's label reads "the switch", the key
// shows, and Tavi celebrates once. The live region speaks for each siren
// heard and for the reveal, in spoken names.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { contourLength, Sound } from '@/features/lessons/kit/sound'
import { COLD, initColdOpen } from './cold-open'
import { N } from './lines'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'

const duo = vi.hoisted(() => ({ sing: vi.fn(), celebrate: vi.fn() }))
const motion = vi.hoisted(() => ({ reduced: true }))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
  mercCelebrate: duo.celebrate,
}))

vi.mock('@/features/lessons/kit/motion-switch', async (actual) => ({
  ...(await actual<typeof MotionModule>()),
  reducedMotion: () => motion.reduced,
}))

const reveal = (): HTMLElement => el('#predict .reveal')
const hint = (): string => (el('#predict .lock-hint').textContent ?? '').trim()
const said = (): string => el('[data-hero-said]').textContent?.trim() ?? ''
const playBtn = (what: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const play = (what: string): void => playBtn(what).click()
const choose = (what: string): void =>
  el(`#predict [data-choice="${what}"]`).click()

/** Every run still going ends, heard to its end or cut short, as the kit's would. */
async function hear(heard = true): Promise<void> {
  live().forEach((r) => r.end(heard))
  await settle()
}

beforeEach(() => {
  resetRuns()
  soundOn()
  motion.reduced = true
  duo.sing.mockReset()
  duo.celebrate.mockReset()
  loadPage()
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 11's cold open, its chart", () => {
  it("holds Tavi's siren whole before any play, its seam labelled Merc's model", () => {
    // Act
    const cold = initColdOpen()

    // Assert
    const s = cold.chart.scene
    expect(s.lines).toHaveLength(1)
    expect(s.seams).toEqual([
      {
        lo: N.F4,
        hi: N.G4,
        label: "Merc's model",
        labelAt: 4.25,
        labelBelow: true,
      },
    ])
    expect(said()).toBe(COLD.still)
    expect(el('[data-hero-key]').hidden).toBe(true)
  })

  it("sings Tavi's siren in two gears, 8.5 s, and says what it drew", async () => {
    // Arrange
    initColdOpen()

    // Act
    play('orange')
    const lengths = runs.map((r) => contourLength(r.points))
    await hear()

    // Assert
    expect(lengths).toHaveLength(2)
    for (const s of lengths) expect(s).toBeCloseTo(8.5, 6)
    expect(said()).toBe(
      "Tavi's siren, from D 4 up to B 4 and back. The line jumps across the seam between F 4 and G 4 on the way up, and back on the way down.",
    )
    expect(duo.sing).toHaveBeenCalledWith('orange', N.D4, true)
  })
})

describe("Lesson 11's cold open, the predict", () => {
  it("plays Tavi's siren before a choice and never reveals, and keeps Merc's locked", async () => {
    // Arrange
    initColdOpen()

    // Act
    play('orange')
    await hear()

    // Assert
    expect(playBtn('blue').disabled).toBe(true)
    expect(reveal().hidden).toBe(true)
    expect(hint()).toBe("Choose an answer to unlock Merc's siren.")
  })

  it("shows the silent hint for Tavi's siren played with sound off, and the lock hint once heard", async () => {
    // Arrange
    initColdOpen()
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)

    // Act
    play('orange')
    await hear()
    const silent = hint()
    vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
    play('orange')
    await hear()

    // Assert
    expect(silent).toBe(COLD.hints.silent)
    expect(hint()).toBe("Choose an answer to unlock Merc's siren.")
  })

  it.each([
    ['every', 'You said: every voice can'],
    ['mistake', 'You said: a mistake'],
  ])(
    "locks the choice %s, then reveals once Merc's siren is heard to its end",
    async (choice, guess) => {
      // Arrange
      initColdOpen()

      // Act
      choose(choice)
      const chosen = hint()
      play('blue')
      const before = reveal().hidden
      await hear()

      // Assert
      expect(chosen).toBe(COLD.hints.chosen)
      expect(before).toBe(true)
      expect(reveal().hidden).toBe(false)
      expect(el('#predict .reveal .mono').textContent).toBe(guess)
      expect(hint()).toBe(COLD.hints.again)
      expect(
        el<HTMLButtonElement>(
          `#predict [data-choice="${choice}"]`,
        ).getAttribute('aria-pressed'),
      ).toBe('true')
    },
  )

  it('relabels each seam the switch at the reveal, shows the key, and Tavi celebrates once', async () => {
    // Arrange
    const cold = initColdOpen()
    choose('every')

    // Act
    play('blue')
    const sung = said()
    await hear()

    // Assert
    expect(sung).toBe(COLD.still)
    expect(cold.chart.scene.seams.map((s) => s.label)).toEqual([
      'the switch',
      'the switch',
    ])
    expect(cold.chart.scene.lines).toHaveLength(2)
    expect(el('[data-hero-key]').hidden).toBe(false)
    expect(said()).toBe('Each seam is now labelled the switch.')
    expect(duo.celebrate).toHaveBeenCalledTimes(1)
    expect(duo.celebrate).toHaveBeenCalledWith('orange', 1600)
  })

  it("reveals nothing for Merc's siren cut short, by another sound or a stop", async () => {
    // Arrange
    const cold = initColdOpen()
    choose('every')

    // Act: another source takes the page's sound
    play('blue')
    NowPlaying.claim(() => undefined)
    await settle()
    const byAnother = reveal().hidden
    play('blue')
    cold.stop()
    await settle()

    // Assert
    expect(byAnother).toBe(true)
    expect(reveal().hidden).toBe(true)
    expect(hint()).toBe(COLD.hints.chosen)
    expect(runs.every((r) => r.stopped)).toBe(true)
  })

  it('says no hint or reveal line is right or wrong', () => {
    // Arrange
    const lines = [
      ...Object.values(COLD.hints),
      ...Object.values(COLD.guess),
      el('#predict .reveal p').textContent ?? '',
    ]

    // Assert
    for (const line of lines) expect(line).not.toMatch(/\b(right|wrong)\b/i)
  })
})
