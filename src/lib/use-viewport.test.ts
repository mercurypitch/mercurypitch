// ============================================================
// use-viewport — which screens count as a phone held sideways
// ============================================================
//
// jsdom evaluates no media queries, so this stands a small matchMedia in for
// the browser: it reads the handful of features the module asks about
// (width, height, orientation, pointer) against a pretend device. The module
// is imported fresh for each device, because its matches are app-lifetime
// singletons read when it loads.

import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

interface Device {
  width: number
  height: number
  coarse: boolean
}

let device: Device = { width: 1440, height: 900, coarse: false }
const listeners = new Map<string, Set<() => void>>()

function feature(text: string): boolean {
  const m = /^\(\s*([a-z-]+)\s*:\s*([a-z0-9.]+?)(px)?\s*\)$/u.exec(text.trim())
  if (m === null) throw new Error(`the fake cannot read "${text}"`)
  const [, name, value] = m
  switch (name) {
    case 'max-width':
      return device.width <= Number(value)
    case 'max-height':
      return device.height <= Number(value)
    case 'min-width':
      return device.width >= Number(value)
    case 'min-height':
      return device.height >= Number(value)
    case 'orientation':
      return value === (device.width > device.height ? 'landscape' : 'portrait')
    case 'pointer':
      return value === (device.coarse ? 'coarse' : 'fine')
    default:
      throw new Error(`the fake has no ${name}`)
  }
}

/** A comma is "or", `and` joins features. */
const evaluate = (query: string): boolean =>
  query
    .split(',')
    .some((part) => part.split(/\s+and\s+/u).every((f) => feature(f)))

function installMatchMedia(): void {
  window.matchMedia = ((query: string) => {
    const set = listeners.get(query) ?? new Set<() => void>()
    listeners.set(query, set)
    return {
      get matches() {
        return evaluate(query)
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, cb: () => void) => set.add(cb),
      removeEventListener: (_type: string, cb: () => void) => set.delete(cb),
      addListener: (cb: () => void) => set.add(cb),
      removeListener: (cb: () => void) => set.delete(cb),
      dispatchEvent: () => false,
    }
  }) as unknown as typeof window.matchMedia
}

/** The device turns or the window changes: every query is told. */
function changeTo(next: Device): void {
  device = next
  for (const set of listeners.values()) for (const cb of set) cb()
}

async function loadFor(next: Device) {
  device = next
  listeners.clear()
  installMatchMedia()
  vi.resetModules()
  return import('./use-viewport')
}

afterEach(() => {
  vi.resetModules()
})

describe('a short touch screen held sideways', () => {
  // Phones on their side, as their browsers report them (CSS pixels).
  const phones: Array<[string, Device]> = [
    ['iPhone 14, 844x390', { width: 844, height: 390, coarse: true }],
    ['a 360-wide Android, 780x360', { width: 780, height: 360, coarse: true }],
    ['iPhone Pro Max, 932x430', { width: 932, height: 430, coarse: true }],
    ['Pixel 8 Pro, 998x448', { width: 998, height: 448, coarse: true }],
    ['iPhone SE, 667x375', { width: 667, height: 375, coarse: true }],
  ]
  // Everything that keeps the desktop mixer.
  const others: Array<[string, Device]> = [
    [
      'an iPhone held upright, 390x844',
      { width: 390, height: 844, coarse: true },
    ],
    [
      'an 8-inch Android tablet in Chrome, 962x521',
      { width: 962, height: 521, coarse: true },
    ],
    [
      'iPad mini on its side, 1133x744',
      { width: 1133, height: 744, coarse: true },
    ],
    [
      'iPad Air on its side, 1180x820',
      { width: 1180, height: 820, coarse: true },
    ],
    [
      'a short desktop window, 844x390',
      { width: 844, height: 390, coarse: false },
    ],
    ['a touch laptop, 1366x768', { width: 1366, height: 768, coarse: true }],
  ]

  it.each(phones)('counts %s', async (_name, phone) => {
    const viewport = await loadFor(phone)

    expect(viewport.isShortTouchLandscape()).toBe(true)
  })

  it.each(others)('does not count %s', async (_name, other) => {
    const viewport = await loadFor(other)

    expect(viewport.isShortTouchLandscape()).toBe(false)
  })

  it('follows the phone as it turns, both ways', async () => {
    const viewport = await loadFor({ width: 390, height: 844, coarse: true })
    const seen = [viewport.isShortTouchLandscape()]

    changeTo({ width: 844, height: 390, coarse: true })
    seen.push(viewport.isShortTouchLandscape())
    changeTo({ width: 390, height: 844, coarse: true })
    seen.push(viewport.isShortTouchLandscape())

    expect(seen).toEqual([false, true, false])
  })

  it("draws the line at the hosted stage's own short-screen height", async () => {
    const viewport = await loadFor({ width: 900, height: 500, coarse: true })
    const atLine = viewport.isShortTouchLandscape()
    const above = (
      await loadFor({ width: 900, height: 501, coarse: true })
    ).isShortTouchLandscape()

    expect([viewport.SHORT_LANDSCAPE_MAX_HEIGHT, atLine, above]).toEqual([
      500,
      true,
      false,
    ])
  })
})

