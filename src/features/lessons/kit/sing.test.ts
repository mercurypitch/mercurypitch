// ============================================================
// Lesson sing tests — two sing cards on one page, each with its own ring
// ============================================================
//
// And the ring on the page's frame loop: at rest it asks for no frame, and
// a run draws every frame from the one that starts it to the one that ends
// it, once the ring is on screen.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { handLoop } from './frame-loop.test-fixtures'
import type { Ring, RingRun } from './sing'
import { mountRing, mountSing, ringPhase, swellAt } from './sing'
import { Sound } from './sound'

const STILLS = { blue: '/stills/blue.webp', orange: '/stills/orange.webp' }

/** A sing card's markup: the ring's parts, and a button for A3 and for A4. */
function singCard(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div class="ring"><svg><circle class="ring-progress" r="182"></circle><circle class="ring-breath" r="150"></circle><g class="ring-ripples"></g></svg><img class="ring-merc" alt=""><p class="ring-note"></p><p class="ring-state"></p></div><button type="button" class="low">A3</button><button type="button" class="high">A4</button>`
  document.body.appendChild(root)
  mountSing(root, {
    stills: STILLS,
    notes: [
      { button: button(root, '.low'), which: 'blue', midi: 57 },
      { button: button(root, '.high'), which: 'orange', midi: 69 },
    ],
  })
  return root
}

function button(root: HTMLElement, selector: string): HTMLButtonElement {
  const b = root.querySelector<HTMLButtonElement>(selector)
  if (b === null) throw new Error(`no ${selector}`)
  return b
}

const text = (root: HTMLElement, selector: string): string =>
  root.querySelector(selector)?.textContent ?? ''
const waiting = (root: HTMLElement): boolean[] =>
  Array.from(root.querySelectorAll('button')).map((b) => b.disabled)

/** A ring on its own, in the page: its circles, ripples, still and lines. */
function ringEl(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div class="ring"><svg><circle class="ring-progress" r="182"></circle><circle class="ring-breath" r="150"></circle><g class="ring-ripples"></g></svg><img class="ring-merc" alt=""><p class="ring-note"></p><p class="ring-state"></p></div>`
  document.body.appendChild(root)
  const el = root.querySelector<HTMLElement>('.ring')
  if (el === null) throw new Error('no ring')
  return el
}

const ripples = (el: HTMLElement): number =>
  el.querySelectorAll('.ring-ripples circle').length

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Sound.set('unset')
  document.body.textContent = ''
})

describe('mountSing', () => {
  it("runs the ring of the card whose button was pressed, and holds only that card's buttons", () => {
    // Arrange
    const a = singCard()
    const b = singCard()

    // Act
    button(a, '.high').click()

    // Assert: Tavi sings A4 in card A; card B is untouched
    expect(text(a, '.ring-note')).toBe('A4 · 440 Hz')
    expect(text(a, '.ring-state')).toBe('Listen')
    expect(a.querySelector('img')?.getAttribute('src')).toBe(STILLS.orange)
    expect(waiting(a)).toEqual([true, true])
    expect(text(b, '.ring-state')).toBe('')
    expect(waiting(b)).toEqual([false, false])
  })

  it("says a run's own words over the ring's, as a guide's silent count-in does", () => {
    // Arrange: a ring on its own, as Lesson 2's slide guide drives it
    const root = document.createElement('div')
    root.innerHTML = `<div class="ring"><svg><circle class="ring-progress" r="182"></circle><circle class="ring-breath" r="150"></circle><g class="ring-ripples"></g></svg><img class="ring-merc" alt=""><p class="ring-note"></p><p class="ring-state"></p></div>`
    document.body.appendChild(root)
    const ringEl = root.querySelector<HTMLElement>('.ring')
    if (ringEl === null) throw new Error('no ring')
    const ring = mountRing(ringEl, { stills: STILLS })

    // Act
    void ring.run({
      which: 'blue',
      label: 'A3 · 220 Hz',
      listen: 1,
      turn: 4.2,
      ripples: false,
      words: { listen: 'Get ready' },
    })

    // Assert
    expect(text(root, '.ring-state')).toBe('Get ready')
    expect(ring.busy).toBe(true)
  })
})

describe("a run's phases (Lesson 5's Listen · Breathe · Sing)", () => {
  const hold: RingRun = {
    which: 'blue',
    label: 'A3 · 220 Hz',
    listen: 2,
    breathe: 2,
    turn: 10,
    exhale: true,
  }

  it("runs Merc's note, then the in-breath, then the turn, then rests", () => {
    // Act
    const at = [1, 2.5, 4.5, 14.5].map((s) => ringPhase(hold, s))

    // Assert
    expect(at).toEqual([
      { phase: 'listen', h: 1 },
      { phase: 'breathe', h: 0.5 },
      { phase: 'turn', h: 0.5 },
      { phase: 'done', h: 0.5 },
    ])
  })

  it('keeps the old run, with no in-breath, exactly as it was: Merc, then the turn', () => {
    // Arrange
    const hum: RingRun = { which: 'orange', label: 'A4', listen: 2.4, turn: 4 }

    // Act + Assert
    expect(ringPhase(hum, 2.5).phase).toBe('turn')
    expect(ringPhase(hum, 2.5).h).toBeCloseTo(0.1, 9)
    expect(swellAt(hum, 'turn', 1)).toBeCloseTo(1, 9)
    expect(swellAt(hum, 'turn', 2)).toBeCloseTo(0, 9)
  })

  it('swells once over the in-breath, then settles once over the held turn', () => {
    // Act
    const swell = [0, 1, 2].map((h) => swellAt(hold, 'breathe', h))
    const settle = [0, 5, 10, 12].map((h) => swellAt(hold, 'turn', h))

    // Assert
    expect(swell[0]).toBeCloseTo(0, 9)
    expect(swell[1]).toBeCloseTo(0.5, 9)
    expect(swell[2]).toBeCloseTo(1, 9)
    expect(settle[0]).toBeCloseTo(1, 9)
    expect(settle[1]).toBeCloseTo(0.5, 9)
    expect(settle[2]).toBeCloseTo(0, 9)
    expect(settle[3]).toBeCloseTo(0, 9)
  })
})

