// ============================================================
// HomePlanCard — the X that hides the card, and the key that remembers it
// ============================================================
//
// The X hides the card on this device for the plan it shows: the store keeps
// that record's date (plan-store.hide.test.ts holds what it writes), so a plan
// answered again, here or on another device, has its card back for its week.
// The signal hides it at once and the key is written after, so a device that
// refuses the write still loses the card for this visit, and a key that cannot
// be read is a card that was not hidden. The key is a device key (`mp.`): it
// is never synced, and hiding the card tells the funnel nothing and leaves the
// plan's record as it was. The X is gone with the card, so the focus it had
// goes to the page's main region (App.tsx's #main-content, which takes focus
// but is not in the tab order), and a keyboard user is not dropped at the top
// of the page.
//
// The stores are the real ones, put back between cases
// (plan-choices.fixture.ts). Only the funnel's console is faked. A case that
// is a new page load reads the card and its store afresh (`reloaded`), as the
// store reads storage once, as it loads.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPersistedValue } from '@/lib/storage'
import { HomePlanCard } from './HomePlanCard'
import { ago, answeredAgo, AUDITION, fresh, sent } from './plan-choices.fixture'
import { PLAN_CARD_DISMISSED_KEY, PLAN_RECORD_KEY } from './plan-keys'
import type { PlanRecordV1 } from './plan-record'
import { markPlanShown, planRecord } from './plan-store'

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

/**
 * The card as the next page load draws it: the card and the store read again,
 * so the store reads what storage holds now. The budget is for that import.
 */
async function reloaded(): Promise<HTMLElement> {
  vi.resetModules()
  const card = await import('./HomePlanCard')
  return render(() => <card.HomePlanCard onHomeSession={() => undefined} />)
    .container
}
const RELOAD_BUDGET_MS = 20_000

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
    'hides %s at once and remembers, on this device, the plan it hid',
    (_, setUp) => {
      setUp()
      const record = localStorage.getItem(PLAN_RECORD_KEY)
      const container = mount()

      tap(hide())

      expect(container).toBeEmptyDOMElement()
      expect(
        JSON.parse(localStorage.getItem(PLAN_CARD_DISMISSED_KEY) ?? 'null'),
      ).toBe(planRecord()?.at)
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

  it('stays hidden after a reload', { timeout: RELOAD_BUDGET_MS }, async () => {
    answeredAgo(1)
    mount()
    tap(hide())
    cleanup()

    const container = await reloaded()

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
    // The refused write is said once. The card writes nothing for Home's
    // slot as it goes: the hide alone keeps the slot shut.
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([
      `[storage] Failed to write key "${PLAN_CARD_DISMISSED_KEY}":`,
    ])
  })

  it(
    'shows the card when the device cannot say whether it was hidden',
    { timeout: RELOAD_BUDGET_MS },
    async () => {
      answeredAgo(1)
      localStorage.setItem(PLAN_CARD_DISMISSED_KEY, 'true')
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const read = localStorage.getItem.bind(localStorage)
      vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
        if (key === PLAN_CARD_DISMISSED_KEY) throw new Error('Access denied.')
        return read(key)
      })

      const container = await reloaded()

      expect(rowsOnScreen(container)).toBe(3)
      expect(warn).toHaveBeenCalledOnce()
    },
  )

  it(
    'does not mistake something else under the key for a hidden card',
    { timeout: RELOAD_BUDGET_MS },
    async () => {
      answeredAgo(1)
      localStorage.setItem(PLAN_CARD_DISMISSED_KEY, '')

      expect(rowsOnScreen(await reloaded())).toBe(3)
    },
  )
})

// ── What brings it back ────────────────────────────────────────────────

describe('a card that was hidden', () => {
  it('comes back for a plan answered again, on this device', () => {
    answeredAgo(2)
    const container = mount()
    tap(hide())

    answeredAgo(1)

    expect(rowsOnScreen(container)).toBe(3)
  })

  it('comes back for a plan answered again on another device', () => {
    answeredAgo(2)
    const container = mount()
    tap(hide())

    // The account's plan lands, as the settings pull applies it.
    const record: PlanRecordV1 = {
      v: 1,
      status: 'answered',
      choices: AUDITION,
      at: ago(1).toISOString(),
      via: 'first-light',
    }
    applyPersistedValue(PLAN_RECORD_KEY, JSON.stringify(record))

    expect(rowsOnScreen(container)).toBe(3)
  })

  it(
    'stays hidden on a device that hid it before the X kept a date',
    { timeout: RELOAD_BUDGET_MS },
    async () => {
      answeredAgo(1)
      localStorage.setItem(PLAN_CARD_DISMISSED_KEY, 'true')

      const container = await reloaded()

      expect(container).toBeEmptyDOMElement()
    },
  )
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
