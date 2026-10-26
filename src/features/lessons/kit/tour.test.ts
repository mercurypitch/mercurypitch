// ============================================================
// Lesson tour tests — the steps a page shows, the keyboard, focus and the wait for layers
// ============================================================
//
// jsdom lays nothing out, so a test draws each target it means to show
// (`draw`): a box, and the client rects a drawn element has. An element left
// undrawn has none, as an element under display: none has none in a browser.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { touring } from './dom'
import { atTop, closeTour, footOf, layerOpen, pageSteps, RECORD, runTour, scrollFor, sideFor, } from './tour'
import { TOUR_STEPS } from './tour-copy'
import { atTop as gateAtTop, TOUR_KEY, TOUR_VERSION } from './tour-gate'

/** Gives `el` a box at (x, y), w by h, and the client rects of a drawn element. */
function draw(el: Element, x = 0, y = 120, w = 400, h = 300): void {
  const r = {
    x,
    y,
    width: w,
    height: h,
    left: x,
    top: y,
    right: x + w,
    bottom: y + h,
  }
  el.getBoundingClientRect = () => r as DOMRect
  el.getClientRects = () => [r] as unknown as DOMRectList
}

/** A lesson page with every target the tour knows, each drawn, a page button focused. */
function page(): HTMLButtonElement {
  document.body.innerHTML = `<header class="mast" id="mast"><button class="lm-btn">Lesson 03</button><nav id="mastNav"></nav></header>
    <main><button id="pageBtn">Play Merc's A</button>
    <div id="heroStage"></div><div id="stepsStage"></div><section id="sing"></section>
    <div id="graph"></div><ol id="exList"></ol></main>`
  for (const s of [
    '.lm-btn',
    '#mastNav',
    '#heroStage',
    '#stepsStage',
    '#sing',
    '#graph',
    '#exList',
  ])
    draw(document.querySelector(s) as Element)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const btn = document.getElementById('pageBtn') as HTMLButtonElement
  btn.focus()
  return btn
}

/** Where the page stands: its hash and how far down it is scrolled. */
function pageAt(hash: string, scrollY: number): void {
  window.location.hash = hash
  Object.defineProperty(window, 'scrollY', {
    value: scrollY,
    configurable: true,
  })
}

const card = (): HTMLElement | null => document.querySelector('[role="dialog"]')
const title = (): string =>
  document.getElementById('tourTitle')?.textContent ?? ''
/** A key pressed where the focus is, or on `at`. */
const key = (
  k: string,
  shiftKey = false,
  at = document.activeElement,
): void => {
  at?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: k,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }),
  )
}

/** Reduced motion off, as most viewers have it: the browser doubles turn it on. */
function motionAllowed(): void {
  const doubles = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    ...doubles(query),
    matches: query.includes('prefers-reduced-motion')
      ? false
      : doubles(query).matches,
  }))
}

/** Next, pressed until the tour closes on Done. */
const walkToDone = (): void => {
  for (let i = 0; i < 5; i++)
    document.querySelector<HTMLButtonElement>('[data-tour-next]')?.click()
}

/** A frame's worth of time, `n` times over, with the page at each of `ys` in turn when given. */
async function frames(n: number, ys: readonly number[] = []): Promise<void> {
  for (let i = 0; i < n; i++) {
    if (i < ys.length) pageAt('', ys[i])
    await vi.advanceTimersByTimeAsync(16)
  }
}

