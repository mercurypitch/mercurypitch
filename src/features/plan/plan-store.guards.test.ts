// ============================================================
// Plan store — what a write will not write over
// ============================================================
//
// The record syncs to the account, and the settings sync carries whatever is
// stored, so a write that damages the stored record damages it on every
// device. This file pins the guards. A stored value that cannot be read (a
// newer client's record, or damage) is read as no plan but is never written
// over by "shown", "Not now" or the synced mark; only an answer replaces it.
// The look is at storage, not at the signal, because another tab, or a pull
// from the account, may have written since this tab loaded. The synced mark
// belongs to the plan that was sent: a plan answered again, or changed in
// another tab, since it was sent is not marked. Storage that refuses a write
// leaves the plan in memory, where the same guards still apply. And the
// record has no raw setter, so there is no way to write it without them.
// What each write records is in plan-store.test.ts.
//
// Each case builds a fresh store, because the store reads storage once, as
// the module loads.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAN_RECORD_KEY } from './plan-keys'
import type { PlanRecordV1 } from './plan-record'
import type * as PlanStore from './plan-store'
import type { PlanChoices } from './questions'

async function freshStore(): Promise<typeof PlanStore> {
  vi.resetModules()
  return import('./plan-store')
}

const NOW = new Date('2026-10-20T12:00:00.000Z')
const LATER = new Date('2026-10-21T09:30:00.000Z')
const SYNCED = new Date('2026-10-22T08:00:00.000Z')

const CHOICES: PlanChoices = {
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'tune'],
  q4: ['teacher'],
}
/** The picks of CHOICES, plus both options a person types under. */
const TYPED: PlanChoices = {
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'other'],
  q4: ['app'],
}
const OTHER: PlanChoices = { q1: 'guitar', q2: 'song', q3: ['time'], q4: [] }
const NO_TEXTS = { q3other: '', q4app: '' }
const LINES = {
  q3other: 'my neighbours can hear everything',
  q4app: 'Duolingo for guitar',
}

/** What a newer client wrote: not a version this one can read. */
const FUTURE = JSON.stringify({
  v: 2,
  status: 'answered',
  choices: CHOICES,
  at: NOW.toISOString(),
  via: 'layer',
  somethingNew: 'a field version 1 does not have',
})

