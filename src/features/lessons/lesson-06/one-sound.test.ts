// ============================================================
// Lesson 6 one-sound tests — a new sound anywhere stops the one before it
// ============================================================
//
// WEB-SPEC's "one sound plays at a time" (Audio), on the page's own
// markup: a tap on the stage stops a game's pair, a game's pair stops an
// anchor's tune, a sound started after a miss keeps the miss's replay from
// ever playing, one word stops another, and the newest quiz press wins.
// Each sound stopped is stopped by its own stop, so its lit button goes
// out with it.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { el, listen, missARound, mountSteps } from './page-dom.test-fixtures'
import { bindQuizPlays } from './quiz-play'
import { initWords } from './words'

const lit = (selector: string): boolean =>
  el(selector).classList.contains('is-on')

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 6's one sound at a time", () => {
  it("stops an ear game's pair when a gap on the stage is tapped", () => {
    // Arrange: Step or leap?'s pair, its first note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountSteps().show(2)
    el('#stepLeapGame [data-eg-play]').click()
    vi.advanceTimersByTime(100)

    // Act
    el('#toyTune .tune-hit-gap').click()
    vi.advanceTimersByTime(2000)

    // Assert: the game's first note cut off, its second never played, the gap's two whole
    const [game, ...gap] = heard
    expect(game.stopped).toBe(true)
    expect(gap.map((v) => v.stopped)).toEqual([false, false])
    expect(lit('#stepLeapGame [data-eg-play]')).toBe(false)
  })

  it("stops an anchor's tune when Name it plays its pair", () => {
    // Arrange: "Should auld"'s tune, its first note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountSteps().show(5)
    el('[data-anchor="P4"] [data-anchor-play="tune"]').click()
    vi.advanceTimersByTime(100)

    // Act
    el('#nameItGame [data-eg-play]').click()
    vi.advanceTimersByTime(2000)

    // Assert
    const [tune, ...pair] = heard
    expect(tune.stopped).toBe(true)
    expect(pair.map((v) => v.stopped)).toEqual([false, false])
    expect(lit('[data-anchor="P4"]')).toBe(false)
  })

  it("never plays a miss's replay over a sound started after the answer", () => {
    // Arrange: a missed round, 300 ms before its replay is due
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountSteps().show(2)
    missARound(heard)
    vi.advanceTimersByTime(300)

    // Act
    el('#toyTune .tune-hit-gap').click()
    vi.advanceTimersByTime(3000)

    // Assert: the round's pair, then the gap's, whole
    expect(heard).toHaveLength(4)
    expect(heard.slice(2).map((v) => v.stopped)).toEqual([false, false])
  })

  it('stops a word when another word is pressed', () => {
    // Arrange: "interval", its first note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountSteps()
    initWords()
    el('[data-word-play="interval"]').click()
    vi.advanceTimersByTime(100)

    // Act
    el('[data-word-play="leap"]').click()
    vi.advanceTimersByTime(2000)

    // Assert
    const [interval, ...leap] = heard
    expect(interval.stopped).toBe(true)
    expect(leap.map((v) => v.midi)).toEqual([62, 67])
    expect(lit('[data-word-play="interval"]')).toBe(false)
  })

  it('plays the newest quiz press, stopping the one before it', () => {
    // Arrange: question 1's two lines, Merc's first note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const host = document.createElement('div')
    host.innerHTML =
      '<button type="button" data-quiz-play="lines">Play</button><button type="button" data-quiz-play="fourth">Play</button>'
    document.body.append(host)
    bindQuizPlays(host)
    el('[data-quiz-play="lines"]').click()
    vi.advanceTimersByTime(100)

    // Act
    el('[data-quiz-play="fourth"]').click()
    vi.advanceTimersByTime(2000)

    // Assert: the lines cut off, and C4 then F4 whole
    const [lines, ...fourth] = heard
    expect(lines.stopped).toBe(true)
    expect(fourth.map((v) => [v.midi, v.stopped])).toEqual([
      [60, false],
      [65, false],
    ])
    expect(lit('[data-quiz-play="lines"]')).toBe(false)
  })
})
