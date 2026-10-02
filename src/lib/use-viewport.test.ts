// ============================================================
// use-viewport — which screens count as a phone held sideways
// ============================================================
//
// jsdom evaluates no media queries, so this stands a small matchMedia in for
// the browser: it reads the handful of features the module asks about
// (width, height, orientation, pointer) against a pretend device. The module
// is imported fresh for each device, because its matches are app-lifetime
// singletons read when it loads.

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
