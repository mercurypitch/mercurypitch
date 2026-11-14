// ============================================================
// Lesson 28 wrap tests — free play, the practice card and the season's close
// ============================================================
//
// FACTS 46 and the WEB-SPEC's Toys 2 (free play) and 7 (the season's
// close): the steps' toy again, the hero's ten empty bars and every control
// with its state switch held under the lock line until the cold open's
// choice; the card off screen for 600 ms stopping what it plays; the
// practice card's rest version after an ending that rests the voice; and
// the close, Season 2's words and its two links, keeping its answer and the
// map alone after a rest, its figure after its words.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollOutOfView } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { carrySeason } from '@/features/lessons/kit/page-state'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { LOCKED_SAID } from './score-plays'
import { initWrap } from './wrap'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  loadPage()
  soundOn()
  resetRuns()
})

afterEach(() => {
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  VisitEnding.set('practise')
  document.body.textContent = ''
})

const free = (sel: string): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(`#freePlay ${sel}`))
const usable = (sel: string): boolean[] =>
  free(sel).map((b) => !(b as HTMLButtonElement).disabled)

describe('free play', () => {
  it("draws the hero's ten empty bars and holds its switch and every control under the lock line until the cold open's choice (FACTS 46)", () => {
    // Arrange
    const wrap = initWrap()
    const figure = el('#freePlay [data-score]')
    const before = {
      states: usable('button[data-state]'),
      plays: usable('[data-toy-play]').some(Boolean),
      lock: free('[data-lock-line]').map((l) => l.hidden),
      said: figure.getAttribute('aria-label'),
      strip: figure.querySelectorAll('.score-locked li').length,
    }

    // Act
    wrap.free.unlock()

    // Assert
    expect(before).toEqual({
      states: [false, false, false, false],
      plays: false,
      lock: [false],
      said: LOCKED_SAID,
      strip: 20,
    })
    expect(usable('button[data-state]')).toEqual([true, true, true, true])
    expect(usable('[data-toy-play]').every(Boolean)).toBe(true)
    expect(free('[data-lock-line]').map((l) => l.hidden)).toEqual([true])
    expect(figure.getAttribute('aria-label')).not.toBe(LOCKED_SAID)
  })

  it('stops what it plays once the card has been off screen for 600 ms', async () => {
    // Arrange
    const wrap = initWrap()
    wrap.free.unlock()
    el<HTMLButtonElement>('#freePlay [data-toy-play="phrase1"]').click()
    await settle()

    // Act
    scrollOutOfView(el('#freePlay'))
    vi.advanceTimersByTime(600)

    // Assert
    expect(runs[runs.length - 1].stopped).toBe(true)
  })
})

describe('the practice card', () => {
  it('shows its rest version after an ending that rests the voice, headed "Rest today", and the card again after one that does not', () => {
    // Arrange
    initWrap()
    const rest = el('#practiseCard [data-ending="rest"]')
    const practise = el('#practiseCard [data-ending="practise"]')
    const eyebrow = el('#practiseCard .eyebrow')
    const first = [rest.hidden, practise.hidden, words(eyebrow)]

    // Act
    VisitEnding.set('rest')
    const rested = [rest.hidden, practise.hidden, words(eyebrow)]
    VisitEnding.set('practise')

    // Assert
    expect(first).toEqual([true, false, 'Practise in MercuryPitch'])
    expect(rested).toEqual([false, true, 'Rest today'])
    expect([rest.hidden, practise.hidden]).toEqual([true, false])
  })
})

describe("the season's close", () => {
  /** The close as main.ts mounts it: Season 2 carried first, the card following the visit's ending. */
  function mountClose(): HTMLElement {
    carrySeason(SEASON_2)
    createNextCard(28, VisitEnding)
    return el('#wrap .next-card')
  }

  it('closes Season 2 with Karaoke Night and the season map, its figure after its words (Toys 7)', () => {
    // Act
    const card = mountClose()

    // Assert
    expect(words(card.querySelector('.eyebrow'))).toBe('End of Season 2')
    expect(words(card)).toContain(
      "You've read a song in two parts. Now sing a whole song.",
    )
    const links = Array.from(card.querySelectorAll('a'), (a) => [
      words(a),
      a.getAttribute('href'),
    ])
    expect(links).toEqual([
      ['Karaoke Night', '/karaoke-night?lesson=28'],
      ['See the season map', '#explorer'],
    ])
    expect(card.querySelector('.l28-close')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('keeps its answer and the map alone after an ending that rests the voice', () => {
    // Arrange
    const card = mountClose()

    // Act
    VisitEnding.set('rest')

    // Assert
    const now = el('#wrap .next-card')
    expect(words(now)).toContain("You've read a song in two parts.")
    expect(words(now)).not.toContain('Now sing a whole song.')
    expect(Array.from(now.querySelectorAll('a'), (a) => words(a))).toEqual([
      'See the season map',
    ])
    expect(card.isConnected || now.isConnected).toBe(true)
  })
})
