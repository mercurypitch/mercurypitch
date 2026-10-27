// ============================================================
// Plan store — Home's card, hidden on this device
// ============================================================
//
// The X hides Home's card for the plan it shows: the store keeps that record's
// date under a device key, and the card is hidden while the record carries it.
// A plan answered again, here or on another device, is a record with a new
// date, so its card comes back for its week, while a Not now since holds no
// answers and keeps it hidden. A `true` stored before the X kept a date still
// hides the card, and saving answers on this device clears the key, so
// answering again always brings the card back. Storage that cannot be read
// holds no hide. Which record a hide hides is plan-card-rules.ts's rule,
// held in plan-card-rules.test.ts; these cases hold the store to it, and to
// what it writes.
//
// Each case builds a fresh store, because the store reads storage once, as
// the module loads.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hiddenOnDevice } from './plan-card-rules'
import { PLAN_CARD_DISMISSED_KEY, PLAN_RECORD_KEY } from './plan-keys'
import type { PlanRecordV1 } from './plan-record'
import type * as PlanStore from './plan-store'
import type { PlanChoices } from './questions'
import { EMPTY_CHOICES } from './questions'

async function freshStore(): Promise<typeof PlanStore> {
  vi.resetModules()
  return import('./plan-store')
}

const CHOICES: PlanChoices = {
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'tune'],
  q4: ['teacher'],
}
const NO_TEXTS = { q3other: '', q4app: '' }
const MONDAY = new Date('2026-10-19T12:00:00.000Z')
const TUESDAY = new Date('2026-10-20T12:00:00.000Z')
const WEDNESDAY = new Date('2026-10-21T12:00:00.000Z')

/** What the X stored, as JSON reads it back; null when nothing is stored. */
const stored = (): unknown =>
  JSON.parse(localStorage.getItem(PLAN_CARD_DISMISSED_KEY) ?? 'null')

/**
 * A plan answered on another device, as the settings pull applies it: through
 * the storage module the fresh store was loaded with, which is the one in the
 * registry now.
 */
async function answeredElsewhere(at: Date): Promise<void> {
  const { applyPersistedValue } = await import('@/lib/storage')
  const record: PlanRecordV1 = {
    v: 1,
    status: 'answered',
    choices: CHOICES,
    at: at.toISOString(),
    via: 'first-light',
  }
  applyPersistedValue(PLAN_RECORD_KEY, JSON.stringify(record))
}

beforeEach(() => {
  localStorage.clear()
})

describe('the X', () => {
  it('stores the date of the record whose card it hid, on this device only', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)

    store.hidePlanCard()

    expect(store.planCardHidden()).toBe(true)
    expect(stored()).toBe(MONDAY.toISOString())
    expect(hiddenOnDevice(store.planRecord())).toBe(true)
    expect(PLAN_CARD_DISMISSED_KEY.startsWith('mp.')).toBe(true)
  })

  it('stores nothing when there is no record to hide the card of', async () => {
    const store = await freshStore()

    store.hidePlanCard()

    expect(store.planCardHidden()).toBe(false)
    expect(localStorage.getItem(PLAN_CARD_DISMISSED_KEY)).toBeNull()
  })

  it('hides the card for the visit when the device refuses to remember it', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('The quota has been exceeded.')
    })

    store.hidePlanCard()

    expect(store.planCardHidden()).toBe(true)
    vi.restoreAllMocks()
    expect(localStorage.getItem(PLAN_CARD_DISMISSED_KEY)).toBeNull()
  })
})

describe('a plan answered again', () => {
  it('has its card back when it is answered on another device', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)
    store.hidePlanCard()

    await answeredElsewhere(TUESDAY)

    expect(store.planCardHidden()).toBe(false)
  })

  it('clears the hide when it is answered on this device', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)
    store.hidePlanCard()

    store.savePlanAnswers(CHOICES, NO_TEXTS, null, TUESDAY)

    expect(store.planCardHidden()).toBe(false)
    expect(localStorage.getItem(PLAN_CARD_DISMISSED_KEY)).toBeNull()
  })

  it('stays hidden while the record keeps its date: the account marking it sent', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)
    store.hidePlanCard()

    store.markPlanSynced(MONDAY.toISOString(), TUESDAY)

    expect(store.planRecord()?.syncedAt).toBe(TUESDAY.toISOString())
    expect(store.planCardHidden()).toBe(true)
  })
})

describe('a Not now since', () => {
  it('keeps the hidden ask off Home: no answers came, so there is no new plan', async () => {
    const store = await freshStore()
    store.declinePlan(EMPTY_CHOICES, MONDAY)
    store.hidePlanCard()

    store.declinePlan(EMPTY_CHOICES, TUESDAY)

    expect(store.planRecord()?.at).toBe(TUESDAY.toISOString())
    expect(store.planCardHidden()).toBe(true)
    expect(stored()).toBe(MONDAY.toISOString())
  })

  it('gives way to a plan answered after it on another device', async () => {
    const store = await freshStore()
    store.declinePlan(EMPTY_CHOICES, MONDAY)
    store.hidePlanCard()
    store.declinePlan(EMPTY_CHOICES, TUESDAY)

    await answeredElsewhere(WEDNESDAY)

    expect(store.planCardHidden()).toBe(false)
  })
})

describe('what the store reads as it loads', () => {
  it('reads the hide the X stored, for the record that carries its date', async () => {
    const first = await freshStore()
    first.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)
    first.hidePlanCard()

    const store = await freshStore()

    expect(store.planCardHidden()).toBe(true)
  })

  it('keeps a true stored before the X kept a date as a hide of any record', async () => {
    const first = await freshStore()
    first.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)
    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, 'true')

    const store = await freshStore()
    expect(store.planCardHidden()).toBe(true)
    await answeredElsewhere(TUESDAY)

    expect(store.planCardHidden()).toBe(true)
  })

  it('lets answers given on this device clear a true stored before the X kept a date', async () => {
    const first = await freshStore()
    first.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)
    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, 'true')
    const store = await freshStore()

    store.savePlanAnswers(CHOICES, NO_TEXTS, null, TUESDAY)

    expect(store.planCardHidden()).toBe(false)
    expect(localStorage.getItem(PLAN_CARD_DISMISSED_KEY)).toBeNull()
  })

  it('reads no hide where storage cannot say', async () => {
    const first = await freshStore()
    first.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)
    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, 'true')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const read = localStorage.getItem.bind(localStorage)
    vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
      if (key === PLAN_CARD_DISMISSED_KEY) throw new Error('Access denied.')
      return read(key)
    })

    const store = await freshStore()

    expect(store.planCardHidden()).toBe(false)
    vi.restoreAllMocks()
  })
})

describe('showing the card again', () => {
  it('clears the hide, in the signal and on the device', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, MONDAY)
    store.hidePlanCard()

    store.showPlanCard()

    expect(store.planCardHidden()).toBe(false)
    expect(localStorage.getItem(PLAN_CARD_DISMISSED_KEY)).toBeNull()
  })
})