describe('the phone stage, as a phone turns', () => {
  // A browser tells each media query list of its change on its own. Asked as
  // two lists, "narrow" and "short sideways", the phone was neither between
  // the two notices, and the mixer mounted its desktop layout for that
  // moment. One list answers in one notice.
  it('never passes through the desktop mixer on the way round', async () => {
    const viewport = await loadFor({ width: 390, height: 844, coarse: true })
    const { createComputed, createRoot } = await import('solid-js')
    const seen: boolean[] = []
    const dispose = createRoot((done) => {
      createComputed(() => seen.push(viewport.isPhoneStage()))
      return done
    })

    changeTo({ width: 844, height: 390, coarse: true })
    changeTo({ width: 390, height: 844, coarse: true })
    dispose()

    expect(seen).toEqual([true])
  })

  it.each([
    ['an upright phone, 390x844', { width: 390, height: 844, coarse: true }],
    ['a phone on its side, 844x390', { width: 844, height: 390, coarse: true }],
    [
      'a narrow desktop window, 700x900',
      { width: 700, height: 900, coarse: false },
    ],
  ])('puts %s on the phone stage', async (_name, device) => {
    expect((await loadFor(device)).isPhoneStage()).toBe(true)
  })

  it.each([
    ['a desktop window, 1440x900', { width: 1440, height: 900, coarse: false }],
    [
      'a short desktop window, 844x390',
      { width: 844, height: 390, coarse: false },
    ],
    [
      'iPad mini on its side, 1133x744',
      { width: 1133, height: 744, coarse: true },
    ],
  ])('keeps %s on the desktop mixer', async (_name, device) => {
    expect((await loadFor(device)).isPhoneStage()).toBe(false)
  })
})

// The sidebar folds into the header's menu on the phone stage's screens, and
// the stylesheets turn the drawer on by hand, with the same two conditions.
// A script and a stylesheet that decide one thing must read one rule
// (docs/agent/MISTAKES.md, "isMobile() means touch"), so the media queries
// are read off the files and held to the module's own.
describe('the sidebar drawer, in the stylesheets', () => {
  /** Every `@media` condition in a stylesheet, its whitespace collapsed. */
  const queries = (path: string): string[] =>
    [...readFileSync(path, 'utf8').matchAll(/@media([^{]+)\{/gu)].map((m) =>
      m[1].replace(/\s+/gu, ' ').trim(),
    )

  const devices: Device[] = [
    { width: 390, height: 844, coarse: true },
    { width: 844, height: 390, coarse: true },
    { width: 932, height: 430, coarse: true },
    { width: 740, height: 360, coarse: true },
    { width: 667, height: 375, coarse: true },
    { width: 844, height: 390, coarse: false },
    { width: 962, height: 521, coarse: true },
    { width: 1024, height: 768, coarse: true },
    { width: 1440, height: 900, coarse: false },
    { width: 700, height: 900, coarse: false },
  ]

  it('opens the drawer in AppSidebar.module.css where isPhoneStage holds', async () => {
    const viewport = await loadFor(devices[0])
    const drawer = `(max-width: 768px), ${viewport.SHORT_TOUCH_LANDSCAPE_QUERY}`
    const narrowBlocks = queries('src/components/AppSidebar.module.css').filter(
      (query) => query.includes('(max-width: 768px)'),
    )

    // The drawer itself, its close button, no collapse button, no rail.
    expect(narrowBlocks).toEqual([drawer, drawer, drawer, drawer])
  })

  it('shows the menu button exactly where the drawer is, and hides it everywhere else', async () => {
    const { SHORT_TOUCH_LANDSCAPE_QUERY } = await loadFor(devices[0])
    const css = queries('src/styles/app.css')
    // The button's own rules, and the `display: none !important` above them.
    const show = css.find(
      (query) => query === `(max-width: 768px), ${SHORT_TOUCH_LANDSCAPE_QUERY}`,
    )
    const hide = css.find((query) =>
      query.startsWith('(min-width: 769px) and (pointer: fine)'),
    )
    if (show === undefined || hide === undefined) {
      throw new Error('app.css has lost the menu button rules')
    }

    const wrong: string[] = []
    for (const device of devices) {
      const drawer = (await loadFor(device)).isPhoneStage()
      // The fake's pointer is coarse or fine, never none: a phone has one.
      if (evaluate(show) !== drawer || evaluate(hide) === drawer) {
        wrong.push(`${device.width}x${device.height}`)
      }
    }

    expect(wrong).toEqual([])
  })

  it("lays the header's left end out as a phone's on the same screens", async () => {
    const viewport = await loadFor(devices[0])

    expect(queries('src/components/AppHeader.css')).toContain(
      viewport.SHORT_TOUCH_LANDSCAPE_QUERY,
    )
  })
})
