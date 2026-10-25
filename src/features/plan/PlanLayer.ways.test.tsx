// ============================================================
// PlanLayer: what each way out hands the app
// ============================================================
//
// The layer closes first, and only then is the app sent on: Home through the
// tab, the Map through its address, a stop through enterStop, and Show me
// around to Merc's showcase, which is asked for before the close (it holds
// the app's offers) and draws after it. Each case records what the app looked
// like the moment the layer asked to be closed, so the order is asserted and
// not assumed. The screens are the real ones, tapped the way a singer taps
// them; enterStop and the showcase are fakes (enter-stop.test.ts and
// plan-showcase.test.ts have cases of their own), and so are the promo store
// and the GPU gate, as in PlanLayer.test.tsx, whose fixture this file shares.

import { fireEvent } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { activeTab } from '@/stores/ui-store'
import type { Plan, PlanStop } from './build-plan'
import type * as EnterStopModule from './enter-stop'
import { KICKER } from './plan-copy'
import { planRecord } from './plan-store'
import type { PlanLayerProps } from './PlanLayer'
import type { Host } from './PlanLayer.fixture'
import { answered, card, open as openLayer, setUp, tearDown, toThePlan, } from './PlanLayer.fixture'
import { tap } from './PlanQuestions.fixture'

const mocks = vi.hoisted(() => ({
  enterStop: vi.fn<(stop: PlanStop, tour?: boolean) => void>(),
  runPlanShowcase: vi.fn<(plan: Plan, begin: () => void) => void>(),
}))

vi.mock('./plan-showcase', () => ({
  runPlanShowcase: mocks.runPlanShowcase,
  warmPlanShowcase: () => undefined,
}))

// enterStop is the fake. widenMenuFor stays real: the controller calls it before
// it hands a stop on, and with the whole menu these cases open there is nothing
// for it to widen.
vi.mock('./enter-stop', async (importOriginal) => ({
  ...(await importOriginal<typeof EnterStopModule>()),
  enterStop: mocks.enterStop,
}))

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
  mocks.runPlanShowcase.mockClear()
})
afterEach(tearDown)

// ── The ways out ───────────────────────────────────────────────────────

describe('the ways out', () => {
  it('closes the layer, then goes Home, from Not now on a question, and turns the plan down at once', () => {
    const host = open('skipper')

    tap('Not now')

    // No "are you sure?" here: only First Light asks before skipping the plan.
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
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

  it('closes the layer, then enters Start here without the tour, from the main button', () => {
    // Arrange
    answered()
    const host = open('review')
    const start = card('start').dataset.dest

    // Act
    tap(KICKER.start)

    // Assert: closed first, then Start here, as its card enters it.
    expect(host.onClose).toHaveBeenCalledTimes(1)
    expect(atClose).toEqual([
      { tab: 'singing', hash: '#/plan', stopsEntered: 0 },
    ])
    expect(mocks.enterStop).toHaveBeenCalledTimes(1)
    expect(mocks.enterStop).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'start', dest: start }),
    )
    expect(mocks.runPlanShowcase).not.toHaveBeenCalled()
  })

  it('asks for the showcase, closes the layer, and enters nothing yet, from Show me around', () => {
    answered()
    const host = open('review')
    const start = card('start').dataset.dest
    let closedFirst = true
    mocks.runPlanShowcase.mockImplementationOnce(() => {
      closedFirst = host.onClose.mock.calls.length > 0
    })

    tap('Show me around')

    // The showcase holds the offers before the close lets them go, and opens
    // Start here itself, at its end.
    expect(closedFirst).toBe(false)
    expect(host.onClose).toHaveBeenCalledTimes(1)
    expect(atClose).toEqual([
      { tab: 'singing', hash: '#/plan', stopsEntered: 0 },
    ])
    expect(mocks.enterStop).not.toHaveBeenCalled()
    expect(mocks.runPlanShowcase).toHaveBeenCalledTimes(1)
    const [plan, begin] = mocks.runPlanShowcase.mock.calls[0] ?? []
    expect(plan?.start).toMatchObject({ kind: 'start', dest: start })
    expect(typeof begin).toBe('function')
  })

  it.each<PlanStop['kind']>(['start', 'learn', 'play'])(
    'closes the layer, then enters the %s card when it is tapped',
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
      )
      expect(mocks.runPlanShowcase).not.toHaveBeenCalled()
    },
  )
})
