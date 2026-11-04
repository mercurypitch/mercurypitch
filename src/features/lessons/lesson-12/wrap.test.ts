// ============================================================
// Lesson 12 Wrap tests — free play's every control, the practise card and the tease still
// ============================================================
//
// WEB-SPEC, Sections 8, Toys 1's Free play and Toys 9, on the page's own
// markup, its runs recorded (kit/run-recorder.test-fixtures.ts): free play
// shows every control of the ring of rooms at once, nothing locked; its
// key switch, plays and tunes are the steps' own, so in G the loop, the
// roots and the tunes play five semitones lower; its names switch writes
// the page's one store; it is the page's one sound, and leaving it for
// 600 ms stops it. The practise card shows the rest card after "Just
// listen today", "Effortful" or "Uncomfortable", Cadence offered either
// way, and every link opens in a new tab. The tease still sits in the
// next-lesson card's slot, aria-hidden, with no button.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollOutOfView } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { mountPractiseCard, VisitEnding } from '@/features/lessons/kit/comfort'
import { AWAY_MS } from '@/features/lessons/kit/leave'
import { createModeStore } from '@/features/lessons/kit/names'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { LETTERS_SOLFEGE_MODES } from '@/features/lessons/kit/names-modes'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { chip, iThenVi, loop, roots, tune } from './sounds'
import { initWrap } from './wrap'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const free = (selector: string): HTMLElement => el(`#freePlay ${selector}`)

/** Every control free play holds, as the eye and the keyboard meet them. */
const controls = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('#freePlay button'))

/** Shown: neither it nor any box around it hidden. */
function shown(e: HTMLElement): boolean {
  for (let n: HTMLElement | null = e; n; n = n.parentElement)
    if (n.hidden) return false
  return true
}

function mountFree() {
  const names = createModeStore<LettersSolfegeMode>(
    LETTERS_SOLFEGE_MODES,
    'letters',
  )
  return { rooms: initWrap(names), names }
}

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  soundOn()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  loadPage()
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  VisitEnding.set('practise')
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 12's free play", () => {
  it('shows every control of the ring of rooms at once, each a button of its own type', () => {
    // Act
    mountFree()

    // Assert: Toys 1, Free play; seven chips, two keys, three plays, three
    // tunes, two names and Slow
    expect(shown(el('#freePlay'))).toBe(true)
    expect(controls()).toHaveLength(18)
    expect(controls().every((b) => shown(b))).toBe(true)
    expect(controls().every((b) => b.type === 'button')).toBe(true)
  })

  it("opens on C major's seven rooms, the chips giving numerals", () => {
    // Act
    const { rooms } = mountFree()

    // Assert
    expect(rooms.settings).toMatchObject({ mode: 'numerals', key: 'C' })
    expect(rooms.drawn).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(free('[data-chip="5"] [data-chip-top]').textContent).toBe('vi')
  })

  it.each([
    ['[data-rooms-play="slide"]', iThenVi('G')],
    ['[data-rooms-play="loop"]', loop('G')],
    ['[data-rooms-play="roots"]', roots('G')],
    ['[data-tune="tune-1"]', tune('tune-1', 'G')],
    ['[data-chip="6"]', chip(6, 'G')],
  ] as const)('plays %s in G after the key switch', (selector, notes) => {
    // Arrange
    mountFree()
    free('[data-key="G"]').click()

    // Act
    free(selector).click()

    // Assert: FACTS 69 and 69a
    expect(runs.at(-1)?.notes).toEqual(notes)
  })

  it('reads "Stop" on a tune while it plays, as Step 5 does', () => {
    // Arrange
    mountFree()

    // Act
    free('[data-tune="even"]').click()

    // Assert
    expect(free('[data-tune="even"]').getAttribute('aria-label')).toBe(
      'Stop tune 2 with even notes',
    )
  })

  it("writes the page's one names store, and follows it", () => {
    // Arrange
    const { rooms, names } = mountFree()

    // Act
    free('[data-names="solfege"]').click()
    const store = names.mode
    names.set('letters')

    // Assert
    expect(store).toBe('solfege')
    expect(rooms.settings.names).toBe('letters')
    expect(free('[data-names="letters"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('stops what it plays once it has been off screen for 600 ms', async () => {
    // Arrange
    mountFree()
    free('[data-rooms-play="loop"]').click()

    // Act
    scrollOutOfView(el('#freePlay'))
    vi.advanceTimersByTime(AWAY_MS)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})

describe("Lesson 12's practise card", () => {
  it.each(['practise', 'rest'] as const)(
    'shows the %s version, Cadence offered either way',
    (ending) => {
      // Arrange
      mountPractiseCard(el('#practiseCard'))

      // Act
      VisitEnding.set(ending)

      // Assert: WEB-SPEC, Sections 8; FACTS 63
      expect(shown(el('#practiseCard [data-ending="practise"]'))).toBe(
        ending === 'practise',
      )
      expect(shown(el('#practiseCard [data-ending="rest"]'))).toBe(
        ending === 'rest',
      )
      expect(shown(el('#practiseCard a[href="/ear-lab?lesson=12"]'))).toBe(true)
    },
  )

  it('opens every link in a new tab, each carrying the lesson before any hash', () => {
    // Act
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#practiseCard a'),
    )

    // Assert: WEB-SPEC, Contract
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/pitch-training?lesson=12',
      '/ear-lab?lesson=12',
    ])
    expect(links.every((a) => a.target === '_blank')).toBe(true)
  })
})

describe("Lesson 12's tease still", () => {
  it("stays in the next-lesson card's slot once the card is drawn, aria-hidden and with no button", () => {
    // Act
    createNextCard(12)

    // Assert: Toys 9
    const still = el('[data-next-card] svg.l12-tease')
    expect(still.getAttribute('aria-hidden')).toBe('true')
    expect(el('[data-next-card]').querySelector('button')).toBeNull()
    expect(still.querySelectorAll('text')).toHaveLength(3)
    expect(
      Array.from(still.querySelectorAll('text'), (t) => t.textContent),
    ).toEqual(['?', '?', '?'])
  })
})