/** The record as storage holds it, parsed. */
const stored = (): unknown =>
  JSON.parse(localStorage.getItem(PLAN_RECORD_KEY) ?? 'null')

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('marking the plan synced', () => {
  const SENT = NOW.toISOString()

  it('marks the plan that was sent, and changes nothing else about it', async () => {
    const store = await freshStore()
    store.markPlanShown('first-light', NOW)
    const voiceprint = { room: 'exercises', detail: 'Long Note' } as const
    store.savePlanAnswers(CHOICES, NO_TEXTS, voiceprint, NOW)
    const answered = store.planRecord()

    store.markPlanSynced(SENT, SYNCED)

    const marked = { ...answered, syncedAt: SYNCED.toISOString() }
    expect(store.planRecord()).toEqual(marked)
    expect(stored()).toEqual(marked)
    expect((await freshStore()).planRecord()).toEqual(marked)
  })

  it('marks it once: a second reply leaves the first mark', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)

    store.markPlanSynced(SENT, SYNCED)
    store.markPlanSynced(SENT, LATER)

    expect(store.planRecord()?.syncedAt).toBe(SYNCED.toISOString())
  })

  it.each<[string, (store: typeof PlanStore) => void]>([
    ['only shown', (store) => store.markPlanShown('layer', NOW)],
    ['turned down', (store) => store.declinePlan(OTHER, NOW)],
  ])('does not mark a plan that was %s', async (_, put) => {
    const store = await freshStore()
    put(store)

    store.markPlanSynced(SENT, SYNCED)

    expect(store.planRecord()).not.toHaveProperty('syncedAt')
    expect(stored()).not.toHaveProperty('syncedAt')
  })

  it('writes nothing when there is no record', async () => {
    const store = await freshStore()

    store.markPlanSynced(SENT, SYNCED)

    expect(store.planRecord()).toBeNull()
    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBeNull()
  })

  it('does not mark a plan that was answered again while it was being sent', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)
    // The reply is still on its way when the person changes the plan: the
    // new plan has not been sent.
    store.savePlanAnswers(OTHER, NO_TEXTS, null, LATER)

    store.markPlanSynced(SENT, SYNCED)

    expect(store.planRecord()?.syncedAt).toBeUndefined()
    expect(stored()).not.toHaveProperty('syncedAt')
    // The new plan is marked by the reply to its own sending.
    store.markPlanSynced(LATER.toISOString(), SYNCED)
    expect(store.planRecord()?.syncedAt).toBe(SYNCED.toISOString())
  })

  it('does not mark a plan that another tab has changed since it was sent', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)
    // Storage moves on and this tab's signal does not: it still holds the
    // plan that was sent.
    const newer = {
      v: 1,
      status: 'answered',
      choices: OTHER,
      at: LATER.toISOString(),
      via: 'layer',
    } satisfies PlanRecordV1
    localStorage.setItem(PLAN_RECORD_KEY, JSON.stringify(newer))

    store.markPlanSynced(SENT, SYNCED)

    expect(stored()).toEqual(newer)
  })

  it("leaves a newer client's record alone when the plan cannot be read", async () => {
    localStorage.setItem(PLAN_RECORD_KEY, FUTURE)
    const store = await freshStore()
    expect(store.planRecord()).toBeNull()

    // FUTURE carries the date that was sent, so only the unreadable
    // value stands in the way. A write from the empty signal would store
    // the text null over it, and the sync would carry that to the account.
    store.markPlanSynced(SENT, SYNCED)

    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(FUTURE)
    expect(store.planRecord()).toBeNull()
  })

  it("leaves a newer client's record alone when a settings pull stored it under a readable plan", async () => {
    const store = await freshStore()
    const { applyPersistedValue } = await import('@/lib/storage')
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)
    // The pull stores the value, and the signal refuses it and keeps the old plan.
    applyPersistedValue(PLAN_RECORD_KEY, FUTURE)
    expect(store.planRecord()?.status).toBe('answered')

    store.markPlanSynced(SENT, SYNCED)

    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(FUTURE)
  })

  it('has no raw setter beside it, so every write to the record looks at storage first', async () => {
    const store = await freshStore()

    expect(store).not.toHaveProperty('setPlanRecord')
  })
})

