// ============================================================
// HomePlanCardMount: how Home reaches its card, and what Home does for it
// ============================================================
//
// Home draws the plan card from a lazy chunk, and only on the web (R30:
// home-card-mount.test.ts reads this module's source to hold the shape). These
// cases run it. A card that cannot be had must cost Home the card and not the
// page: the chunk can be missing (offline, or a deploy swapped the hashed
// assets) or the card can break as it draws, and in both Home goes on. The
// native build never asks for the card at all. Home does not wait for the
// card either: meanwhile it keeps a slot for the card, when a card is due, at
// the height the card last drew at on this device (plan-card-slot.ts, whose
// own cases read the storage behind it), and nothing otherwise. A read that
// goes wrong costs Home the slot and nothing else.
//
// The second block is the one thing the card asks of Home: today's session,
// for the Start here row that is Home's own. The card is faked here (what it
// draws is HomePlanCard.test.tsx's), and so is the routine, down to the two
// calls Home's session card makes of it.
//
// Each case imports a fresh copy of the mount, so each gets its own `lazy()`
// (which keeps the chunk, or the error, it had the first time) and its own
// IS_NATIVE_BUILD; the testing library is imported with it, so the two share
// one copy of Solid. No JSX is written in this file, for the same reason.

import type { Mock, MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAN_CARD_SLOT_KEY, PLAN_RECORD_KEY } from '@/features/plan/plan-keys'
import type * as HomeSessionAsk from '@/lib/home-session-ask'
import type * as NativeBuild from '@/lib/native-build'
import type { SessionRoutine } from './HomePlanCardMount'
import { startPlannedSession } from './HomePlanCardMount'

// ── The world a case sets up ───────────────────────────────────────────

type Chunk = 'loads' | 'is missing' | 'breaks as it draws' | 'is slow'

const world = vi.hoisted(() => ({
  native: false,
  chunk: 'loads' as Chunk,
  /** How many times the card's chunk was asked for. */
  asked: 0,
  /** What the card was given, when it drew. */
  given: null as { onHomeSession: () => void } | null,
  /** Makes Home's read of the slot throw. */
  slotThrows: false,
  /** Lets a slow chunk arrive. */
  release: (): void => undefined,
  gate: Promise.resolve(),
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return world.native
  },
}))

// The card, as a chunk that behaves as the case says. It draws a bare element,
// so nothing here writes JSX. A factory's answer is kept for good once it has
// been given, so each case registers the mock again (vi.doMock) after it has
// reset the modules, and the chunk it asks for is a new one.
async function chunkOfTheCase(): Promise<{
  HomePlanCard: typeof drawCard
}> {
  world.asked += 1
  if (world.chunk === 'is missing') {
    throw new Error('Failed to fetch dynamically imported module')
  }
  if (world.chunk === 'is slow') await world.gate
  return { HomePlanCard: drawCard }
}

/** What the chunk's component does: draws a bare element, or breaks as it draws. */
function drawCard(given: { onHomeSession: () => void }): HTMLElement {
  if (world.chunk === 'breaks as it draws') {
    throw new Error('The card broke as it drew.')
  }
  world.given = given
  const card = document.createElement('section')
  card.dataset.testid = 'home-plan-card'
  return card
}

let cleanUp: () => void = () => undefined

/** What the rest of Home is, to a card that fails: something else on the page. */
function restOfHome(): HTMLElement {
  const rest = document.createElement('p')
  rest.textContent = 'The rest of Home'
  return rest
}

