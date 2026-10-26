// ============================================================
// HomeCheckupCardMount: how Home reaches its weekly Check-up card
// ============================================================
//
// Home draws the card from a lazy chunk, and only on the web: the native build
// has no Voice Mirror for the card to open, and never asks for the chunk. Until
// the chunk is in, Home keeps the card a slot when this browser's own takes
// say a Check-up is due, and nothing otherwise. The slot is told what changes
// the card's height: whether somebody is signed in (no account line) and
// which of its two wordings it has. A chunk that cannot be had
// costs Home the card and not the page. What the card says and when is
// src/features/check-up/HomeCheckupCard.test.tsx's.
//
// As in HomePlanCardMount.test.ts, each case imports a fresh copy of the mount
// (its own `lazy()` and its own IS_NATIVE_BUILD), the testing library with it,
// and writes no JSX.

import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import type * as NativeBuild from '@/lib/native-build'

type Chunk = 'loads' | 'is missing' | 'is slow'

const world = vi.hoisted(() => ({
  native: false,
  signedIn: false,
  chunk: 'loads' as Chunk,
  asked: 0,
  release: (): void => undefined,
  gate: Promise.resolve(),
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return world.native
  },
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  accountHeld: () => world.signedIn,
}))

async function chunkOfTheCase(): Promise<{
  HomeCheckupCard: () => HTMLElement
}> {
  world.asked += 1
  if (world.chunk === 'is missing') {
    throw new Error('Failed to fetch dynamically imported module')
  }
  if (world.chunk === 'is slow') await world.gate
  return {
    HomeCheckupCard: () => {
      const card = document.createElement('section')
      card.dataset.testid = 'home-checkup-card'
      return card
    },
  }
}

let cleanUp: () => void = () => undefined

async function mounted(
  setUp: Partial<Pick<typeof world, 'native' | 'chunk' | 'signedIn'>> = {},
): Promise<{
  container: HTMLElement
  card: () => HTMLElement | null
  slot: () => HTMLElement | null
  warn: MockInstance<typeof console.warn>
}> {
  Object.assign(world, setUp)
  vi.resetModules()
  vi.doMock('@/features/check-up/HomeCheckupCard', chunkOfTheCase)
  const library = await import('@solidjs/testing-library')
  const { createComponent } = await import('solid-js')
  const { HomeCheckupCardMount } = await import('./HomeCheckupCardMount')
  cleanUp = library.cleanup
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const rest = document.createElement('p')
  rest.textContent = 'The streak card'

  const { container } = library.render(() => [
    createComponent(HomeCheckupCardMount, {}),
    rest,
  ])
  return {
    container,
    card: () => container.querySelector('[data-testid="home-checkup-card"]'),
    slot: () => container.querySelector('[data-testid="home-checkup-slot"]'),
    warn,
  }
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const DAY = 24 * 60 * 60 * 1000

/** A voiceprint on this browser, `daysAgo` old, as the service stores one. */
function sungDaysAgo(daysAgo: number): void {
  localStorage.setItem(
    'mercurypitch.voiceprints.v1',
    JSON.stringify([
      {
        id: 'take',
        takenAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
        twin: null,
        source: 'mirror',
        summary: {
          lowMidi: 43,
          highMidi: 60,
          semitones: 17,
          accuracy: 60,
          steadiness: 70,
        },
      },
    ]),
  )
}

beforeEach(() => {
  localStorage.clear()
  world.native = false
  world.signedIn = false
  world.chunk = 'loads'
  world.asked = 0
  world.gate = new Promise<void>((resolve) => {
    world.release = resolve
  })
})

afterEach(() => {
  cleanUp()
  vi.doUnmock('@/features/check-up/HomeCheckupCard')
  vi.restoreAllMocks()
})

describe('the Check-up card on Home', () => {
  it('draws the card from its chunk beside the rest of Home', async () => {
    const { container, card } = await mounted()

    await vi.waitFor(() => expect(card()).not.toBeNull())
    expect(container).toHaveTextContent('The streak card')
  })

  it("keeps the card's slot while the chunk is on its way, when a Check-up is due here", async () => {
    sungDaysAgo(8)
    const { card, slot } = await mounted({ chunk: 'is slow' })
    await settle()

    expect(card()).toBeNull()
    expect(slot()).toHaveAttribute('data-account', 'signed-out')
    expect(slot()).toHaveAttribute('data-words', 'week')

    world.release()
    await vi.waitFor(() => expect(card()).not.toBeNull())
    expect(slot()).toBeNull()
  })

  it('keeps the shorter slot for somebody signed in, whose card has no account line', async () => {
    sungDaysAgo(8)
    const { slot } = await mounted({ chunk: 'is slow', signedIn: true })
    await settle()

    expect(slot()).toHaveAttribute('data-account', 'signed-in')
  })

  it("keeps the slot of the card's two-week wording from two weeks on", async () => {
    sungDaysAgo(15)
    const { slot } = await mounted({ chunk: 'is slow' })
    await settle()

    expect(slot()).toHaveAttribute('data-words', 'day')
  })

  it('keeps no slot when no Check-up is due here', async () => {
    sungDaysAgo(2)
    const { container, slot } = await mounted({ chunk: 'is slow' })
    await settle()

    expect(slot()).toBeNull()
    expect(container.children).toHaveLength(1)
  })

  it('costs Home the card and not the page when the chunk is missing', async () => {
    const { container, card, warn } = await mounted({ chunk: 'is missing' })

    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    expect(card()).toBeNull()
    expect(container).toHaveTextContent('The streak card')
  })

  it('never asks for the card in the native build, which has no Voice Mirror', async () => {
    sungDaysAgo(8)
    const { container, card, slot } = await mounted({ native: true })
    await settle()

    expect(world.asked).toBe(0)
    expect(card()).toBeNull()
    expect(slot()).toBeNull()
    expect(container.children).toHaveLength(1)
  })
})