afterEach(() => {
  closeTour()
  pageAt('', 0)
  localStorage.clear()
  document.body.textContent = ''
  document.getElementById('tourSheet')?.remove()
  document.documentElement.classList.remove('touring', 'motion-paused')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('pageSteps', () => {
  it('leaves out a step whose targets are missing, and one whose targets are hidden', () => {
    // Arrange: no Sing it on this page, the map's graph hidden and its list undrawn
    page()
    document.getElementById('sing')?.remove()
    document.getElementById('graph')?.setAttribute('hidden', '')
    const list = document.getElementById('exList') as HTMLElement
    list.getClientRects = () => [] as unknown as DOMRectList

    // Act
    const steps = pageSteps(1)

    // Assert
    expect(steps.map((s) => s.title)).toEqual([
      'Meet Merc and Tavi',
      'One step at a time',
      'Find your way',
    ])
  })

  it('lights every target of a step that shows, and leaves out one under visibility: hidden', () => {
    // Arrange: a phone's masthead, its section links not shown
    page()
    const nav = document.getElementById('mastNav') as HTMLElement
    nav.style.visibility = 'hidden'

    // Act
    const mast = pageSteps(1).at(-1)

    // Assert
    expect(mast?.targets.map((el) => el.className)).toEqual(['lm-btn'])
  })

  it('names the microphone in Sing it on each lesson that listens, and not on one that never does', () => {
    // Arrange
    page()
    const sing = TOUR_STEPS[2]
    const body = (lesson: number): string | undefined =>
      pageSteps(lesson).find((s) => s.title === sing.title)?.body

    // Act
    const listens = [3, 5, 7, 9].map(body)
    const never = [1, 2, 4, 6, 8].map(body)

    // Assert
    expect(listens).toEqual(Array(4).fill(`${sing.body} ${sing.listening}`))
    expect(never).toEqual(Array(5).fill(sing.body))
  })
})

describe('runTour', () => {
  it('opens on Merc and Tavi as step 1 of five, with the focus in the card', () => {
    // Arrange
    page()

    // Act
    void runTour(1, true)

    // Assert
    expect(title()).toBe('Meet Merc and Tavi')
    expect(document.querySelector('.tour-count')?.textContent).toBe('1 of 5')
    expect(card()?.contains(document.activeElement)).toBe(true)
    expect(card()?.getAttribute('aria-modal')).toBe('true')
  })

  it('goes forward with Enter and Next, back with Back, and says Done on the last step', () => {
    // Arrange: Enter on a card button is that button's own (a browser clicks it), so it is pressed off one
    page()
    void runTour(1, true)
    const next = document.querySelector<HTMLButtonElement>('[data-tour-next]')

    // Act
    key('Enter', false, document.getElementById('tourTitle'))
    next?.click()
    document.querySelector<HTMLButtonElement>('[data-tour-back]')?.click()
    const back = title()
    next?.click()
    next?.click()
    next?.click()

    // Assert
    expect(back).toBe('One step at a time')
    expect(title()).toBe('Find your way')
    expect(next?.textContent).toBe('Done')
  })

  it('keeps the spotlight on a target that moves with no scroll or resize, as a reveal moves it', async () => {
    // Arrange
    vi.useFakeTimers()
    page()
    await runTour(1, true)
    const spot = document.querySelector<HTMLElement>('.tour-spot')

    // Act: Merc and Tavi's stage ends its reveal higher and taller, with no event to say so
    draw(document.getElementById('heroStage') as Element, 0, 100, 400, 320)
    await vi.advanceTimersByTimeAsync(100)

    // Assert: the cutout is 8 px out from the stage's new box
    expect(spot?.style.transform).toBe('translate(-8px, 92px)')
    expect(spot?.style.height).toBe('336px')
  })

  it('closes with Escape as Skip does, and hands the focus back to where it was', () => {
    // Arrange
    const before = page()
    void runTour(1, true)

    // Act
    key('Escape')

    // Assert
    expect(card()).toBeNull()
    expect(localStorage.getItem(TOUR_KEY)).toBe(TOUR_VERSION)
    expect(document.activeElement).toBe(before)
  })

  it('keeps Tab inside the card: past the last stop to the first, and Shift+Tab back to the last', () => {
    // Arrange
    page()
    void runTour(1, true)
    const stops = Array.from(
      card()?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [],
    )
    stops.at(-1)?.focus()

    // Act
    key('Tab')
    const forward = document.activeElement
    key('Tab', true)

    // Assert
    expect(forward).toBe(stops[0])
    expect(document.activeElement).toBe(stops.at(-1))
  })

  it('makes the rest of the page inert while it is up, and gives it back after', () => {
    // Arrange
    page()
    void runTour(1, true)
    const during = document.querySelector('main')?.hasAttribute('inert')

    // Act
    document.querySelector<HTMLElement>('.tour-x')?.click()

    // Assert
    expect(during).toBe(true)
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('waits on a first visit while a dialog is open, and opens once it closes', async () => {
    // Arrange
    vi.useFakeTimers()
    page()
    const menu = document.createElement('dialog')
    menu.setAttribute('open', '')
    document.body.appendChild(menu)
    const run = runTour(1, false)
    await vi.advanceTimersByTimeAsync(1200)
    const waited = card()

    // Act
    menu.removeAttribute('open')
    await vi.advanceTimersByTimeAsync(400)
    await run

    // Assert
    expect(waited).toBeNull()
    expect(title()).toBe('Meet Merc and Tavi')
  })

  it('gives up on a first visit when the page left the top while it waited', async () => {
    // Arrange
    vi.useFakeTimers()
    page()
    const film = document.createElement('video')
    Object.defineProperty(film, 'paused', { value: false, configurable: true })
    document.body.appendChild(film)
    const run = runTour(1, false)
    await vi.advanceTimersByTimeAsync(400)

    // Act: the viewer scrolled away, then the film stopped
    pageAt('', 600)
    Object.defineProperty(film, 'paused', { value: true, configurable: true })
    await vi.advanceTimersByTimeAsync(400)
    await run

    // Assert: not shown, and not recorded, so another page offers it
    expect(card()).toBeNull()
    expect(localStorage.getItem(TOUR_KEY)).toBeNull()
  })
})

describe('moving the page', () => {
  it('glides to a step out of view', () => {
    // Arrange: reduced motion off, the step deck below the fold
    motionAllowed()
    page()
    draw(document.getElementById('stepsStage') as Element, 0, 1500)
    void runTour(1, true)

    // Act
    document.querySelector<HTMLButtonElement>('[data-tour-next]')?.click()

    // Assert
    expect(window.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    )
  })

  it('moves to a step out of view at once under reduced motion', () => {
    // Arrange: the browser doubles' reduced motion, the step deck below the fold
    page()
    draw(document.getElementById('stepsStage') as Element, 0, 1500)
    void runTour(1, true)

    // Act
    document.querySelector<HTMLButtonElement>('[data-tour-next]')?.click()

    // Assert
    expect(window.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: 'instant' }),
    )
  })

  it("moves to a step out of view at once with the page's animations paused", () => {
    // Arrange: reduced motion off, Pause animations pressed (motion-switch.ts)
    motionAllowed()
    document.documentElement.classList.add('motion-paused')
    page()
    draw(document.getElementById('stepsStage') as Element, 0, 1500)
    void runTour(1, true)

    // Act
    document.querySelector<HTMLButtonElement>('[data-tour-next]')?.click()

    // Assert
    expect(window.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: 'instant' }),
    )
  })

  it('glides back to where the page was on close', () => {
    // Arrange: reduced motion off, the tour opened at the top, the page now 1,200 px down
    motionAllowed()
    page()
    void runTour(1, true)
    pageAt('', 1200)

    // Act
    key('Escape')

    // Assert
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: 'smooth',
    })
  })
})