describe('a run ended where it stands (`stop`)', () => {
  /** A ring on its own, as a lesson's own page drives it. */
  function lone(): { root: HTMLElement; ring: Ring } {
    const root = document.createElement('div')
    root.innerHTML = `<div class="ring"><svg><circle class="ring-progress" r="182"></circle><circle class="ring-breath" r="150"></circle><g class="ring-ripples"></g></svg><img class="ring-merc" alt=""><p class="ring-note"></p><p class="ring-state"></p></div>`
    document.body.appendChild(root)
    const ringEl = root.querySelector<HTMLElement>('.ring')
    if (ringEl === null) throw new Error('no ring')
    return { root, ring: mountRing(ringEl, { stills: STILLS }) }
  }

  const take: RingRun = {
    which: 'blue',
    label: 'One siren',
    listen: 0,
    turn: 6,
    words: { turn: () => 'Listening', done: 'Listening' },
  }

  it('says the word it is given once the run is over', () => {
    // Arrange
    const { root, ring } = lone()
    void ring.run(take)

    // Act
    ring.stop('Rest')

    // Assert
    expect(text(root, '.ring-state')).toBe('Rest')
    expect(ring.busy).toBe(false)
  })

  it("leaves the run's own last word when given none, as it always has", () => {
    // Arrange
    const { root, ring } = lone()
    void ring.run({ ...take, words: { done: 'Ready' } })

    // Act
    ring.stop()

    // Assert
    expect(text(root, '.ring-state')).toBe('Ready')
  })

  it('says the word it is given with no run to end', () => {
    // Arrange
    const { root, ring } = lone()

    // Act
    ring.stop('Rest')

    // Assert
    expect(text(root, '.ring-state')).toBe('Rest')
  })
})

describe("the ring on the page's frame loop", () => {
  it('asks for no frame at rest, then for every frame of a run until the ring is back at rest', async () => {
    // Arrange: a ring on screen, settled
    const { asked, settle, see } = await handLoop()
    const { mountRing } = await import('./sing')
    const el = ringEl()
    const ring = mountRing(el, { stills: STILLS })
    see(el)
    settle()
    const resting = asked.length

    // Act: a second of Merc's note, then a second of the turn
    const done = ring.run({ which: 'blue', label: 'A3', listen: 1, turn: 1 })
    const woken = asked.length
    const frames = settle()

    // Assert: a frame every 16 ms for the run's two seconds, and none after it
    expect(resting).toBe(0)
    expect(woken).toBe(1)
    expect(frames).toBe(125)
    await expect(done).resolves.toBeUndefined()
    expect(asked).toHaveLength(0)
  })

  it('asks for no frame once a run is stopped where it stands', async () => {
    // Arrange: a run ten frames in
    const { asked, frame, settle, see } = await handLoop()
    const { mountRing } = await import('./sing')
    const el = ringEl()
    const ring = mountRing(el, { stills: STILLS })
    see(el)
    settle()
    void ring.run({ which: 'orange', label: 'A4', listen: 2.4, turn: 4 })
    for (let i = 0; i < 10; i += 1) frame()
    const running = asked.length

    // Act
    ring.stop()
    const after = settle()

    // Assert: the frame already asked for draws nothing and asks for no other
    expect(running).toBe(1)
    expect(after).toBe(1)
    expect(asked).toHaveLength(0)
    expect(ring.busy).toBe(false)
  })

  it('holds a run started off screen until the ring is seen, then draws it every frame', async () => {
    // Arrange: a ring that has not come into view
    const { asked, settle, see } = await handLoop()
    const { mountRing } = await import('./sing')
    const el = ringEl()
    const ring = mountRing(el, { stills: STILLS })
    settle()

    // Act: a run off screen, then the ring comes into view
    void ring.run({ which: 'blue', label: 'A3', listen: 1, turn: 1 })
    const offScreen = settle()
    const drawnOff = ripples(el)
    see(el)
    const seen = settle(10)

    // Assert: off screen only the frame its start asked for, drawing nothing
    expect(offScreen).toBe(1)
    expect(drawnOff).toBe(0)
    expect(seen).toBe(10)
    expect(ripples(el)).toBeGreaterThan(0)
    expect(asked).toHaveLength(1)
  })
})
