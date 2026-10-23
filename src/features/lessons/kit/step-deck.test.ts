// ============================================================
// Lesson step deck tests — an address that names a step opens the deck there
// ============================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { ANNOUNCE_DELAY_MS } from './announce'
import { createStepDeck, DECK_QUERY, registerToy, stepFromHash, } from './step-deck'

/** The query of lesson-stage.css's top-level @media block that hides the deck's other steps, or null. */
function deckBlockQuery(css: string): string | null {
  const rule = css.indexOf('\n  .steps.is-deck .step {')
  const open = css.lastIndexOf('\n@media ', rule)
  if (rule < 0 || open < 0 || css.slice(open, rule).includes('\n}')) return null
  return css.slice(open + '\n@media '.length, css.indexOf(' {', open))
}

/** The step observer's callback, handed over by `TellingObserver` so a test can say when a step crosses the middle. */
let report: IntersectionObserverCallback = () => undefined

class TellingObserver {
  constructor(callback: IntersectionObserverCallback) {
    report = callback
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

/** A media query list that matches exactly `query`, as a screen it describes would. */
function onlyMatching(query: string): (asked: string) => MediaQueryList {
  return (asked) => ({
    matches: asked === query,
    media: asked,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })
}

/** A deck of `count` steps, each with a toy of its own. */
function deckPage(count: number): void {
  const steps = Array.from(
    { length: count },
    (_, i) =>
      `<div class="step" data-step="${i + 1}"><h3>Step ${i + 1}</h3></div>`,
  ).join('')
  const toys = Array.from(
    { length: count },
    (_, i) => `<div class="toy" data-toy="${i + 1}"></div>`,
  ).join('')
  document.body.innerHTML = `<section id="lesson"><div class="progress"><i></i><i></i><i></i></div><div id="stepsText">${steps}</div><div id="stepsStage"><div class="stage-card">${toys}</div></div><b id="stepNow"></b><span id="deckNextLabel"></span></section><section id="quiz"></section>`
}

/** A swipe across the step text, `dx` px sideways: left (negative) is the next step. */
function swipe(dx: number): void {
  const text = document.getElementById('stepsText')
  const touch = (type: string, list: string, x: number): Event => {
    const e = new Event(type)
    Object.defineProperty(e, list, { value: [{ clientX: x, clientY: 300 }] })
    return e
  }
  text?.dispatchEvent(touch('touchstart', 'touches', 200))
  text?.dispatchEvent(touch('touchend', 'changedTouches', 200 + dx))
}

const line = (): string =>
  document.querySelector('[data-announcer]')?.textContent ?? ''
const beat = (): Promise<void> =>
  new Promise((r) => setTimeout(r, ANNOUNCE_DELAY_MS + 10))

afterEach(() => {
  window.location.hash = ''
  document.body.textContent = ''
})

describe('stepFromHash', () => {
  it('reads the step an address names, and none from any other address', () => {
    // Act
    const named = stepFromHash('#step-3', 6)
    const others = ['#step-0', '#step-7', '#step-3a', '#lesson', ''].map((h) =>
      stepFromHash(h, 6),
    )

    // Assert
    expect(named).toBe(3)
    expect(others).toEqual([null, null, null, null, null])
  })
})

describe('DECK_QUERY', () => {
  it("is the query lesson-stage.css's deck rules sit under", () => {
    // Arrange
    const css = readFileSync(resolve(__dirname, 'lesson-stage.css'), 'utf-8')

    // Act
    const query = deckBlockQuery(css)

    // Assert
    expect(query).toBe(DECK_QUERY)
    expect(DECK_QUERY).toContain('(max-height: 560px)')
  })

  it('makes the deck of a screen that matches it, a wide one too short for a stuck stage among them', () => {
    // Arrange
    deckPage(3)
    const media = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(onlyMatching(DECK_QUERY))

    // Act
    createStepDeck({
      toyFor: (n) => n,
      after: { label: 'The quick check', selector: '#quiz' },
    })
    media.mockRestore()

    // Assert
    expect(document.getElementById('lesson')?.classList).toContain('is-deck')
  })
})

describe('createStepDeck', () => {
  it('says the step Next moves to, whole, and nothing for a step the scroll reaches', async () => {
    // Arrange: a deck with its Next button; jsdom cannot scroll
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    deckPage(3)
    document
      .getElementById('lesson')
      ?.insertAdjacentHTML(
        'beforeend',
        '<div class="stage-nav"><button type="button" data-step-go="1">Next</button></div>',
      )
    const deck = createStepDeck({
      toyFor: (n) => n,
      after: { label: 'The quick check', selector: '#quiz' },
    })

    // Act: the scroll reaches step 3, then Next is pressed from step 1
    deck.show(3)
    await beat()
    const scrolled = line()
    deck.show(1)
    document.querySelector<HTMLButtonElement>('[data-step-go="1"]')?.click()
    await beat()

    // Assert
    expect(scrolled).toBe('')
    expect(line()).toBe('Step 2 of 3: Step 2')
    vi.restoreAllMocks()
  })

  it('says the step a swipe moves to, and nothing new for a swipe past the last step', async () => {
    // Arrange: a phone's deck, where the step text swipes
    deckPage(3)
    const media = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(onlyMatching(DECK_QUERY))
    const deck = createStepDeck({
      toyFor: (n) => n,
      after: { label: 'The quick check', selector: '#quiz' },
    })
    media.mockRestore()

    // Act: to step 2, then to the last step and past it
    swipe(-100)
    await beat()
    const toTwo = line()
    swipe(-100)
    await beat()
    swipe(-100)
    const pastEnd = line()
    await beat()

    // Assert: the line was not emptied to say step 3 again
    expect(toTwo).toBe('Step 2 of 3: Step 2')
    expect(deck.current).toBe(3)
    expect(pastEnd).toBe('Step 3 of 3: Step 3')
    expect(line()).toBe('Step 3 of 3: Step 3')
  })

  it('says the step a jump from the lesson menu shows', async () => {
    // Arrange: jsdom cannot scroll
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    deckPage(3)
    const deck = createStepDeck({
      toyFor: (n) => n,
      after: { label: 'The quick check', selector: '#quiz' },
    })

    // Act
    deck.jump(3)
    await beat()

    // Assert
    expect(line()).toBe('Step 3 of 3: Step 3')
    vi.restoreAllMocks()
  })

  it('opens on the step the address names and tells every toy', () => {
    // Arrange
    deckPage(3)
    window.location.hash = '#step-3'
    const heard: number[] = []
    const deck = createStepDeck({
      toyFor: (n) => n,
      after: { label: 'The quick check', selector: '#quiz' },
    })
    registerToy({ onStep: (n) => heard.push(n) })

    // Act
    deck.start()

    // Assert
    expect(deck.current).toBe(3)
    expect(heard).toEqual([3])
    expect(
      document.querySelector('.toy.is-active')?.getAttribute('data-toy'),
    ).toBe('3')
    expect(document.getElementById('stepNow')?.textContent).toBe('3')
  })

  it("keeps the step an address names when a scroll's report arrives after it", () => {
    // Arrange: a deck on step 1 whose step observer the test speaks for
    deckPage(3)
    const quiet = window.IntersectionObserver
    window.IntersectionObserver =
      TellingObserver as unknown as typeof IntersectionObserver
    const deck = createStepDeck({
      toyFor: (n) => n,
      after: { label: 'The quick check', selector: '#quiz' },
    })
    window.IntersectionObserver = quiet
    deck.start()
    window.location.hash = '#step-3'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    const two = document.querySelector('[data-step="2"]')

    // Act: the report of a scroll that had reached step 2, delivered late
    report(
      [{ isIntersecting: true, target: two } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )

    // Assert
    expect(deck.current).toBe(3)
  })

  it('centres a step it opens beside the stage, and carries one high in the column on until the stage sticks', () => {
    // Arrange: a 768 px screen under a 70 px scroll padding, the stage sticky
    // 76 px from the top, and its column starting 300 px down the screen
    deckPage(3)
    document.documentElement.style.scrollPaddingTop = '70px'
    const stage = document.getElementById('stepsStage') as HTMLElement
    stage.style.top = '76px'
    const box =
      (top: number, height = 0): (() => DOMRect) =>
      () =>
        ({ top, height }) as DOMRect
    ;(stage.parentElement as HTMLElement).getBoundingClientRect = box(300)
    const steps = document.querySelectorAll<HTMLElement>('.step')
    steps[0].getBoundingClientRect = box(300, 400)
    steps[2].getBoundingClientRect = box(1100, 400)
    const frames = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((frame) => {
        frame(0)
        return 0
      })
    const scroll = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined)
    const deck = createStepDeck({
      toyFor: (n) => n,
      after: { label: 'The quick check', selector: '#quiz' },
    })
    deck.start()

    // Act
    for (const hash of ['#step-3', '#step-1']) {
      window.location.hash = hash
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }

    // Assert: step 3's middle at the middle of the 698 px under the padding;
    // step 1 not centred, but carried on as far as the stage's stuck place
    // (decks from earlier tests still hear the address, and scroll to 0)
    const tops = scroll.mock.calls.map(([to]) => (to as ScrollToOptions).top)
    expect(tops).toContain(1300 - (70 + 768) / 2)
    expect(tops).toContain(300 - 76)
    expect(tops).not.toContain(500 - (70 + 768) / 2)
    frames.mockRestore()
    scroll.mockRestore()
    document.documentElement.style.scrollPaddingTop = ''
  })
})
