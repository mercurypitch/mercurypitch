// ============================================================
// Lesson 14 four words — each word's play, a Stop while it sounds
// ============================================================
//
// WEB-SPEC, Toys 3, on the page's own markup with the kit's runs recorded:
// Phrase plays the first line as take 2 sings it; Legato as one voice,
// then a beat later broken before every note but the first; Swell plays
// Step 3's swell, with no Merc; Cadence "what you are" over V and I. Each
// button reads Stop while its sound plays and a second press stops it, and
// one sound plays at a time on the page.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, nameOf, settle, soundOn } from './page-dom.test-fixtures'
import { initWords } from './words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const duo = vi.hoisted(() => ({ sing: vi.fn() }))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
}))

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  loadPage()
  soundOn()
  initWords()
})

afterEach(async () => {
  NowPlaying.claim(() => undefined)
  await settle()
  vi.useRealTimers()
  vi.restoreAllMocks()
  duo.sing.mockReset()
  document.body.textContent = ''
})

const word = (w: string): HTMLButtonElement => el(`[data-word-play="${w}"]`)

describe("Lesson 14's four words", () => {
  it('plays each word as the spec has it: the phrase as take 2, legato then broken, the swell, the cadence over V and I', () => {
    // Act
    for (const w of ['phrase', 'legato', 'swell', 'cadence']) word(w).click()

    // Assert: each press stopped the one before
    expect(runs.map((r) => r.kind)).toEqual([
      'lines',
      'lines',
      'line',
      'lines',
      'notes',
    ])
    expect(runs[0].lines).toHaveLength(1)
    expect(runs[1].lines).toHaveLength(8)
    expect(runs[1].lines[1].t).toBeCloseTo(6.75, 6)
    expect(runs[4].notes.map((n) => n.t)).toEqual([0, 0, 0, 1.5, 1.5, 1.5])
    expect(runs.slice(0, 3).every((r) => r.stopped)).toBe(true)
  })

  it('reads Stop while its sound plays, and stops it at a second press', async () => {
    // Arrange
    const b = word('legato')

    // Act
    b.click()
    const playing = [nameOf(b), b.textContent?.trim()]
    b.click()
    await settle()

    // Assert
    expect(playing).toEqual(['Stop legato, then with breaks', 'Stop'])
    expect(runs[0].stopped).toBe(true)
    expect(nameOf(b)).toBe('Play: legato, then with breaks')
  })

  it("has the chosen voice's Merc sing the phrase, and no Merc the swell", () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    // Act
    word('swell').click()
    vi.advanceTimersByTime(4000)
    const swell = duo.sing.mock.calls.length
    word('phrase').click()
    vi.advanceTimersByTime(0)

    // Assert
    expect(swell).toBe(0)
    expect(duo.sing).toHaveBeenCalledWith('blue', 50, true)
  })
})
