// ============================================================
// usePlanFlowController: when a finished plan brings the account sync with it
// ============================================================
//
// R76: a singer who already holds an account gets their answers sent the
// moment the plan is done. R84: nobody else so much as loads the sync. First
// Light draws the questions on a first visit, so a static edge from the
// controller to plan-sync.ts would fetch that chunk for every new visitor at
// load, before any of them has an account. So done() hands the sync to the one
// gate (sync-for-account.ts, R85), which asks for the module only once
// hasUpgradedAccount() says there is an account, and a module that cannot be
// had costs the sync and nothing else.
//
// Whether a module was loaded is seen by its factory: each case resets the
// module registry, registers the factory again and imports the controller, the
// store and Solid afresh, so the factory runs for a case that loads the sync,
// and for no other.
// The sync itself is the real one; only the account check, the one write it
// makes and the edges a run touches (billing, the promo) are faked. What a sync
// sends is usePlanFlowController.test.ts's and plan-sync.test.ts's.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthServiceModule from '@/db/services/auth-service'
import type * as BillingServiceModule from '@/db/services/billing-service'
import type * as SurveyServiceModule from '@/db/services/survey-service'
import type { PlanTexts } from './plan-record'
import type * as PlanSyncModule from './plan-sync'
import type { PlanChoices } from './questions'

const mocks = vi.hoisted(() => ({
  upgraded: vi.fn(() => false),
  /** The gate's own question, apart from the screens' accountHeld(). */
  gateAsked: vi.fn(),
  submitPlanResponse: vi.fn(async () => {}),
  /** How many times plan-sync.ts was loaded since the registry was reset. */
  syncLoads: 0,
  /** Makes plan-sync.ts fail to load, as a chunk that is gone does. */
  syncMissing: false,
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthServiceModule>()),
  accountHeld: (): boolean => mocks.upgraded(),
  hasUpgradedAccount: (): boolean => {
    mocks.gateAsked()
    return mocks.upgraded()
  },
}))

vi.mock('@/db/services/survey-service', async (importOriginal) => ({
  ...(await importOriginal<typeof SurveyServiceModule>()),
  submitPlanResponse: mocks.submitPlanResponse,
}))

vi.mock('@/db/services/billing-service', async (importOriginal) => ({
  ...(await importOriginal<typeof BillingServiceModule>()),
  fetchBillingMe: vi.fn(async () => null),
  fetchPricing: vi.fn(async () => null),
}))

vi.mock('@/stores/promo-store', () => ({
  offeredPromo: () => null,
  loadFeaturedPromo: async () => undefined,
}))

/**
 * plan-sync.ts as each case sees it: the real module, counted as it loads, or
 * one that cannot be had. A factory's answer is kept once it has been given, so
 * each case registers it again (vi.doMock) after it has reset the modules.
 */
async function syncOfTheCase(
  importOriginal: <T>() => Promise<T>,
): Promise<typeof PlanSyncModule> {
  mocks.syncLoads += 1
  if (mocks.syncMissing) {
    throw new Error('Failed to fetch dynamically imported module')
  }
  return importOriginal<typeof PlanSyncModule>()
}

/** A guitar player: no Karaoke Night card, so no credits line is asked for. */
const GUITAR: PlanChoices = {
  q1: 'guitar',
  q2: 'song',
  q3: ['time'],
  q4: ['app'],
}
const NO_TEXTS: PlanTexts = { q3other: '', q4app: '' }
const NO_PILLS: ReadonlyMap<string, DOMRect> = new Map()

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

let dispose: () => void = () => undefined

/**
 * A new visitor's run, finished, from a fresh module registry; what it shows
 * and what the store holds once `until` holds (a module loaded on demand takes
 * more than a turn of the event loop to arrive).
 */
async function finishARun(until: () => void = () => undefined): Promise<{
  phase: string
  syncedAt: string | undefined
  status: string | undefined
}> {
  vi.resetModules()
  vi.doMock('./plan-sync', syncOfTheCase)
  mocks.syncLoads = 0
  const { createRoot } = await import('solid-js')
  const { usePlanFlowController } = await import('./usePlanFlowController')
  const store = await import('./plan-store')

  let phase = (): string => 'not started'
  createRoot((done) => {
    dispose = done
    const c = usePlanFlowController({ mode: 'new', onExit: () => undefined })
    c.done(GUITAR, NO_TEXTS, NO_PILLS)
    phase = c.phase
  })
  await settle()
  await vi.waitFor(until)

  const record = store.planRecord()
  return { phase: phase(), syncedAt: record?.syncedAt, status: record?.status }
}

beforeEach(() => {
  // The funnel logs each event it is told about.
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  localStorage.clear()
  mocks.upgraded.mockReset()
  mocks.upgraded.mockReturnValue(false)
  mocks.gateAsked.mockReset()
  mocks.submitPlanResponse.mockReset()
  mocks.syncMissing = false
})

afterEach(() => {
  dispose()
  vi.doUnmock('./plan-sync')
  vi.restoreAllMocks()
})

describe('a finished plan and the account sync', () => {
  it('loads no sync at all for a singer with no account, and still shows the plan', async () => {
    const after = await finishARun(() => {
      expect(mocks.gateAsked).toHaveBeenCalled()
    })
    // The gate has said no. A load it had asked for anyway would land well
    // inside this: the signed-in case's arrives in a few milliseconds.
    await new Promise((r) => setTimeout(r, 100))

    expect(mocks.syncLoads).toBe(0)
    expect(mocks.submitPlanResponse).not.toHaveBeenCalled()
    expect(after).toMatchObject({ phase: 'plan', status: 'answered' })
    expect(after.syncedAt).toBeUndefined()
  })

  it('loads the sync once for a singer with an account, and it writes the plan once', async () => {
    mocks.upgraded.mockReturnValue(true)

    const after = await finishARun(() => {
      expect(mocks.submitPlanResponse).toHaveBeenCalled()
    })
    await settle()

    expect(mocks.syncLoads).toBe(1)
    expect(mocks.submitPlanResponse).toHaveBeenCalledTimes(1)
    expect(after).toMatchObject({ phase: 'plan', status: 'answered' })
    expect(after.syncedAt).toBeDefined()
  })

  it('costs one sync and nothing else when the sync cannot be loaded: no rejection is left unheard', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.upgraded.mockReturnValue(true)
    mocks.syncMissing = true

    const after = await finishARun(() => {
      expect(warn).toHaveBeenCalled()
    })

    expect(mocks.syncLoads).toBe(1)
    expect(mocks.submitPlanResponse).not.toHaveBeenCalled()
    expect(after).toMatchObject({ phase: 'plan', status: 'answered' })
    expect(after.syncedAt).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[plan-sync]'),
      expect.any(Error),
    )
  })
})