describe('the pause on reading while the tour is up', () => {
  it('marks the page touring from the moment the tour opens', () => {
    // Arrange
    page()
    const before = touring()

    // Act
    void runTour(1, true)

    // Assert
    expect([before, touring()]).toEqual([false, true])
  })

  const ways: ReadonlyArray<[string, () => void]> = [
    ['Done', walkToDone],
    [
      'Skip tour',
      () => document.querySelector<HTMLElement>('.tour-skip')?.click(),
    ],
    ['the X', () => document.querySelector<HTMLElement>('.tour-x')?.click()],
    ['Escape', () => key('Escape')],
    ['closeTour, as a page leaving calls it', closeTour],
  ]

  for (const [way, closeIt] of ways) {
    it(`is lifted once the page is at rest after ${way}, and not before`, async () => {
      // Arrange
      vi.useFakeTimers()
      page()
      await runTour(1, true)

      // Act
      closeIt()
      const closing = touring()
      await frames(8)

      // Assert: still paused in the close itself, lifted a few still frames on
      expect(card()).toBeNull()
      expect(closing).toBe(true)
      expect(touring()).toBe(false)
    })
  }

  it('is lifted when the tour fails as it opens, with the page given back and no record written', async () => {
    // Arrange: Merc and Tavi's stage cannot be measured as the tour opens on it
    vi.useFakeTimers()
    page()
    const stage = document.getElementById('heroStage') as HTMLElement
    stage.getBoundingClientRect = () => {
      throw new Error('gone')
    }

    // Act
    await runTour(1, true)
    await frames(8)

    // Assert
    expect(card()).toBeNull()
    expect(document.querySelector('[inert]')).toBeNull()
    expect(touring()).toBe(false)
    expect(localStorage.getItem(TOUR_KEY)).toBeNull()
  })

  it('holds while the scroll back glides past the steps, and lifts once it is still at the top', async () => {
    // Arrange: the tour opened at the top and left the page 1,200 px down
    vi.useFakeTimers()
    page()
    await runTour(1, true)
    pageAt('', 1200)
    key('Escape')

    // Act: the glide back takes six frames, a frame's report after each
    const during: boolean[] = []
    for (const y of [1000, 800, 600, 400, 200, 0]) {
      await frames(1, [y])
      during.push(touring())
    }
    await frames(8)

    // Assert
    expect(during).toEqual([true, true, true, true, true, true])
    expect(touring()).toBe(false)
  })

  it('holds through frames the scroll back has not yet moved in, short of where it goes', async () => {
    // Arrange: closed 1,200 px down, the glide back to the top not yet begun
    vi.useFakeTimers()
    page()
    await runTour(1, true)
    pageAt('', 1200)
    key('Escape')

    // Act: ten frames at 1,200 px, then the page arrives at the top
    await frames(10)
    const waiting = touring()
    await frames(8, [0])

    // Assert
    expect([waiting, touring()]).toEqual([true, false])
  })

  it("is lifted half a second after a viewer's own scroll stops the glide back short", async () => {
    // Arrange: closed 1,200 px down
    vi.useFakeTimers()
    page()
    await runTour(1, true)
    pageAt('', 1200)
    key('Escape')

    // Act: the glide stopped at 700 px; 20 frames there, then 15 more
    await frames(20, [700])
    const soon = touring()
    await frames(15)

    // Assert
    expect([soon, touring()]).toEqual([true, false])
  })

  it('is lifted after 3 s on a page that draws no frames, as a hidden page does', async () => {
    // Arrange: a page whose frames never come
    vi.useFakeTimers()
    page()
    await runTour(1, true)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0)
    pageAt('', 1200)
    key('Escape')

    // Act
    await vi.advanceTimersByTimeAsync(2900)
    const before = touring()
    await vi.advanceTimersByTimeAsync(200)

    // Assert
    expect([before, touring()]).toEqual([true, false])
  })
})

