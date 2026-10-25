// ============================================================
// PlanQuestions — the typed lines above a phone's keyboard
// ============================================================
//
// Q3's "Something else" and Q4's "Another app" open a line focused, low on
// the screen, and a phone's keyboard covered it. The screens' root keeps a
// focused line in view (lib/field-above-keyboard.ts, tested there); this
// file proves the screens hand it their root. jsdom has no visual viewport,
// no layout and no scrollBy, so all three are stood in for: a 390x844 screen
// with a 336 px keyboard, a root filling it, and each typed line where the
// browser puts it on that screen (measured), moving up as the root scrolls.

import { cleanup, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANOTHER_APP, APP_FIELD, open, OTHER_FIELD, SOMETHING_ELSE, tap, toFourthQuestion, toThirdQuestion, } from './PlanQuestions.fixture'

const SCREEN = 844
const KEYBOARD = 336
/** Where each typed line's top sits at 390x844, the root scrolled to the top. */
const LINE_TOP: Record<string, number> = { q3other: 724, q4app: 649 }

class StandInViewport extends EventTarget {
  keyboard = 0
  offsetTop = 0
  get height(): number {
    return SCREEN - this.keyboard
  }
  raise(px: number): void {
    this.keyboard = px
    this.dispatchEvent(new Event('resize'))
  }
}

let viewport: StandInViewport

/** The screens' root: the scroll region that holds Merc's line. */
const root = (): HTMLElement =>
  document.querySelector<HTMLElement>('[aria-live="polite"]')!.parentElement!

/** The px of a line's box under the keyboard, 0 when it is all in view. */
function underKeyboard(name: string): number {
  const box = screen.getByRole('textbox', { name }).getBoundingClientRect()
  return Math.max(0, box.bottom - viewport.height)
}

beforeEach(() => {
  vi.useFakeTimers()
  viewport = new StandInViewport()
  vi.stubGlobal('visualViewport', viewport)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const line = this.dataset.field
      if (line === undefined) return new DOMRect(0, 0, 390, SCREEN)
      return new DOMRect(0, LINE_TOP[line] - root().scrollTop, 390, 48)
    },
  )
  Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
    configurable: true,
    value(this: HTMLElement, options: ScrollToOptions) {
      this.scrollTop += options.top ?? 0
    },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (HTMLElement.prototype as { scrollBy?: unknown }).scrollBy
})

describe('a typed line with the keyboard up', () => {
  it('lifts "Something else" on Q3 out from under the keyboard', () => {
    // Arrange: Q3, its line open and focused
    open()
    toThirdQuestion()
    tap(SOMETHING_ELSE)

    // Act
    viewport.raise(KEYBOARD)

    // Assert
    expect(underKeyboard(OTHER_FIELD)).toBe(0)
  })

  it('lifts "Another app" on Q4 out from under the keyboard', () => {
    // Arrange: Q4, its line open and focused
    open()
    toFourthQuestion()
    tap(ANOTHER_APP)

    // Act
    viewport.raise(KEYBOARD)

    // Assert
    expect(underKeyboard(APP_FIELD)).toBe(0)
  })
})
