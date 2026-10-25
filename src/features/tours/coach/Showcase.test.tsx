// The showcase as a singer meets it after "Show me around": Merc stands by
// each part of the tab bar in turn and moves on by himself, on a tap or on a
// key; Skip ends it; nothing hops while the cookie banner waits; the phone's
// More opens and closes again; under reduced motion nothing travels. The tab
// bar is a stand-in with the real selectors, laid out by hand, since jsdom
// lays nothing out.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import type { ShowcaseEnd } from './Showcase'
import { HOP_MS, Showcase } from './Showcase'
import { showcaseStops, STOP_MS } from './showcase-stops'

// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** Lays `el` out at `box`, as the browser would. */
function place(el: HTMLElement, box: Box): HTMLElement {
  el.getBoundingClientRect = () =>
    ({
      ...box,
      x: box.left,
      y: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
      toJSON: () => box,
    }) as DOMRect
  return el
}

const GROUPS = ['you', 'practice', 'play', 'studio'] as const

/** The wide screen's top bar: four groups across the top. */
function topBar(): void {
  GROUPS.forEach((id, i) => {
    const group = document.createElement('div')
    group.dataset.tabGroup = id
    document.body.append(
      place(group, { top: 8, left: 100 + i * 220, width: 200, height: 40 }),
    )
  })
}

const RAIL_TOP = 772

/** The phone's rail: four tabs and More, whose tap opens a sheet that Escape closes. */
function rail(): { more: HTMLButtonElement; opened: () => HTMLElement | null } {
  const nav = document.createElement('nav')
  nav.dataset.tour = 'mobile-tabbar'
  ;['tab-home', 'tab-path', 'tab-progress', 'tab-singing'].forEach((id, i) => {
    const tab = document.createElement('button')
    tab.id = id
    nav.append(
      place(tab, { top: RAIL_TOP, left: 12 + i * 74, width: 70, height: 56 }),
    )
  })
  const more = document.createElement('button')
  more.dataset.tour = 'mobile-tabbar-more'
  place(more, { top: RAIL_TOP, left: 308, width: 70, height: 56 })
  more.addEventListener('click', () => {
    const sheet = document.createElement('div')
    sheet.dataset.testid = 'sheet-panel'
    sheet.setAttribute('aria-label', 'More tabs')
    sheet.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') sheet.remove()
    })
    document.body.append(
      place(sheet, { top: 420, left: 0, width: 390, height: 424 }),
    )
  })
  nav.append(more)
  document.body.append(nav)
  const opened = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-testid="sheet-panel"]')
  return { more, opened }
}

let onEnd: Mock<(result: ShowcaseEnd) => void>
let held: { set: (v: boolean) => void }

function show(phone: boolean, heldAtFirst = false): void {
  const [isHeld, setHeld] = createSignal(heldAtFirst)
  held = { set: setHeld }
  render(() => (
    <Showcase
      stops={showcaseStops({ phone, scope: 'all', mode: 'advanced' })}
      phone={phone}
      held={isHeld}
      onEnd={onEnd}
    />
  ))
}

const line = (): string | null =>
  screen.queryByTestId('showcase-line')?.textContent ?? null
const layer = (): HTMLElement => screen.getByTestId('showcase')
const mercBox = (): HTMLElement => screen.getByTestId('showcase-merc-box')

