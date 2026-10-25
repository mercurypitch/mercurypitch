// ============================================================
// Lesson tour gate tests — offered once, at the top, only where it can be recorded
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { closeTour } from './tour'
import { atTop, startTour, TOUR_KEY, TOUR_VERSION, tourDue } from './tour-gate'

/** A storage that keeps what it is given, or throws on reading or writing. */
function storage(
  seed: Record<string, string> = {},
  fails: { read?: boolean; write?: boolean } = {},
): Storage & { kept: Record<string, string> } {
  const kept = { ...seed }
  return {
    kept,
    get length() {
      return Object.keys(kept).length
    },
    key: (i: number) => Object.keys(kept)[i] ?? null,
    getItem: (k: string) => {
      if (fails.read === true)
        throw new DOMException('blocked', 'SecurityError')
      return kept[k] ?? null
    },
    setItem: (k: string, v: string) => {
      if (fails.write === true)
        throw new DOMException('full', 'QuotaExceededError')
      kept[k] = v
    },
    removeItem: (k: string) => {
      delete kept[k]
    },
    clear: () => {
      for (const k of Object.keys(kept)) delete kept[k]
    },
  }
}

/** Where the page stands: its hash and how far down it is scrolled. */
function pageAt(hash: string, scrollY: number): void {
  window.location.hash = hash
  Object.defineProperty(window, 'scrollY', {
    value: scrollY,
    configurable: true,
  })
}

/** The page's storage, as `window.localStorage` hands it out. */
const pageStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')

/** Puts `s` behind `window.localStorage`, or a getter that throws, as blocked site data does. */
function useStorage(s: Storage | 'blocked'): void {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => {
      if (s === 'blocked') throw new DOMException('blocked', 'SecurityError')
      return s
    },
  })
}

beforeEach(() => {
  pageAt('', 0)
})

afterEach(() => {
  closeTour()
  pageAt('', 0)
  if (pageStorage !== undefined)
    Object.defineProperty(window, 'localStorage', pageStorage)
  localStorage.clear()
  document.body.textContent = ''
  vi.restoreAllMocks()
})

describe('tourDue: the first-visit rule', () => {
  it('offers the tour to a browser with no record, and writes a record that is not yet a close', () => {
    // Arrange
    const s = storage()
    useStorage(s)

    // Act
    const due = tourDue()

    // Assert
    expect(due).toBe(true)
    expect(s.kept[TOUR_KEY]).toBe('0')
  })

  it('does not offer the tour again once this version was closed', () => {
    // Arrange
    const s = storage({ [TOUR_KEY]: TOUR_VERSION })
    useStorage(s)

    // Act
    const due = tourDue()

    // Assert
    expect(due).toBe(false)
    expect(s.kept[TOUR_KEY]).toBe(TOUR_VERSION)
  })

  it('offers it again after a visit that left before closing it', () => {
    // Arrange: the offer's own record, never followed by a close
    useStorage(storage({ [TOUR_KEY]: '0' }))

    // Act
    const due = tourDue()

    // Assert
    expect(due).toBe(true)
  })

  it('never offers it where reaching the storage throws', () => {
    // Arrange: site data blocked, as `window.localStorage` then throws
    useStorage('blocked')

    // Act
    const due = tourDue()

    // Assert
    expect(due).toBe(false)
  })

  it('never offers it where reading the storage throws', () => {
    // Arrange
    useStorage(storage({}, { read: true }))

    // Act
    const due = tourDue()

    // Assert
    expect(due).toBe(false)
  })

  it('never offers it where the storage reads but will not write, so it cannot come back on every page', () => {
    // Arrange
    useStorage(storage({}, { write: true }))

    // Act
    const due = tourDue()

    // Assert
    expect(due).toBe(false)
  })
})

describe('tourDue: the hash and scroll rule', () => {
  it('skips a page opened at a deep link, and writes nothing', () => {
    // Arrange
    const s = storage()
    useStorage(s)
    pageAt('#sing', 0)

    // Act
    const due = tourDue()

    // Assert
    expect(due).toBe(false)
    expect(s.kept).toEqual({})
  })

  it('skips a page already scrolled 40 px down, and offers one just short of it', () => {
    // Arrange
    useStorage(storage())
    pageAt('', 40)
    const scrolled = tourDue()
    pageAt('', 39)

    // Act
    const top = tourDue()

    // Assert
    expect([scrolled, top]).toEqual([false, true])
  })

  it('reads a bare # as no deep link', () => {
    // Arrange
    pageAt('#', 0)

    // Act
    const at = atTop()

    // Assert
    expect(at).toBe(true)
  })
})

describe('startTour: the record on every way of closing', () => {
  /** A page with Merc and Tavi's stage, drawn, so the tour has a step. */
  function stage(): void {
    document.body.innerHTML = '<div id="heroStage"></div>'
    const el = document.getElementById('heroStage') as HTMLElement
    const r = {
      x: 0,
      y: 100,
      width: 300,
      height: 200,
      top: 100,
      left: 0,
      right: 300,
      bottom: 300,
    }
    el.getBoundingClientRect = () => r as DOMRect
    el.getClientRects = () => [r] as unknown as DOMRectList
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  }

  const ways: ReadonlyArray<[string, () => void]> = [
    [
      'Done',
      () => document.querySelector<HTMLElement>('[data-tour-next]')?.click(),
    ],
    [
      'Skip tour',
      () => document.querySelector<HTMLElement>('.tour-skip')?.click(),
    ],
    ['the X', () => document.querySelector<HTMLElement>('.tour-x')?.click()],
    [
      'Escape',
      () =>
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
    ],
  ]

  for (const [way, closeIt] of ways) {
    it(`records this version when the tour is closed with ${way}`, async () => {
      // Arrange
      stage()
      startTour(1, true)
      await vi.dynamicImportSettled()
      const opened = document.querySelector('.tour') !== null

      // Act
      closeIt()

      // Assert
      expect(opened).toBe(true)
      expect(document.querySelector('.tour')).toBeNull()
      expect(localStorage.getItem(TOUR_KEY)).toBe(TOUR_VERSION)
    })
  }
})
