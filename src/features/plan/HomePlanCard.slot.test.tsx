// ============================================================
// HomePlanCard — what it leaves for Home's next load
// ============================================================
//
// Home keeps a slot for the card before the card's chunk is in, at the height
// the card last drew at on this device (plan-card-slot.ts; the PR 1.3 gate's
// H-4: a card landing after Home's first paint pushed the session card down
// 273 px on a phone). These cases hold the card to its half: it keeps the
// height it settles at, once, not on every frame of a resize; it keeps none
// for a record it draws nothing for, so Home does not hold a slot open for a
// card that will not come; a card the X hid keeps the height it had, which
// the hide alone keeps shut, so it comes back at that height; and a card that
// is not laid out keeps nothing.
//
// jsdom lays nothing out, so the card's box is given a height here, and the
// ResizeObserver is a stand-in that reports when it starts to observe, as the
// real one does, and again whenever a case resizes the card.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePlanCard } from './HomePlanCard'
import { PLAN_CARD_SLOT_SETTLE_MS, readPlanCardSlot } from './plan-card-slot'
import { ago, answeredAgo, fresh, seeFirstValue, SINGING_ONLY, } from './plan-choices.fixture'
import { PLAN_CARD_SLOT_KEY, PLAN_RECORD_KEY } from './plan-keys'
import { markPlanShown, planRecord, showPlanCard } from './plan-store'

const WIDTH = 390
const DRAWN = 259.2

/** What the card kept for Home, as stored. */
const keptSlot = (): unknown =>
  JSON.parse(localStorage.getItem(PLAN_CARD_SLOT_KEY) ?? 'null')

/** The record's own date, as the store wrote it. */
const recordAt = (): string =>
  (JSON.parse(localStorage.getItem(PLAN_RECORD_KEY) ?? '{}') as { at: string })
    .at

/** The height the card's box measures at; 0 is a card that is not laid out. */
let height = DRAWN

const observers: Stand[] = []

class Stand {
  readonly watched: Element[] = []
  constructor(private readonly report: () => void) {
    observers.push(this)
  }
  observe(el: Element): void {
    this.watched.push(el)
    queueMicrotask(() => this.fire())
  }
  disconnect(): void {
    this.watched.length = 0
  }
  fire(): void {
    if (this.watched.length > 0) this.report()
  }
}

/** What the observers watch now. */
const watched = (): Element[] => observers.flatMap((o) => o.watched)

/** The card is drawn `to` px tall in a window `width` wide, and the observer says so. */
function resize(to: number, width = WIDTH): void {
  height = to
  vi.stubGlobal('innerWidth', width)
  for (const o of observers) o.fire()
}

/** Lets the microtasks run, and the clock move `ms` on. */
async function wait(ms = 0): Promise<void> {
  await Promise.resolve()
  vi.advanceTimersByTime(ms)
  await Promise.resolve()
}

/** Writes of the slot's key, as the case's spy saw them. */
let slotWrites: () => number = () => 0

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  fresh()
  observers.length = 0
  height = DRAWN
  vi.stubGlobal('ResizeObserver', Stand)
  vi.stubGlobal('innerWidth', WIDTH)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const tall = this.matches('[data-testid="home-plan-card"]') ? height : 0
      return new DOMRect(16, 184, 358, tall)
    },
  )
  const write = vi.spyOn(localStorage, 'setItem')
  slotWrites = () =>
    write.mock.calls.filter(([key]) => key === PLAN_CARD_SLOT_KEY).length
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const mount = (): (() => void) =>
  render(() => <HomePlanCard onHomeSession={() => undefined} />).unmount