describe('the copy of the gate the tour keeps', () => {
  it('writes the record the gate reads, and reads the top as the gate does', () => {
    // Arrange: pages at the top, one with a bare #, a deep link, and pages either side of 40 px down
    const places: ReadonlyArray<[string, number]> = [
      ['', 0],
      ['#', 0],
      ['#sing', 0],
      ['', 39],
      ['', 40],
    ]

    // Act
    const tops = places.map(([hash, y]) => {
      pageAt(hash, y)
      return [atTop(), gateAtTop()]
    })

    // Assert
    expect(RECORD).toEqual({ key: TOUR_KEY, version: TOUR_VERSION })
    expect(tops).toEqual([
      [true, true],
      [true, true],
      [false, false],
      [true, true],
      [false, false],
    ])
  })
})

describe('layerOpen', () => {
  it('counts an open dialog and a playing film as layers, and a paused film as none', () => {
    // Arrange
    document.body.innerHTML = '<video></video><dialog></dialog>'
    const film = document.querySelector('video') as HTMLVideoElement
    const quiet = layerOpen()
    Object.defineProperty(film, 'paused', { value: false, configurable: true })
    const playing = layerOpen()
    Object.defineProperty(film, 'paused', { value: true, configurable: true })

    // Act
    document.querySelector('dialog')?.setAttribute('open', '')

    // Assert
    expect([quiet, playing, layerOpen()]).toEqual([false, true, true])
  })
})

describe('placement', () => {
  const room = { w: 1440, h: 900, top: 58 }
  const cardSize = { w: 360, h: 220 }

  it('keeps a target clear of the card: the docked card and its margin on a phone, the card and its gap below, nothing beside', () => {
    // Arrange
    const sides = [
      ['dock', true],
      ['below', false],
      ['dock', false],
      ['right', false],
    ] as const

    // Act
    const feet = sides.map(([side, narrow]) => footOf(side, narrow, cardSize.h))

    // Assert
    expect(feet).toEqual([232, 234, 220, 0])
  })

  it('puts the card beside a target with room to its side, and under one that spans the page', () => {
    // Arrange
    const stage = { x: 800, y: 80, w: 560, h: 420 }
    const section = { x: 40, y: 80, w: 1360, h: 420 }

    // Act
    const sides = [
      sideFor(stage, cardSize, room),
      sideFor(section, cardSize, room),
    ]

    // Assert
    expect(sides).toEqual(['left', 'below'])
  })

  it('docks the card at the foot when a full-width target leaves no room under it', () => {
    // Arrange
    const tall = { x: 40, y: 80, w: 1360, h: 700 }

    // Act
    const side = sideFor(tall, cardSize, room)

    // Assert
    expect(side).toBe('dock')
  })

  it('scrolls a target that shows whole not at all, centres a short one and tops a tall one', () => {
    // Arrange
    const inView = { x: 0, y: 100, w: 10, h: 200 }
    const below = { x: 0, y: 1500, w: 10, h: 200 }
    const tall = { x: 0, y: 1500, w: 10, h: 2000 }

    // Act
    const moves = [inView, below, tall].map((b) => scrollFor(b, 70, 888))

    // Assert
    expect(moves).toEqual([0, 1500 - (70 + (818 - 200) / 2), 1500 - 70])
  })
})
