// ============================================================
// PlanLayer: what each way out hands the app
// ============================================================
//
// The layer closes first, and only then is the app sent on: Home through the
// tab, the Map through its address, a stop through enterStop. Each case records
// what the app looked like the moment the layer asked to be closed, so the
// order is asserted and not assumed. The screens are the real ones, tapped the
// way a singer taps them; enterStop is the fake (enter-stop.test.ts has cases
// of its own), and so are the promo store and the GPU gate, as in
// PlanLayer.test.tsx, whose fixture this file shares.

import { fireEvent } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { activeTab } from '@/stores/ui-store'
import type { PlanStop } from './build-plan'
import { planRecord } from './plan-store'
import type { PlanLayerProps } from './PlanLayer'
import type { Host } from './PlanLayer.fixture'
import { answered, card, open as openLayer, setUp, tearDown, toThePlan, } from './PlanLayer.fixture'
import { tap } from './PlanQuestions.fixture'

const mocks = vi.hoisted(() => ({
  enterStop: vi.fn<(stop: PlanStop, tour?: boolean) => void>(),
}))

vi.mock('./enter-stop', () => ({ enterStop: mocks.enterStop }))

// The server's promo is never asked.
vi.mock('@/stores/promo-store', () => ({
  offeredPromo: () => null,
  loadFeaturedPromo: async () => {},
}))

// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

// ── Fixtures ───────────────────────────────────────────────────────────

/** What the app looked like the moment the layer asked to be closed. */
interface World {
  tab: string
  hash: string
  stopsEntered: number
}
let atClose: World[]

/** The layer in a mode, with a close that notes what had and had not happened by then. */
function open(mode: PlanLayerProps['mode']): Host {
  const onClose = vi.fn<() => void>(() => {
    atClose.push({
      tab: activeTab(),
      hash: window.location.hash,
      stopsEntered: mocks.enterStop.mock.calls.length,
    })
  })
  return openLayer(mode, onClose)
}

beforeEach(() => {
  setUp()
  atClose = []
})
afterEach(tearDown)

// ── The ways out ───────────────────────────────────────────────────────

describe('the ways out', () => {
  it('closes the layer, then goes Home, from Not now on a question, and turns the plan down', () => {
    const host = open('skipper')

    tap('Not now')

    expect(host.onClose).toHaveBeenCalledTimes(1)
    // Still on the tab it was opened from, at its own address, when it closed.
    expect(atClose).toEqual([
      { tab: 'singing', hash: '#/plan', stopsEntered: 0 },
    ])
    expect(activeTab()).toBe('home')
    expect(planRecord()?.status).toBe('declined')
  })

  it("closes the layer, then goes Home, from the plan's Not now, with the answers kept", () => {
    const host = open('skipper')
    toThePlan()

    tap('Not now')

    expect(host.onClose).toHaveBeenCalledTimes(1)
    expect(atClose[0].tab).toBe('singing')
    expect(activeTab()).toBe('home')
    expect(planRecord()?.status).toBe('answered')
  })

  it('closes the layer, then opens the Map, from See every room', () => {
    const host = open('skipper')
    toThePlan()

    tap('See every room')

    expect(host.onClose).toHaveBeenCalledTimes(1)
    expect(atClose).toEqual([
      { tab: 'singing', hash: '#/plan', stopsEntered: 0 },
    ])
    expect(window.location.hash).toBe('#/map')
    expect(activeTab()).toBe('singing')
  })

  it('closes the layer, then enters Start here with its tour, from Show me around', () => {
    answered()
    const host = open('review')
    const start = card('start').dataset.dest

    tap('Show me around')

    expect(host.onClose).toHaveBeenCalledTimes(1)
    expect(atClose).toEqual([
      { tab: 'singing', hash: '#/plan', stopsEntered: 0 },
    ])
    expect(mocks.enterStop).toHaveBeenCalledTimes(1)
    expect(mocks.enterStop).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'start', dest: start }),
      true,
    )
  })

  it.each<PlanStop['kind']>(['start', 'learn', 'play'])(
    'closes the layer, then enters the %s card without a tour when it is tapped',
    (kind) => {
      answered()
      const host = open('review')
      const dest = card(kind).dataset.dest

      fireEvent.click(card(kind))

      expect(host.onClose).toHaveBeenCalledTimes(1)
      expect(atClose[0].stopsEntered).toBe(0)
      expect(mocks.enterStop).toHaveBeenCalledTimes(1)
      expect(mocks.enterStop).toHaveBeenCalledWith(
        expect.objectContaining({ kind, dest }),
        false,
      )
    },
  )
})
