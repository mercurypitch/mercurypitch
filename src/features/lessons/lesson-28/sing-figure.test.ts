// ============================================================
// Lesson 28 Sing it's figure tests — the count-in's dots and the cursor
// ============================================================
//
// WEB-SPEC, Toys 6: the count-in's dots show once a voice is chosen, and
// not on the listening path. The cursor stands at the beat from a play's
// bar 1, at no beat before it or after bar 8's 32nd, and only the staffs
// asked for light; until the cold open's choice it stands nowhere. A
// play's draw runs about 30 times a second until the play says it is done.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { resetScores, scores } from './score-double.test-fixtures'
import { mountSingFigure } from './sing-figure'
import { BEAT_SEC } from './song'

vi.mock(
  '@/features/lessons/kit/score',
  async () => (await import('./score-double.test-fixtures')).scoreDouble,
)

let now = 0

beforeEach(() => {
  document.body.innerHTML = `
    <ol data-sing-count hidden><li></li><li></li><li></li><li></li></ol>
    <div data-sing-score></div>`
  resetScores()
  now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** The figure, unlocked, and its score's double. */
function mounted() {
  const fig = mountSingFigure(null)
  fig.unlock()
  return { fig, score: scores[scores.length - 1] }
}

describe('the count-in’s dots', () => {
  it('show once a voice is chosen, and not while held or on the listening path', () => {
    // Arrange
    const fig = mountSingFigure(null)
    const dots = document.querySelector<HTMLElement>('[data-sing-count]')
    const shown = (): boolean => dots?.hidden === false

    // Act
    const held = shown()
    fig.unlock()
    const listening = shown()
    fig.voice('lower')
    const chosen = shown()
    fig.voice(null)

    // Assert
    expect([held, listening, chosen, shown()]).toEqual([
      false,
      false,
      true,
      false,
    ])
  })
})

describe('the cursor follows a play', () => {
  it('stands nowhere before bar 1, at the beat through bar 8, and nowhere after its 32nd beat', () => {
    // Arrange
    const { fig, score } = mounted()
    const frame = fig.follow(now + 500, [1])

    // Act: before bar 1, on it, two beats on, and past bar 8
    frame()
    now += 500
    frame()
    now += 2 * BEAT_SEC * 1000
    frame()
    now += 30 * BEAT_SEC * 1000
    frame()

    // Assert
    expect(
      score.lit.map((b) => (b === null ? null : Number(b.toFixed(6)))),
    ).toEqual([null, 0, 2, null])
  })

  it('draws nothing until the cold open’s choice', () => {
    // Arrange
    const fig = mountSingFigure(null)
    const score = scores[scores.length - 1]

    // Act
    fig.follow(now, [0, 1])()

    // Assert
    expect([fig.held, score.lit]).toEqual([true, []])
  })

  it('draws about 30 times a second until the play is done, then resolves', async () => {
    // Arrange
    vi.useFakeTimers()
    const { fig, score } = mounted()
    let done = false
    let resolved = false

    // Act: a second of frames, then done
    void fig
      .track(now, [0], () => done)
      .then(() => {
        resolved = true
      })
    for (let k = 0; k < 30; k++) {
      now += 1000 / 30
      await vi.advanceTimersByTimeAsync(1000 / 30)
    }
    const drawn = score.lit.length
    done = true
    await vi.advanceTimersByTimeAsync(1000)

    // Assert: the first frame at once, then one a tick
    expect(drawn).toBe(31)
    expect(score.lit.length).toBe(drawn)
    expect(resolved).toBe(true)
  })
})
