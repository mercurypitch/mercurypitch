// ============================================================
// Lesson 8 steps tests — a step left behind keeps nothing sounding or booked
// ============================================================
//
// WEB-SPEC, Tests 15, 17 and 18, on the page's own markup and deck, the
// beat clock a recorder (page-dom.test-fixtures.ts): leaving a step by
// every route the deck has (Next, Previous, a swipe, a scroll on the wide
// page, the lesson menu's jump, a #step-N address and a quiz link's show)
// stops the stage's run, Count the bar's round and Step 5's plays, and a
// miss's replay still to come never starts; a step shown again, as a
// layout change shows it, stops nothing. Step 5's stage waits for the
// predict's choice, and the reveal waits for both plays heard to their
// ends: a play cut short resolves false and reveals nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { el, live, loadPage, quietResizes, resetRuns, runs, settle, sizeFigures, soundOn, } from './page-dom.test-fixtures'
import { initSteps } from './steps'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))

/** The observers the page made, with what each watches, so a test can report a scroll. */
const observers: { cb: IntersectionObserverCallback; seen: Element[] }[] = []
/** The doubles' globals, put back after each test. */
const DOUBLES = {
  matchMedia: window.matchMedia,
  IntersectionObserver: window.IntersectionObserver,
  requestAnimationFrame: window.requestAnimationFrame,
}

function mountSteps(): StepDeck {
  loadPage()
  sizeFigures()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  Element.prototype.scrollIntoView = () => undefined
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  initSteps(deck)
  deck.start()
  return deck
}

/** The start button showing on the stage. */
const stageStart = (): HTMLButtonElement =>
  [
    ...document.querySelectorAll<HTMLButtonElement>('#toyBeat [data-bm-start]'),
  ].find((b) => b.closest('[hidden]') === null) as HTMLButtonElement

beforeEach(() => {
  resetRuns()
  observers.length = 0
  quietResizes()
  soundOn()
  window.IntersectionObserver = class {
    private readonly entry: {
      cb: IntersectionObserverCallback
      seen: Element[]
    }
    constructor(cb: IntersectionObserverCallback) {
      this.entry = { cb, seen: [] }
      observers.push(this.entry)
    }
    observe(t: Element): void {
      this.entry.seen.push(t)
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  } as unknown as typeof IntersectionObserver
  window.requestAnimationFrame = (fn: FrameRequestCallback) =>
    window.setTimeout(() => fn(0), 0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Object.assign(window, DOUBLES)
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 8's steps: leaving one", () => {
  it("stops the stage's run on Next, and books nothing more", () => {
    // Arrange: the metronome ticking on Step 1
    const deck = mountSteps()
    stageStart().click()
    expect(live()).toHaveLength(1)

    // Act
    el('.stage-nav [data-step-go="1"]').click()

    // Assert
    expect(deck.current).toBe(2)
    expect(runs[0].stopped).toBe(true)
    expect(runs[0].o.bar(3)).toBeNull()
  })

  it('stops it on Previous, on the lesson menu’s jump and on a quiz link’s show', () => {
    // Arrange
    const deck = mountSteps()
    const routes: [string, () => void][] = [
      ['Previous', () => el('.stage-nav [data-step-go="-1"]').click()],
      ['jump', () => deck.jump(1)],
      ['show', () => deck.show(5)],
    ]

    for (const [name, leave] of routes) {
      deck.show(3)
      stageStart().click()
      const run = runs.at(-1)

      // Act
      leave()

      // Assert
      expect(run?.stopped, name).toBe(true)
      expect(live(), name).toEqual([])
    }
  })

  it('stops it when an address names another step', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const deck = mountSteps()
    deck.show(4)
    stageStart().click()

    // Act
    window.location.hash = '#step-2'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    vi.advanceTimersByTime(10)

    // Assert
    expect(deck.current).toBe(2)
    expect(runs[0].stopped).toBe(true)
  })

  it('stops it on a swipe on the phone deck', () => {
    // Arrange: a phone, so the deck takes swipes
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width: 960px') || query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia
    const deck = mountSteps()
    stageStart().click()
    const text = el('#stepsText')
    const touch = (type: string, x: number) => {
      const e = new Event(type)
      Object.defineProperty(
        e,
        type === 'touchstart' ? 'touches' : 'changedTouches',
        {
          value: [{ clientX: x, clientY: 300 }],
        },
      )
      text.dispatchEvent(e)
    }

    // Act: a swipe to the left
    touch('touchstart', 300)
    touch('touchend', 120)

    // Assert
    expect(deck.current).toBe(2)
    expect(runs[0].stopped).toBe(true)
  })

  it('stops it when a scroll on the wide page brings another step beside the stage', () => {
    // Arrange
    const deck = mountSteps()
    stageStart().click()
    const follow = observers.find((o) => o.seen.some((t) => t.id === 'step-1'))
    const step3 = el('#step-3')

    // Act
    follow?.cb(
      [
        {
          isIntersecting: true,
          target: step3,
        } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )

    // Assert
    expect(deck.current).toBe(3)
    expect(runs[0].stopped).toBe(true)
  })

  it('stops nothing when the step showing is shown again, as a layout change does', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)
    stageStart().click()

    // Act
    deck.show(4)

    // Assert
    expect(runs[0].stopped).toBe(false)
    expect(stageStart().textContent).toContain('Stop')
  })

  it("stops Count the bar's round, and starts no miss's replay once Step 3 is left", async () => {
    // Arrange: a round played to its end on Step 3, then answered wrong
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const deck = mountSteps()
    deck.show(3)
    el('#countBarGame [data-eg-play]').click()
    const round = runs[0]
    const size = ((round.o.bar(0)?.beats ?? 0) - 1) / 2
    round.end(true)
    await settle()
    const wrong = size === 2 ? '3' : '2'
    el(`#countBarGame [data-eg-answer="${wrong}"]`).click()
    vi.advanceTimersByTime(300)

    // Act: Next, 400 ms before the replay is due
    el('.stage-nav [data-step-go="1"]').click()
    vi.advanceTimersByTime(5000)

    // Assert: the round, and nothing after it
    expect(deck.current).toBe(4)
    expect(runs).toHaveLength(1)
  })

  it("stops Count the bar's round that is sounding when the step is left", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    el('#countBarGame [data-eg-play]').click()

    // Act
    deck.jump(2)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(el('#countBarGame [data-eg-play]').classList.contains('is-on')).toBe(
      false,
    )
  })
})