describe("what the card leaves for Home's next load", () => {
  it('keeps the height it settles at, for its record and the width of the window', async () => {
    answeredAgo(1)

    mount()
    await wait()
    expect(watched()).toEqual([screen.getByTestId('home-plan-card')])
    expect(slotWrites()).toBe(0)

    await wait(PLAN_CARD_SLOT_SETTLE_MS)
    expect(keptSlot()).toEqual({
      at: recordAt(),
      w: WIDTH,
      h: DRAWN,
      dests: ['sing', 'hearYourself', 'karaokeNight'],
    })
    expect(readPlanCardSlot(Date.now(), WIDTH)).toEqual({
      kind: 'plan',
      height: DRAWN,
    })
  })

  it('keeps the height of the ask too', async () => {
    markPlanShown('welcome-skip', ago(2))

    mount()
    await wait(PLAN_CARD_SLOT_SETTLE_MS)

    expect(
      screen.getByRole('region', { name: 'Your plan, in four taps' }),
    ).toBe(watched()[0])
    expect(keptSlot()).toEqual({
      at: recordAt(),
      w: WIDTH,
      h: DRAWN,
      dests: [],
    })
  })

  it('follows the card as it changes, and writes once, when it settles, not on every frame of a resize', async () => {
    answeredAgo(1)
    mount()
    await wait(PLAN_CARD_SLOT_SETTLE_MS)
    expect(slotWrites()).toBe(1)

    // A window dragged wider, a frame at a time: the card grows shorter.
    for (let frame = 1; frame <= 30; frame += 1) {
      resize(DRAWN - frame, WIDTH + frame * 10)
      await wait(16)
    }
    expect(slotWrites()).toBe(1)

    await wait(PLAN_CARD_SLOT_SETTLE_MS)
    expect(slotWrites()).toBe(2)
    expect(keptSlot()).toMatchObject({ w: WIDTH + 300, h: DRAWN - 30 })
  })

  it('keeps nothing for a card that is not laid out, and leaves what it kept before', async () => {
    answeredAgo(1)
    mount()
    await wait(PLAN_CARD_SLOT_SETTLE_MS)
    const before = keptSlot()

    resize(0)
    await wait(PLAN_CARD_SLOT_SETTLE_MS)

    expect(keptSlot()).toEqual(before)
    expect(slotWrites()).toBe(1)
  })

  it('keeps a height not yet settled when the page goes away', async () => {
    answeredAgo(1)
    mount()
    await wait()

    window.dispatchEvent(new Event('pagehide'))

    expect(keptSlot()).toMatchObject({ at: recordAt(), h: DRAWN })
    await wait(PLAN_CARD_SLOT_SETTLE_MS)
    expect(slotWrites()).toBe(1)
  })

  it('keeps a height not yet settled when Home goes away, and hears no more of the page after', async () => {
    answeredAgo(1)
    const unmount = mount()
    await wait()

    unmount()

    expect(keptSlot()).toMatchObject({ at: recordAt(), h: DRAWN })
    window.dispatchEvent(new Event('pagehide'))
    await wait(PLAN_CARD_SLOT_SETTLE_MS)
    expect(slotWrites()).toBe(1)
  })

  it('keeps no slot for a record it draws nothing for: every stop of the plan is done', async () => {
    answeredAgo(1, SINGING_ONLY)
    seeFirstValue('sing')

    mount()
    await wait(PLAN_CARD_SLOT_SETTLE_MS)

    expect(screen.queryByTestId('home-plan-card')).toBeNull()
    expect(keptSlot()).toEqual({ at: recordAt(), w: WIDTH, h: 0, dests: [] })
    expect(readPlanCardSlot(Date.now(), WIDTH)).toBeNull()
  })

  it('keeps no slot for a new record that comes under a card that stays empty', async () => {
    answeredAgo(1, SINGING_ONLY)
    seeFirstValue('sing')
    mount()
    await wait()
    const first = recordAt()

    // "Change my answers", to a plan that is done already.
    answeredAgo(0.5, SINGING_ONLY)
    await wait(PLAN_CARD_SLOT_SETTLE_MS)

    expect(planRecord()?.at).not.toBe(first)
    expect(keptSlot()).toEqual({ at: recordAt(), w: WIDTH, h: 0, dests: [] })
    expect(readPlanCardSlot(Date.now(), WIDTH)).toBeNull()
  })

  it('keeps no slot once the X has hidden it, and writes nothing for a height not yet settled', async () => {
    answeredAgo(1)
    mount()
    await wait()

    fireEvent.click(screen.getByRole('button', { name: 'Hide your plan' }))
    await wait(PLAN_CARD_SLOT_SETTLE_MS)

    // The hide alone keeps Home's slot shut: nothing is written, not the
    // height not yet settled, and not a 0.
    expect(slotWrites()).toBe(0)
    expect(watched()).toEqual([])
    expect(readPlanCardSlot(Date.now(), WIDTH)).toBeNull()
  })

  it('keeps the height it settled at under the X, so Show on Home brings it back at that height', async () => {
    answeredAgo(1)
    const unmount = mount()
    await wait(PLAN_CARD_SLOT_SETTLE_MS)
    fireEvent.click(screen.getByRole('button', { name: 'Hide your plan' }))
    await wait(PLAN_CARD_SLOT_SETTLE_MS)
    unmount()
    expect(readPlanCardSlot(Date.now(), WIDTH)).toBeNull()

    // Settings' Show on Home, with Home not drawn.
    showPlanCard()

    expect(readPlanCardSlot(Date.now(), WIDTH)).toEqual({
      kind: 'plan',
      height: DRAWN,
    })
  })

  it('keeps nothing, and writes nothing, for someone with no plan at all', async () => {
    mount()
    await wait(PLAN_CARD_SLOT_SETTLE_MS)

    expect(localStorage.getItem(PLAN_CARD_SLOT_KEY)).toBeNull()
  })
})
