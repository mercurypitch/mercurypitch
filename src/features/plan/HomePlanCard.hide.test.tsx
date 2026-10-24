// ============================================================
// HomePlanCard — the X that hides the card, and the key that remembers it
// ============================================================
//
// The X hides the card for good on this device. The signal hides it at once and
// the key is written after, so a device that refuses the write still loses the
// card for this visit, and a key that cannot be read is a card that was not
// hidden. A stored value is a hiding only when it is `true`. The key is a
// device key (`mp.`): it is never synced, and hiding the card tells the funnel
// nothing and leaves the plan's record as it was. The X is gone with the card,
// so the focus it had goes to the page's main region (App.tsx's
// #main-content, which takes focus but is not in the tab order), and a
// keyboard user is not dropped at the top of the page.
//
// The stores are the real ones, put back between cases
// (plan-choices.fixture.ts). Only the funnel's console is faked.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePlanCard } from './HomePlanCard'
import { ago, answeredAgo, fresh, sent } from './plan-choices.fixture'
import { PLAN_CARD_DISMISSED_KEY, PLAN_CARD_SLOT_KEY, PLAN_RECORD_KEY, } from './plan-keys'
import { markPlanShown } from './plan-store'

// ── Fixtures ───────────────────────────────────────────────────────────

const mount = (): HTMLElement =>
  render(() => <HomePlanCard onHomeSession={() => undefined} />).container
const rowsOnScreen = (container: HTMLElement): number =>
  container.querySelectorAll('[data-kind]').length
const hide = (): HTMLElement =>
  screen.getByRole('button', { name: 'Hide your plan' })
const tap = (el: HTMLElement): void => {
  fireEvent.click(el)
}

/** The two things the card can be: the plan, or the ask for the four taps. */
const states: [string, () => void][] = [
  ['the plan', () => answeredAgo(1)],
  ['the ask', () => markPlanShown('layer', ago(1))],
]

beforeEach(() => {
  vi.clearAllMocks()
  // The funnel logs each event it is told about.
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  fresh()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ── Hiding it ──────────────────────────────────────────────────────────

describe('hiding the card', () => {
  it.each(states)('has an X labelled Hide your plan on %s', (_, setUp) => {
    setUp()

    mount()

    expect(hide()).toHaveAttribute('type', 'button')
    // A picture from the project's icons: no letter, no character, no emoji.
    expect(hide().querySelector('svg')).not.toBeNull()
    expect(hide().textContent).toBe('')
  })

  it.each(states)(
    'hides %s at once and remembers it on this device',
    (_, setUp) => {
      setUp()
      const record = localStorage.getItem(PLAN_RECORD_KEY)
      const container = mount()

      tap(hide())

      expect(container).toBeEmptyDOMElement()
      expect(
        JSON.parse(localStorage.getItem(PLAN_CARD_DISMISSED_KEY) ?? 'null'),
      ).toBe(true)
      expect(PLAN_CARD_DISMISSED_KEY.startsWith('mp.')).toBe(true)
      // The plan itself is left as it was, and nothing is told to the funnel.
      expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(record)
      expect(sent()).toEqual([])
    },
  )

  it.each(states)('stays hidden on the next visit to Home: %s', (_, setUp) => {
    setUp()
    mount()
    tap(hide())
    cleanup()

    const container = mount()

    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden for the visit when the device refuses to remember it', () => {
    answeredAgo(1)
    const container = mount()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('The quota has been exceeded.')
    })

    expect(() => tap(hide())).not.toThrow()

    expect(container).toBeEmptyDOMElement()
    // Each refused write is said once: the hiding, and the slot Home would
    // have kept for the card (none, now), which the card writes as it goes.
    expect(warn.mock.calls.map((call) => String(call[0])).sort()).toEqual(
      [PLAN_CARD_DISMISSED_KEY, PLAN_CARD_SLOT_KEY]
        .map((key) => `[storage] Failed to write key "${key}":`)
        .sort(),
    )
  })

  it('shows the card when the device cannot say whether it was hidden', () => {
    answeredAgo(1)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const read = localStorage.getItem.bind(localStorage)
    vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
      if (key === PLAN_CARD_DISMISSED_KEY) throw new Error('Access denied.')
      return read(key)
    })

    const container = mount()

    expect(rowsOnScreen(container)).toBe(3)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('does not mistake something else under the key for a hidden card', () => {
    answeredAgo(1)
    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, '')

    expect(rowsOnScreen(mount())).toBe(3)
  })
})

// ── Where the focus goes ───────────────────────────────────────────────

describe('the focus the X had', () => {
  let main: HTMLElement

  // App.tsx's main region, which a test of the card alone has to supply.
  beforeEach(() => {
    main = document.createElement('main')
    main.id = 'main-content'
    main.tabIndex = -1
    document.body.append(main)
  })

  afterEach(() => {
    main.remove()
  })

  it.each(states)(
    'goes to the main region, without scrolling, when the X takes %s away',
    (_, setUp) => {
      setUp()
      mount()
      const focus = vi.spyOn(main, 'focus')
      hide().focus()
      expect(document.activeElement).toBe(hide())

      tap(hide())

      expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
      expect(document.activeElement).toBe(main)
    },
  )

  it('is not asked for when the page has no main region to give it to', () => {
    main.remove()
    answeredAgo(1)
    const container = mount()

    expect(() => tap(hide())).not.toThrow()

    expect(container).toBeEmptyDOMElement()
  })
})