describe('a stored value that cannot be read', () => {
  it('reads a garbage stored value as no plan', async () => {
    localStorage.setItem(PLAN_RECORD_KEY, '{"v":1}')

    const store = await freshStore()

    expect(store.planRecord()).toBeNull()
  })

  it.each([
    ['a record of a version it does not know', FUTURE],
    ['a list', '[]'],
    ['a number', '42'],
    ['text', '"answered"'],
    [
      'a record with a status it does not know',
      JSON.stringify({
        v: 1,
        status: 'archived',
        choices: CHOICES,
        at: NOW.toISOString(),
        via: 'layer',
      }),
    ],
  ])('reads %s as no plan, and leaves it in storage', async (_, value) => {
    localStorage.setItem(PLAN_RECORD_KEY, value)

    const store = await freshStore()

    expect(store.planRecord()).toBeNull()
    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(value)
  })

  it('reads text that is not JSON as no plan, and says so once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(PLAN_RECORD_KEY, 'not a record')

    const store = await freshStore()

    expect(store.planRecord()).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe('not a record')
  })

  it('does not write "shown", "Not now" or a synced mark over it', async () => {
    localStorage.setItem(PLAN_RECORD_KEY, FUTURE)
    const store = await freshStore()

    store.markPlanShown('layer', NOW)
    store.declinePlan(CHOICES, NOW)
    store.markPlanSynced(NOW.toISOString(), LATER)

    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(FUTURE)
    expect(store.planRecord()).toBeNull()
  })

  it('replaces it when the person answers', async () => {
    localStorage.setItem(PLAN_RECORD_KEY, FUTURE)
    const store = await freshStore()

    store.savePlanAnswers(OTHER, NO_TEXTS, null, NOW)

    expect(store.planRecord()).toMatchObject({
      v: 1,
      status: 'answered',
      choices: OTHER,
    })
    expect(stored()).toMatchObject({ v: 1, status: 'answered', choices: OTHER })
  })

  it.each([
    ['text that is not JSON', 'not a record'],
    ['a list', '[]'],
    ['a record with no status', '{"v":1}'],
    ['zero', '0'],
  ])(
    'leaves %s alone for "shown", "Not now" and a synced mark, and lets an answer replace it',
    async (_, value) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorage.setItem(PLAN_RECORD_KEY, value)
      const store = await freshStore()

      store.markPlanShown('layer', NOW)
      store.declinePlan(CHOICES, NOW)
      store.markPlanSynced(NOW.toISOString(), LATER)
      expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(value)

      store.savePlanAnswers(OTHER, NO_TEXTS, null, LATER)
      expect(stored()).toMatchObject({
        v: 1,
        status: 'answered',
        choices: OTHER,
      })
    },
  )

  it.each([
    ['an empty value', ''],
    ['a stored null', 'null'],
  ])('writes "shown" over %s, which holds no record', async (_, value) => {
    localStorage.setItem(PLAN_RECORD_KEY, value)
    const store = await freshStore()

    store.markPlanShown('layer', NOW)

    expect(store.planRecord()).toMatchObject({ status: 'shown', via: 'layer' })
    expect(stored()).toMatchObject({ status: 'shown' })
  })

  it('does not write over a newer client record that a settings pull put in storage', async () => {
    const store = await freshStore()
    const { applyPersistedValue } = await import('@/lib/storage')
    store.markPlanShown('layer', NOW)

    // The pull stores the value, and the signal refuses what it cannot read.
    applyPersistedValue(PLAN_RECORD_KEY, FUTURE)
    expect(store.planRecord()?.status).toBe('shown')
    store.declinePlan(CHOICES, LATER)

    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(FUTURE)
  })

  it('does not write over an answered plan that another tab saved after this one loaded', async () => {
    const store = await freshStore()
    const elsewhere = JSON.stringify({
      v: 1,
      status: 'answered',
      choices: OTHER,
      at: NOW.toISOString(),
      via: 'layer',
    } satisfies PlanRecordV1)
    localStorage.setItem(PLAN_RECORD_KEY, elsewhere)

    store.markPlanShown('first-light', LATER)
    store.declinePlan(CHOICES, LATER)

    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(elsewhere)
  })
})

describe('storage that refuses a write', () => {
  // The test storage is a plain object, not a Storage, so a spy on
  // Storage.prototype never fires. The refusal is made on the object itself.
  async function storeThatRefusesWrites(): Promise<typeof PlanStore> {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = await freshStore()
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('the quota is used up')
    })
    return store
  }

  it('keeps an answered plan in memory, and "shown" and "Not now" do not write over it', async () => {
    const store = await storeThatRefusesWrites()

    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)
    // The refusal took effect: nothing reached storage.
    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBeNull()
    store.markPlanShown('layer', LATER)
    store.declinePlan(OTHER, LATER)

    expect(store.planRecord()).toMatchObject({
      status: 'answered',
      choices: CHOICES,
      at: NOW.toISOString(),
    })
  })

  it('marks the plan synced in memory, because it is the plan that was sent', async () => {
    const store = await storeThatRefusesWrites()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)

    store.markPlanSynced(NOW.toISOString(), SYNCED)

    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBeNull()
    expect(store.planRecord()?.syncedAt).toBe(SYNCED.toISOString())
  })

  it('does not throw, and keeps the answers and the stops opened in memory', async () => {
    const store = await storeThatRefusesWrites()

    expect(() => {
      store.markPlanShown('layer', NOW)
      store.savePlanAnswers(TYPED, LINES, null, LATER)
      store.markStopOpened('jam')
    }).not.toThrow()

    expect(localStorage.length).toBe(0)
    expect(store.planRecord()).toMatchObject({
      status: 'answered',
      via: 'layer',
    })
    expect(store.stopOpened('jam')).toBe(true)
  })
})
