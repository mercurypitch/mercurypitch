// ============================================================
// Lesson 7 cold open tests — the answer waits for the guess and the sound
// ============================================================
//
// WEB-SPEC, End to end 2, at unit level and under the curiosity plan's rule
// (CURIOSITY-MOMENTS § 3.1): before a choice the chart shows the column
// with no beads and no bracket, and the live text names no note, even
// while "Twinkle" plays; the free play works before a choice; the beads,
// the gold bracket and the reveal come only after a choice and a heard
// play on the column; with sound off the hint says so and the reveal
// waits; and a play cut short, by another sound or by every sound stopping
// (the Sound switch, a hidden page), reveals nothing.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import { initColdOpen } from './cold-open'
import { el, listen, loadPage } from './page-dom.test-fixtures'
import { TWINKLE_SEC } from './range-data'
import { HERO_BEFORE } from './range-words'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const said = (): string => el('[data-hero-said]').textContent ?? ''
const revealed = (): boolean => !el('#predict .reveal').hidden
const PLAY_MS = TWINKLE_SEC * 1000 + 100

describe("Lesson 7's cold open", () => {
  it('plays "Twinkle" before a choice with nothing on the column, naming no note', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    loadPage()
    const chart = initColdOpen()

    // Act
    el('#heroPlay').click()
    await vi.advanceTimersByTimeAsync(3000)
    const during = { beads: chart.scene.beads.length, text: said() }
    await vi.advanceTimersByTimeAsync(PLAY_MS)

    // Assert
    expect(heard).toHaveLength(14)
    expect(during).toEqual({ beads: 0, text: HERO_BEFORE })
    expect(chart.scene.beads).toHaveLength(0)
    expect(chart.scene.bracket).toBeNull()
    expect(said()).not.toMatch(/[A-G]\s?\d/)
    expect(revealed()).toBe(false)
    expect(
      el<HTMLButtonElement>('#predict [data-play="column"]').disabled,
    ).toBe(true)
  })

  it('reveals after a choice and a heard play on the column: beads, bracket and the span', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    loadPage()
    const chart = initColdOpen()

    // Act
    el('#predict [data-choice="less"]').click()
    const chosen = revealed()
    el('#predict [data-play="column"]').click()
    await vi.advanceTimersByTimeAsync(2000)
    // reduced motion, as the doubles set it: the beads stand in place, lit in turn
    const lighting = chart.scene.beads.filter((b) => b.lit === true).length
    const standing = chart.scene.beads.length
    await vi.advanceTimersByTimeAsync(PLAY_MS)

    // Assert
    expect(chosen).toBe(false)
    expect(lighting).toBe(1)
    expect(standing).toBe(14)
    expect(revealed()).toBe(true)
    expect(el('#predict .reveal .mono').textContent).toBe(
      'You said: less than half',
    )
    expect(chart.scene.beads).toHaveLength(14)
    expect(chart.scene.bracket).toEqual({ lo: 52, hi: 61 })
    expect(said()).toBe(
      "Twinkle, Twinkle, from E 3 up to C sharp 4 and back: 9 of the column's 24 semitones",
    )
  })

  it('keeps the reveal waiting with sound off, and takes the beads away again', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')
    loadPage()
    const chart = initColdOpen()

    // Act
    el('#predict [data-choice="most"]').click()
    el('#predict [data-play="column"]').click()
    await vi.advanceTimersByTimeAsync(PLAY_MS)

    // Assert
    expect(revealed()).toBe(false)
    expect(chart.scene.beads).toHaveLength(0)
    expect(chart.scene.bracket).toBeNull()
    expect(el('#predict .lock-hint').textContent).toBe(
      'Sound is off, so nothing played. Turn sound on to hear it.',
    )
  })

  it('reveals nothing after a play cut short by another sound', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    loadPage()
    const chart = initColdOpen()
    el('#predict [data-choice="less"]').click()
    el('#predict [data-play="column"]').click()
    await vi.advanceTimersByTimeAsync(2000)
    const other = vi.fn()

    // Act: a step's chart, a word or Sing it takes the page's sound
    NowPlaying.claim(other)
    await vi.advanceTimersByTimeAsync(PLAY_MS)

    // Assert
    expect(heard.at(-1)?.stopped).toBe(true)
    expect(revealed()).toBe(false)
    expect(chart.scene.beads).toHaveLength(0)
    NowPlaying.release(other)
  })

  it('reveals nothing after a play cut short by every sound stopping, as when the page is hidden', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    loadPage()
    const chart = initColdOpen()
    el('#predict [data-choice="less"]').click()
    el('#predict [data-play="column"]').click()
    await vi.advanceTimersByTimeAsync(2000)
    const sung = heard.length

    // Act: the Sound switch turned off, the hush or a hidden page
    Sound.stopAll()
    await vi.advanceTimersByTimeAsync(PLAY_MS)

    // Assert
    expect(heard).toHaveLength(sung)
    expect(revealed()).toBe(false)
    expect(chart.scene.beads).toHaveLength(0)
  })
})
