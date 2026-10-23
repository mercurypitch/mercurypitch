// ============================================================
// Sync precedence — a key's own rule for which value stands
// ============================================================
//
// A write made on a signed-in device is held as pending until it reaches the
// account, and a pending value normally wins over the account's row: it is
// the newer word. The plan record is the exception. Its status only moves
// forward, so a 'shown' or a 'declined' written before this device has pulled
// must not replace a plan the person answered on another device. The plan
// registers preferPlanRecord for its key as App does, before the sync starts,
// and these cases run the real service, the real plan store and the real rule
// over a fake account, on the pull and on the debounced upload.
//
// A file of its own because settings-pulled.test.ts asks one question (did
// the first pull bring the account in), and these cases would take it past
// 400 lines. The harness is the smallest the cases need: the identity, the
// clock, and an account whose rows record every write.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAN_RECORD_KEY } from '@/features/plan/plan-keys'
import type { PlanRecordV1 } from '@/features/plan/plan-record'

type Row = { id: string; userId: string; key: string; value: string }
const state = vi.hoisted(() => ({
  rows: [] as Row[],
  writes: [] as Row[],
  /** The key each read asked for: undefined is the pull's read of every row. */
  reads: [] as (string | undefined)[],
  failRead: false,
  beforeRead: undefined as (() => Promise<void>) | undefined,
}))
vi.mock('@/lib/defaults', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  API_BASE_URL: 'https://api.test',
}))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => true,
  hasUpgradedAccount: () => true,
  storedTokenProvider: () => 'password',
  isRegisteredProvider: (provider: string | null | undefined) =>
    provider != null && provider !== 'anonymous',
  currentAccountId: () => 'a',
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => 'a',
  getDeviceId: () => 'device',
  authVersion: () => 0,
  getAuthToken: () => 'a:0',
}))
vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      findAll: async (options?: { where?: { key?: string } }) => {
        const key = options?.where?.key
        state.reads.push(key)
        if (state.failRead) throw new Error('offline read')
        const rows = state.rows
          .filter((row) => key === undefined || row.key === key)
          .map((row) => ({ ...row }))
        await state.beforeRead?.()
        return rows
      },
      update: async (id: string, patch: { value: string }) => {
        const row = state.rows.find((candidate) => candidate.id === id)
        if (row === undefined) throw new Error('no such row')
        row.value = patch.value
        state.writes.push({ ...row })
      },
      create: async (input: { key: string; value: string }) => {
        const row = { ...input, userId: 'a', id: `row-${state.rows.length}` }
        state.rows.push(row)
        state.writes.push({ ...row })
        return row
      },
    }),
  }),
}))

const EARLY = '2026-10-20T12:00:00.000Z'
const LATE = '2026-10-21T09:30:00.000Z'
const NO_CHOICES = { q1: null, q2: null, q3: [], q4: [] }

/** The plan the person answered on another device, as the account holds it. */
const ANSWERED: PlanRecordV1 = {
  v: 1,
  status: 'answered',
  choices: { q1: 'singing', q2: 'audition', q3: ['tune'], q4: [] },
  at: EARLY,
  via: 'first-light',
  syncedAt: EARLY,
}

/** A preference no rule is registered for. */
const PROBE = 'pitchperfect_precedence_probe'

function accountHolds(key: string, value: string): void {
  state.rows.push({ id: `a-${key}`, userId: 'a', key, value })
}

const accountValue = (key: string): string | undefined =>
  state.rows.find((row) => row.key === key)?.value

/** Holds the next read of the account until the returned release is called. */
function holdTheRead(): () => void {
  const held = Promise.withResolvers<undefined>()
  state.beforeRead = async () => {
    state.beforeRead = undefined
    await held.promise
  }
  return () => {
    held.resolve(undefined)
  }
}

const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}
/** Past the push debounce, and every push it starts. */
const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(1500)
  await settle()
}

let dispose: (() => void) | undefined