/** Home's card, in a page with the rest of Home beside it, as a fresh copy of the mount sees it. */
async function mountedBeside(
  onHomeSession: () => void,
  setUp: Partial<Pick<typeof world, 'native' | 'chunk' | 'slotThrows'>> = {},
): Promise<{
  container: HTMLElement
  card: () => HTMLElement | null
  warn: MockInstance<typeof console.warn>
}> {
  Object.assign(world, setUp)
  vi.resetModules()
  vi.doMock('@/features/plan/HomePlanCard', chunkOfTheCase)
  if (world.slotThrows) {
    vi.doMock('@/features/plan/plan-card-slot', () => ({
      readPlanCardSlot: () => {
        throw new TypeError('rule.some is not a function')
      },
    }))
  }
  const library = await import('@solidjs/testing-library')
  const { createComponent } = await import('solid-js')
  const { HomePlanCardMount } = await import('./HomePlanCardMount')
  cleanUp = library.cleanup
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

  const { container } = library.render(() => [
    createComponent(HomePlanCardMount, { onHomeSession }),
    restOfHome(),
  ])
  return {
    container,
    card: () => container.querySelector('[data-testid="home-plan-card"]'),
    warn,
  }
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** An answered plan from yesterday, as the store writes it; its date. */
function answeredYesterday(): string {
  const at = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  localStorage.setItem(
    PLAN_RECORD_KEY,
    JSON.stringify({
      v: 1,
      status: 'answered',
      choices: { q1: 'singing', q2: null, q3: [], q4: [] },
      at,
      via: 'layer',
    }),
  )
  return at
}

/** The slot kept for the card, if any. */
const keptSlot = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[data-testid="home-plan-slot"]')

beforeEach(() => {
  localStorage.clear()
  world.native = false
  world.chunk = 'loads'
  world.asked = 0
  world.slotThrows = false
  world.given = null
  world.gate = new Promise<void>((resolve) => {
    world.release = resolve
  })
})

afterEach(() => {
  cleanUp()
  vi.doUnmock('@/features/plan/HomePlanCard')
  vi.doUnmock('@/features/plan/plan-card-slot')
  vi.restoreAllMocks()
})

// ── The card, mounted ──────────────────────────────────────────────────

describe('the card on Home', () => {
  it('draws the card beside the rest of Home, and hands it what Home does for its own session', async () => {
    const onHomeSession = vi.fn()
    const { container, card } = await mountedBeside(onHomeSession)

    await vi.waitFor(() => expect(card()).not.toBeNull())

    expect(container).toHaveTextContent('The rest of Home')
    world.given?.onHomeSession()
    expect(onHomeSession).toHaveBeenCalledTimes(1)
  })

  it('does not wait for the card: Home is drawn while the chunk is on its way, with nothing in its slot', async () => {
    const { container, card } = await mountedBeside(vi.fn(), {
      chunk: 'is slow',
    })
    await settle()

    expect(card()).toBeNull()
    expect(container).toHaveTextContent('The rest of Home')
    expect(container.children).toHaveLength(1)

    world.release()
    await vi.waitFor(() => expect(card()).not.toBeNull())
  })

  it("keeps the card's slot while the chunk is on its way, at the height it last drew, then gives it to the card", async () => {
    const at = answeredYesterday()
    localStorage.setItem(
      PLAN_CARD_SLOT_KEY,
      JSON.stringify({ at, w: window.innerWidth, h: 259.2, dests: ['sing'] }),
    )
    const { container, card } = await mountedBeside(vi.fn(), {
      chunk: 'is slow',
    })
    await settle()

    const slot = keptSlot(container)
    expect(card()).toBeNull()
    expect(container.firstElementChild).toBe(slot)
    expect(slot?.style.height).toBe('259.2px')
    expect(slot?.dataset.kind).toBe('plan')
    expect(slot?.getAttribute('aria-hidden')).toBe('true')

    world.release()
    await vi.waitFor(() => expect(card()).not.toBeNull())
    expect(keptSlot(container)).toBeNull()
    expect(container.firstElementChild).toBe(card())
  })

  it('keeps a slot of the size it guesses on a device that has never drawn the card', async () => {
    answeredYesterday()
    const { container } = await mountedBeside(vi.fn(), { chunk: 'is slow' })
    await settle()

    const slot = keptSlot(container)
    expect(slot?.dataset.kind).toBe('plan')
    expect(slot?.style.height).toBe('')
  })

  it('draws Home, and the slot, over a kept stop name an object inherits', async () => {
    const at = answeredYesterday()
    localStorage.setItem(
      PLAN_CARD_SLOT_KEY,
      JSON.stringify({
        at,
        w: window.innerWidth,
        h: 193.4,
        dests: ['constructor'],
      }),
    )
    const { container } = await mountedBeside(vi.fn(), { chunk: 'is slow' })
    await settle()

    expect(container).toHaveTextContent('The rest of Home')
    expect(keptSlot(container)?.style.height).toBe('193.4px')
  })

  it('costs Home the slot and nothing else when the read of it throws', async () => {
    answeredYesterday()
    const { container, card, warn } = await mountedBeside(vi.fn(), {
      chunk: 'is slow',
      slotThrows: true,
    })
    await settle()

    expect(keptSlot(container)).toBeNull()
    expect(container).toHaveTextContent('The rest of Home')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      '[home] Home kept no slot for the plan card:',
      expect.any(TypeError),
    )

    world.release()
    await vi.waitFor(() => expect(card()).not.toBeNull())
  })

  it('keeps no slot, and never asks for the card, in the native build', async () => {
    answeredYesterday()
    const { container } = await mountedBeside(vi.fn(), {
      native: true,
      chunk: 'is slow',
    })
    await settle()

    expect(keptSlot(container)).toBeNull()
    expect(container.children).toHaveLength(1)
    expect(world.asked).toBe(0)
  })

  it('draws nothing, and never asks for the card, in the native build', async () => {
    const { container, card } = await mountedBeside(vi.fn(), { native: true })
    await settle()

    expect(card()).toBeNull()
    expect(container).toHaveTextContent('The rest of Home')
    expect(world.asked).toBe(0)
  })

  it('costs Home the card and not the page when the chunk cannot be had', async () => {
    const { container, card, warn } = await mountedBeside(vi.fn(), {
      chunk: 'is missing',
    })

    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1))

    expect(card()).toBeNull()
    expect(container).toHaveTextContent('The rest of Home')
  })

  it('costs Home the card and not the page when the card breaks as it draws, and does not say it was not loaded', async () => {
    const { container, card, warn } = await mountedBeside(vi.fn(), {
      chunk: 'breaks as it draws',
    })

    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1))

    expect(world.asked).toBe(1)
    expect(card()).toBeNull()
    expect(container).toHaveTextContent('The rest of Home')
    // The chunk did load, so the words must not say that it did not.
    expect(String(warn.mock.calls[0][0])).not.toMatch(
      /(?:did not|could not|failed to|couldn't) load/iu,
    )
    expect(warn.mock.calls[0][1]).toBeInstanceOf(Error)
  })
})