describe("Lesson 8's Step 5: the predict", () => {
  const stage5 = () => [
    ...document.querySelectorAll<HTMLElement>(
      '#toyBeat [data-step5], #tempoPattern',
    ),
  ]
  /** Whether each part that answers the predict is hidden: its reveal, then the parts after it. */
  const answers = (): boolean[] =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '#predictPattern .reveal, #step-5 [data-pattern-reveal]',
      ),
    ].map((r) => r.hidden)

  it("keeps the stage's Play, March, Rock and Tempo disabled, never aria-disabled, until the choice", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)

    // Assert
    expect(stage5()).toHaveLength(4)
    for (const c of stage5()) {
      expect((c as HTMLButtonElement).disabled, c.outerHTML).toBe(true)
      expect(c.hasAttribute('aria-disabled')).toBe(false)
    }

    // Act
    el('#predictPattern [data-choice="pattern"]').click()

    // Assert
    for (const c of stage5()) {
      expect((c as HTMLButtonElement).disabled).toBe(false)
      expect(c.hasAttribute('aria-disabled')).toBe(false)
    }
    // Step 2's Tempo works throughout
    expect(el<HTMLInputElement>('#tempoMetro').disabled).toBe(false)
  })

  it('reveals once both plays are heard to their ends, and the answers come with it', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    el('#predictPattern [data-choice="same"]').click()
    expect(answers().every((h) => h)).toBe(true)

    // Act
    el('#predictPattern [data-play="march"]').click()
    runs[0].end(true)
    await settle()

    // Assert: one heard is not both
    expect(answers().every((h) => h)).toBe(true)

    // Act
    el('#predictPattern [data-play="rock"]').click()
    runs[1].end(true)
    await settle()

    // Assert
    expect(answers().every((h) => !h)).toBe(true)
    expect(el('#predictPattern .reveal .mono').textContent).toBe(
      'You said: yes, the same speed now',
    )
  })

  it('reveals nothing after a play cut short by leaving the step, by another play or by Stop', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    el('#predictPattern [data-choice="pattern"]').click()

    // Act: the march cut by leaving the step, the rock by another sound on the page, the march by Stop
    el('#predictPattern [data-play="march"]').click()
    deck.show(4)
    deck.show(5)
    await settle()
    el('#predictPattern [data-play="rock"]').click()
    NowPlaying.claim(() => undefined)
    await settle()
    el('#predictPattern [data-play="march"]').click()
    stageStart().click()
    await settle()

    // Assert
    expect(runs.map((r) => r.stopped)).toEqual([true, true, true])
    expect(answers().every((h) => h)).toBe(true)
  })
})
