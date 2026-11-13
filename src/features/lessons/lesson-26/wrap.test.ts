// ============================================================
// Lesson 26 wrap tests — free play and the practice card
// ============================================================
//
// FACTS 40 and 63 to 66 and the WEB-SPEC's Toys 2 (free play): the steps'
// toy again, on plain "Twinkle" with every control and its state switch
// held under the lock line until the cold open's choice; the switch
// drawing each step's state; the card off screen for 600 ms stopping what
// it plays; the practice card's rest line after an ending that rests the
// voice; and the tease still on the next card, Lesson 27's stage as its
// cold open opens (WEB-SPEC, Toys 6; Lesson 27's WEB-SPEC, Tests 18).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollOutOfView } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { PLAIN_SAID } from './part-shapes'
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
const canvasSaid = (): string | null =>
  el('#freePlay [data-tune-canvas]').getAttribute('aria-label')

describe('free play', () => {
  it('draws plain "Twinkle" and holds its switch and every control under the lock line until the cold open\'s choice (FACTS 40)', () => {
    // Arrange
    const wrap = initWrap()
    const before = {
      states: usable('[data-state]'),
      plays: usable('[data-toy-play]'),
      lock: free('[data-lock-line]').map((l) => l.hidden),
      said: canvasSaid(),
    }

    // Act
    wrap.free.unlock()

    // Assert
    expect(before).toEqual({
      states: [false, false, false, false],
      plays: free('[data-toy-play]').map(() => false),
      lock: [false],
      said: PLAIN_SAID,
    })
    expect(usable('[data-state]')).toEqual([true, true, true, true])
    expect(usable('[data-toy-play]').every(Boolean)).toBe(true)
    expect(free('[data-lock-line]').map((l) => l.hidden)).toEqual([true])
    expect(canvasSaid()).not.toBe(PLAIN_SAID)
  })

  it("draws each step's state from its switch, the pressed one marked", () => {
    // Arrange
    const wrap = initWrap()
    wrap.free.unlock()

    // Act
    el<HTMLButtonElement>('#freePlay [data-state="4"]').click()

    // Assert
    expect(wrap.free.state).toBe(4)
    expect(
      free('[data-state]').map((b) => b.getAttribute('aria-pressed')),
    ).toEqual(['false', 'false', 'false', 'true'])
    expect(canvasSaid()).toContain('C major chord')
  })

  it('stops what it plays once the card has been off screen for 600 ms', async () => {
    // Arrange
    const wrap = initWrap()
    wrap.free.unlock()
    free('[data-toy-play]')[0].click()
    await settle()

    // Act
    scrollOutOfView(el('#freePlay'))
    vi.advanceTimersByTime(600)

    // Assert
    expect(runs[runs.length - 1].stopped).toBe(true)
  })
})

describe('the practice card', () => {
  it('shows the rest line in its place after an ending that rests the voice, and the card again after one that does not', () => {
    // Arrange
    initWrap()
    const rest = el('#practiseCard [data-ending="rest"]')
    const practise = el('#practiseCard [data-ending="practise"]')
    const first = [rest.hidden, practise.hidden]

    // Act
    VisitEnding.set('rest')
    const rested = [rest.hidden, practise.hidden]
    VisitEnding.set('practise')

    // Assert
    expect(first).toEqual([true, false])
    expect(rested).toEqual([false, true])
    expect([rest.hidden, practise.hidden]).toEqual([true, false])
  })
})

describe('the tease still', () => {
  /** The ring's centre and radius in the still's own units, C on its right, a semitone each 30 degrees. */
  const RING = { x: 120, y: 60, r: 40 }
  const NAMES = [
    'C',
    'C♯',
    'D',
    'E♭',
    'E',
    'F',
    'F♯',
    'G',
    'A♭',
    'A',
    'B♭',
    'B',
  ]
  const noteAt = (x: number, y: number): string => {
    const deg = (Math.atan2(y - RING.y, x - RING.x) * 180) / Math.PI
    return NAMES[((Math.round(-deg / 30) % 12) + 12) % 12]
  }
  /** A room's corners, as the notes its path's points sit on. */
  const cornersOf = (room: Element): string[] =>
    [
      ...(room.getAttribute('d') ?? '').matchAll(
        /[ML]\s*([\d.]+)[\s,]+([\d.]+)/g,
      ),
    ].map(([, x, y]) => noteAt(Number(x), Number(y)))

  it("draws Lesson 27's ring as its cold open opens: V's room on G, B and D and I's on C, E and G, three corners each, on twelve beads", () => {
    // Arrange
    const still = el('[data-next-card] .l26-tease')

    // Act
    const beads = [...still.querySelectorAll('.l26-tease-bead')].map((b) => {
      const x = Number(b.getAttribute('cx'))
      const y = Number(b.getAttribute('cy'))
      return {
        note: noteAt(x, y),
        r: Math.hypot(x - RING.x, y - RING.y),
      }
    })

    // Assert: no fourth corner, the room that is not yet a seventh's (FACTS 1a)
    expect(cornersOf(el('.l26-tease-room.v'))).toEqual(['G', 'B', 'D'])
    expect(cornersOf(el('.l26-tease-room.i'))).toEqual(['C', 'E', 'G'])
    expect(beads.map((b) => b.note).sort()).toEqual([...NAMES].sort())
    for (const b of beads) expect(b.r).toBeCloseTo(RING.r, 0)
  })

  it('is a picture: hidden from the reader, with no control and nothing that moves', () => {
    // Arrange
    const still = el('[data-next-card] .l26-tease')

    // Act / Assert (WEB-SPEC, Toys 6)
    expect(still.getAttribute('aria-hidden')).toBe('true')
    expect(
      still.querySelectorAll('button, a, input, [tabindex], [data-play]'),
    ).toHaveLength(0)
    expect(
      still.querySelectorAll('animate, animateMotion, animateTransform, set'),
    ).toHaveLength(0)
  })
})