// ── Today's session, asked for from outside Home ───────────────────────

describe("today's session, asked for by First Light or the plan layer", () => {
  // The copy of the channel the mount listens on: nothing has reset the
  // modules since the mount was imported.
  const channel = async (): Promise<typeof HomeSessionAsk> =>
    import('@/lib/home-session-ask')

  it('answers with what Home does for its own session, once', async () => {
    const onHomeSession = vi.fn()
    await mountedBeside(onHomeSession)
    const { askHomeForTodaysSession } = await channel()

    askHomeForTodaysSession()
    await settle()

    expect(onHomeSession).toHaveBeenCalledTimes(1)
  })

  it('answers nothing once Home is gone', async () => {
    const onHomeSession = vi.fn()
    await mountedBeside(onHomeSession)
    const { askHomeForTodaysSession } = await channel()

    cleanUp()
    askHomeForTodaysSession()
    await settle()

    expect(onHomeSession).not.toHaveBeenCalled()
  })
})

// ── Today's session, for the card ──────────────────────────────────────

describe("starting today's session for the plan's Start here row", () => {
  // Home's session card, as it is before there is a session (a way to pick the
  // length, and the button that builds one) and as it is after (the current
  // segment's Start, and a way to choose another workout).
  const BEFORE =
    '<button id="how">How today\'s session is chosen</button><select aria-label="Session length"></select><button id="build">Start today\'s session</button>'
  const AFTER =
    '<ol><li><button id="start">Start</button><button id="skip">Mark done</button></li></ol><button id="other">Choose a different workout</button>'

  let card: HTMLElement
  let scrolled: Mock<HTMLElement['scrollIntoView']>

  beforeEach(() => {
    card = document.createElement('div')
    scrolled = vi.fn<HTMLElement['scrollIntoView']>()
    card.scrollIntoView = scrolled
    document.body.append(card)
  })

  afterEach(() => {
    card.remove()
  })

  /** A routine that has a session, or has none and builds one when asked (the card then shows it). */
  function routine(has: boolean): SessionRoutine & { generate: () => void } {
    return {
      template: vi.fn(() => (has ? { id: 'today' } : null)),
      generate: vi.fn(() => {
        card.innerHTML = AFTER
      }),
    }
  }

  it('builds the session when there is none, then puts the cursor on the first button it shows', () => {
    card.innerHTML = BEFORE
    const none = routine(false)

    startPlannedSession(none, card)

    expect(none.generate).toHaveBeenCalledTimes(1)
    // After the build, not the "How" button the card had before it.
    expect(document.activeElement?.id).toBe('start')
  })

  it('never builds a session over one in progress: it only takes the person to it', () => {
    card.innerHTML = AFTER
    const going = routine(true)

    startPlannedSession(going, card)

    expect(going.generate).not.toHaveBeenCalled()
    expect(document.activeElement?.id).toBe('start')
  })

  it.each([
    ['there is no session yet', false, BEFORE],
    ['there is one', true, AFTER],
  ] as const)(
    'brings the card into view, as little as will do, when %s',
    (_, has, html) => {
      card.innerHTML = html

      startPlannedSession(routine(has), card)

      expect(scrolled).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' })
    },
  )

  it('focuses without scrolling again, since the card is already where it should be', () => {
    card.innerHTML = AFTER
    const focus = vi.spyOn(card.querySelector('#start') as HTMLElement, 'focus')

    startPlannedSession(routine(true), card)

    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  })

  it('still builds the session, and goes nowhere else, when the card is not on the page', () => {
    const none = routine(false)

    expect(() => startPlannedSession(none, undefined)).not.toThrow()

    expect(none.generate).toHaveBeenCalledTimes(1)
  })

  it('does nothing to a card that has no button yet', () => {
    card.innerHTML = '<p>Loading</p>'

    expect(() => startPlannedSession(routine(true), card)).not.toThrow()

    expect(document.activeElement).toBe(document.body)
  })
})