/** The x and y a stop's element was moved to. */
function at(el: HTMLElement): { x: number; y: number } {
  const match = /translate\((-?\d+)px, (-?\d+)px\)/u.exec(el.style.transform)
  if (match === null) throw new Error(`no position on ${el.dataset.testid}`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

function size(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
  })
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  onEnd = vi.fn<(result: ShowcaseEnd) => void>()
  size(1440, 900)
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const DESKTOP_LINES = showcaseStops({
  phone: false,
  scope: 'all',
  mode: 'advanced',
}).map((stop) => stop.line)

describe('the walk', () => {
  it('waits for the cookie answer before the first hop', () => {
    topBar()
    show(false, true)

    vi.advanceTimersByTime(STOP_MS * 4)
    expect(line()).toBeNull()
    expect(onEnd).not.toHaveBeenCalled()
    // Skip is there all the while.
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy()

    held.set(false)
    expect(line()).toBe(DESKTOP_LINES[0])
    vi.advanceTimersByTime(STOP_MS)
    expect(line()).toBe(DESKTOP_LINES[1])
  })

  it('stands by each group in turn, moves on by itself after STOP_MS, and is done after the last', () => {
    topBar()
    show(false)

    const seen = [line()]
    for (let i = 1; i < DESKTOP_LINES.length; i++) {
      vi.advanceTimersByTime(STOP_MS - 1)
      expect(line()).toBe(seen.at(-1))
      vi.advanceTimersByTime(1)
      seen.push(line())
    }
    expect(seen).toEqual(DESKTOP_LINES)
    expect(layer().dataset.stop).toBe('studio')

    vi.advanceTimersByTime(STOP_MS)
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('done')
  })

  it('moves on when tapped, anywhere or on his line', () => {
    topBar()
    show(false)

    fireEvent.click(screen.getByTestId('showcase-catcher'))
    expect(line()).toBe(DESKTOP_LINES[1])
    fireEvent.click(screen.getByTestId('showcase-bubble'))
    expect(line()).toBe(DESKTOP_LINES[2])
  })

  it('ends on Skip, and moves no further', () => {
    topBar()
    show(false)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    vi.advanceTimersByTime(STOP_MS * 6)

    expect(onEnd).toHaveBeenCalledExactlyOnceWith('skipped')
  })

  it('does not hop on a tap while the cookie banner is back', () => {
    topBar()
    show(false)
    held.set(true)

    fireEvent.click(screen.getByTestId('showcase-catcher'))
    vi.advanceTimersByTime(STOP_MS * 3)

    expect(line()).toBe(DESKTOP_LINES[0])
    held.set(false)
    vi.advanceTimersByTime(STOP_MS)
    expect(line()).toBe(DESKTOP_LINES[1])
  })

  it('passes over a stop whose target is not on the page', () => {
    topBar()
    document.querySelector('[data-tab-group="play"]')?.remove()
    show(false)

    vi.advanceTimersByTime(STOP_MS * 2)

    expect(line()).toBe(DESKTOP_LINES[3])
  })

  it('is done at once when nothing it would stand by is there', () => {
    show(false)

    expect(onEnd).toHaveBeenCalledExactlyOnceWith('done')
  })
})

describe('keys', () => {
  it('takes focus, so its keys work from the start', async () => {
    topBar()
    show(false)
    await Promise.resolve()

    expect(document.activeElement).toBe(layer())
  })

  it('moves on with Enter and the right arrow, skips on Escape, and keeps every key from the window', () => {
    topBar()
    show(false)
    const heard = vi.fn()
    window.addEventListener('keydown', heard)

    fireEvent.keyDown(layer(), { key: 'Enter' })
    expect(line()).toBe(DESKTOP_LINES[1])
    fireEvent.keyDown(layer(), { key: 'ArrowRight' })
    expect(line()).toBe(DESKTOP_LINES[2])
    fireEvent.keyDown(layer(), { key: ' ' })
    fireEvent.keyDown(layer(), { key: 'Escape' })

    expect(onEnd).toHaveBeenCalledExactlyOnceWith('skipped')
    expect(heard).not.toHaveBeenCalled()
    window.removeEventListener('keydown', heard)
  })
})

describe('on a phone', () => {
  beforeEach(() => size(390, 844))

  it("hops the rail's four tabs, then opens More and closes it again as it moves on", () => {
    const { opened } = rail()
    show(true)

    const ids = [layer().dataset.stop]
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(STOP_MS)
      ids.push(layer().dataset.stop)
    }
    expect(ids).toEqual(['home', 'path', 'progress', 'singing', 'more'])
    expect(opened()).not.toBeNull()
    expect(line()).toMatch(/^Everything else lives here: /u)

    vi.advanceTimersByTime(STOP_MS)
    expect(opened()).toBeNull()
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('done')
  })

  it('closes More on Skip too', () => {
    const { opened } = rail()
    show(true)
    vi.advanceTimersByTime(STOP_MS * 4)
    expect(opened()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(opened()).toBeNull()
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('skipped')
  })

  it('stands Merc on the rail over his tab, with the line hung above him', () => {
    rail()
    show(true)

    const merc = at(mercBox())
    const bubble = screen.getByTestId('showcase-bubble')
    // Over the Home tab, clear of the ring that stands 8px outside it.
    expect(merc.x + 48 / 2).toBe(12 + 70 / 2)
    expect(merc.y + 48).toBeLessThanOrEqual(RAIL_TOP - 8)
    // The line hangs from its bottom edge, 6px over Merc, so it clears him
    // from its first frame whatever its height, and stops 8px short of the
    // window's top.
    expect(bubble.style.transform).toMatch(/translateY\(-100%\)$/u)
    expect(at(bubble).y).toBe(merc.y - 6)
    expect(bubble.style.maxHeight).toBe(`${merc.y - 6 - 8}px`)
  })

  it('stands Merc on the open sheet at More', () => {
    rail()
    show(true)
    vi.advanceTimersByTime(STOP_MS * 4)

    expect(at(mercBox()).y + 48).toBeLessThanOrEqual(420 - 8)
  })
})

describe('on a wide screen', () => {
  it('puts the line under Merc, under the group', () => {
    topBar()
    show(false)

    const merc = at(mercBox())
    const bubble = screen.getByTestId('showcase-bubble')
    expect(bubble.style.transform).not.toContain('translateY')
    expect(at(bubble).y).toBe(merc.y + 56 + 6)
    expect(bubble.style.maxHeight).toBe('')
  })
})

describe('motion', () => {
  it('hops a moving Merc on a wide screen: one Merc, under each group, in his hop for HOP_MS', () => {
    topBar()
    show(false)
    const first = mercBox()
    expect(layer().dataset.motion).toBe('hop')
    // Under the first group: its bottom (48), the ring's 8 and a gap.
    expect(at(first).y).toBeGreaterThanOrEqual(48 + 8)

    vi.advanceTimersByTime(STOP_MS)

    expect(mercBox()).toBe(first)
    expect(first.dataset.hopping).toBe('')
    expect(at(first).x).toBe(100 + 220 + 200 / 2 - 56 / 2)
    vi.advanceTimersByTime(HOP_MS)
    expect(first.dataset.hopping).toBeUndefined()
  })

  it('cross-fades instead of hopping under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    topBar()
    show(false)
    const first = mercBox()
    expect(layer().dataset.motion).toBe('fade')

    vi.advanceTimersByTime(STOP_MS)

    // A new Merc where the next stop is, which fades in; none travelled.
    expect(mercBox()).not.toBe(first)
    expect(mercBox().dataset.hopping).toBeUndefined()
    expect(line()).toBe(DESKTOP_LINES[1])
  })
})