/** A page load: the rule registered as App does, then the sync started, which pulls. */
async function boot() {
  vi.resetModules()
  const sync = await import('./settings-service')
  const { readPending } = await import('./settings-pending')
  const { preferPlanRecord } = await import('@/features/plan/plan-precedence')
  const plan = await import('@/features/plan/plan-store')
  const storage = await import('@/lib/storage')
  sync.registerSyncPrecedence(PLAN_RECORD_KEY, preferPlanRecord)
  createRoot((cleanup) => {
    dispose = cleanup
    sync.initSettingsSync()
  })
  await settle()
  return { plan, storage, pending: () => readPending('a') }
}

type Booted = Awaited<ReturnType<typeof boot>>

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  Object.assign(state, {
    rows: [],
    writes: [],
    reads: [],
    failRead: false,
    beforeRead: undefined,
  })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(async () => {
  dispose?.()
  dispose = undefined
  await settle()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** The device holds the account's answered plan, and has nothing left to send. */
function expectTheAnsweredPlan(page: Booted): void {
  expect(accountValue(PLAN_RECORD_KEY)).toBe(JSON.stringify(ANSWERED))
  expect(state.writes).toEqual([])
  expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(JSON.stringify(ANSWERED))
  expect(page.plan.planRecord()).toEqual(ANSWERED)
  expect(page.pending()).toEqual({})
}

describe('the plan record, on a device that has not pulled the account yet', () => {
  it.each<{ write: string; run: (plan: Booted['plan']) => void }>([
    { write: 'shown', run: (plan) => plan.markPlanShown('layer') },
    { write: 'declined', run: (plan) => plan.declinePlan(NO_CHOICES) },
  ])(
    'a $write record written before the pull lands does not replace the answered plan',
    async ({ run }) => {
      accountHolds(PLAN_RECORD_KEY, JSON.stringify(ANSWERED))
      const release = holdTheRead()
      const page = await boot()

      run(page.plan)
      release()
      await settle()
      await flush()

      expectTheAnsweredPlan(page)
      // The pull dropped it, so the flush had nothing to send.
      expect(state.reads).toEqual([undefined])
    },
  )

  it("a 'shown' waiting on a failed pull is not uploaded over the answered plan", async () => {
    accountHolds(PLAN_RECORD_KEY, JSON.stringify(ANSWERED))
    state.failRead = true
    const page = await boot()
    state.failRead = false

    page.plan.markPlanShown('layer')
    await flush()

    expectTheAnsweredPlan(page)
    // The failed pull, then the upload's own read of the row it kept.
    expect(state.reads).toEqual([undefined, PLAN_RECORD_KEY])
  })

  it('a newer answered plan on this device replaces an older one on the account', async () => {
    accountHolds(PLAN_RECORD_KEY, JSON.stringify(ANSWERED))
    const release = holdTheRead()
    const page = await boot()

    page.plan.savePlanAnswers(
      { q1: 'guitar', q2: null, q3: [], q4: [] },
      { q3other: '', q4app: '' },
      null,
      new Date(LATE),
    )
    release()
    await settle()
    await flush()

    const mine = localStorage.getItem(PLAN_RECORD_KEY)
    expect(JSON.parse(mine ?? 'null')).toMatchObject({
      status: 'answered',
      at: LATE,
    })
    expect(state.writes.map((row) => row.key)).toEqual([PLAN_RECORD_KEY])
    expect(accountValue(PLAN_RECORD_KEY)).toBe(mine)
    expect(page.pending()).toEqual({})
  })
})

describe('a key with no rule', () => {
  it("keeps today's order: the pending value still wins over the account's row", async () => {
    accountHolds(PROBE, 'from-the-account')
    const release = holdTheRead()
    const page = await boot()
    const [, setProbe] = page.storage.createPersistedSignal(PROBE, '')

    setProbe('from-this-device')
    release()
    await settle()
    await flush()

    expect(accountValue(PROBE)).toBe('from-this-device')
    expect(state.writes.map((row) => row.value)).toEqual(['from-this-device'])
    expect(localStorage.getItem(PROBE)).toBe('from-this-device')
    expect(page.pending()).toEqual({})
  })
})
