// ============================================================
// Plan store — what each write records
// ============================================================
//
// Pins what the store writes to the one record it keeps, and when. Showing
// the plan is written once, under the way the plan was first shown, and a
// shown plan is never written again. An answer is dated, keeps that way in,
// carries no synced date (so a changed plan syncs again) and is saved as the
// questions settle it, in new arrays. The two typed lines go to this device
// before the record is written and never into the record, and each is kept
// only while its option is picked. A voiceprint is kept only where it
// pointed, and never why. Not now keeps the answers so far, and an answered
// plan is never turned back into shown or declined.
//
// What a write will not write over (a stored value that cannot be read, a
// plan that was sent and changed since, storage that refuses a write) is in
// plan-store.guards.test.ts. The stops opened and the layer are in
// plan-store.device.test.ts.
//
// Each case builds a fresh store, because the store reads storage once, as
// the module loads.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FirstStop } from '@/features/onboarding/first-stop'
import { pickFirstStop } from '@/features/onboarding/first-stop'
import { ROOMS } from '@/features/onboarding/rooms'
import { buildPlan } from './build-plan'
import { VOICEPRINT_CHIP } from './plan-copy'
import { PLAN_RECORD_KEY, PLAN_TEXT_KEY } from './plan-keys'
import type { PlanRecordV1 } from './plan-record'
import { isPlanRecordV1, readPlanTexts } from './plan-record'
import type * as PlanStore from './plan-store'
import type { PlanChoices } from './questions'
import { EMPTY_CHOICES } from './questions'

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

/** The record as storage holds it, parsed. */
const stored = (): unknown =>
  JSON.parse(localStorage.getItem(PLAN_RECORD_KEY) ?? 'null')

/**
 * The keys whose stored text contains `text`. The test storage is a plain
 * object, so it is walked by length and key(): Object.keys would list its
 * methods and never a key.
 */
function keysHolding(text: string): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key !== null && (localStorage.getItem(key) ?? '').includes(text)) {
      keys.push(key)
    }
  }
  return keys
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('showing the plan', () => {
  it('records that the plan was shown, and how, when there is no record', async () => {
    const store = await freshStore()

    store.markPlanShown('first-light', NOW)

    expect(store.planRecord()).toEqual({
      v: 1,
      status: 'shown',
      choices: { q1: null, q2: null, q3: [], q4: [] },
      at: NOW.toISOString(),
      via: 'first-light',
    })
    expect(stored()).toEqual(store.planRecord())
  })

  it('writes only when there is no record', async () => {
    const store = await freshStore()

    store.markPlanShown('first-light', NOW)
    store.markPlanShown('layer', LATER)

    expect(store.planRecord()).toMatchObject({
      status: 'shown',
      via: 'first-light',
      at: NOW.toISOString(),
    })
  })

  it('keeps a skipped intro as the way the plan was first shown', async () => {
    const store = await freshStore()

    store.markPlanShown('welcome-skip', NOW)
    store.markPlanShown('layer', LATER)

    expect(store.planRecord()?.via).toBe('welcome-skip')
  })

  it('never turns a declined plan back into shown', async () => {
    const store = await freshStore()
    store.declinePlan(OTHER, NOW)

    store.markPlanShown('layer', LATER)

    expect(store.planRecord()).toMatchObject({
      status: 'declined',
      at: NOW.toISOString(),
    })
  })

  it('reads the record again after a reload', async () => {
    const first = await freshStore()
    first.markPlanShown('layer', NOW)

    const second = await freshStore()

    expect(second.planRecord()).toEqual(first.planRecord())
  })

  it('does not make whatever calls it depend on the record', async () => {
    const { createRoot, createEffect } = await import('solid-js')
    const store = await freshStore()
    let runs = 0
    // The writes look at the record before they write. An effect that
    // calls them must not rerun whenever the record or the stops change.
    const dispose = createRoot((dispose) => {
      createEffect(() => {
        runs += 1
        store.markPlanShown('layer', NOW)
        store.markStopOpened('jam')
      })
      return dispose
    })

    store.savePlanAnswers(CHOICES, NO_TEXTS, null, LATER)
    store.markStopOpened('lesson1')
    dispose()

    expect(runs).toBe(1)
  })
})

describe('answering', () => {
  it('saves the answers, dated, under the way the plan was first shown', async () => {
    const store = await freshStore()
    store.markPlanShown('welcome-skip', NOW)

    store.savePlanAnswers(CHOICES, NO_TEXTS, null, LATER)

    expect(store.planRecord()).toEqual({
      v: 1,
      status: 'answered',
      choices: CHOICES,
      at: LATER.toISOString(),
      via: 'welcome-skip',
    })
    expect(stored()).toEqual(store.planRecord())
  })

  it('answers when nothing was recorded as shown, as an answer in the app', async () => {
    const store = await freshStore()

    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)

    expect(store.planRecord()).toMatchObject({
      status: 'answered',
      via: 'layer',
    })
  })

  it('never turns an answered plan back into shown or declined', async () => {
    const store = await freshStore()
    store.markPlanShown('first-light', NOW)
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)

    store.markPlanShown('layer', LATER)
    store.declinePlan(OTHER, LATER)

    const expected = {
      status: 'answered',
      choices: CHOICES,
      at: NOW.toISOString(),
    }
    expect(store.planRecord()).toMatchObject(expected)
    expect(stored()).toMatchObject(expected)
    expect((await freshStore()).planRecord()).toMatchObject(expected)
  })

  it('lets a new answer replace an earlier one', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)

    store.savePlanAnswers(OTHER, NO_TEXTS, null, LATER)

    expect(store.planRecord()).toMatchObject({
      status: 'answered',
      choices: OTHER,
      at: LATER.toISOString(),
    })
  })

  it('clears the synced date, so a changed plan syncs again', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)
    store.markPlanSynced(NOW.toISOString(), SYNCED)
    expect(store.planRecord()?.syncedAt).toBe(SYNCED.toISOString())

    store.savePlanAnswers(OTHER, NO_TEXTS, null, LATER)

    expect(store.planRecord()?.syncedAt).toBeUndefined()
    expect(stored()).not.toHaveProperty('syncedAt')
  })

  it('keeps the typed lines on the device, and never in the record', async () => {
    const store = await freshStore()

    store.savePlanAnswers(TYPED, LINES, null, NOW)

    expect(readPlanTexts()).toEqual(LINES)
    // Storage is walked whole: the device key holds each line and no other
    // key does, so neither the record nor a synced `pitchperfect_` key has it.
    expect(keysHolding('neighbours')).toEqual([PLAN_TEXT_KEY])
    expect(keysHolding('Duolingo')).toEqual([PLAN_TEXT_KEY])
    expect(JSON.stringify(store.planRecord())).not.toContain('neighbours')
    expect(JSON.stringify(store.planRecord())).not.toContain('Duolingo')
  })

  it('writes the typed lines before the record, so a reader of the record finds them', async () => {
    const { createRoot, createEffect } = await import('solid-js')
    const store = await freshStore()
    const seen: string[] = []
    // The reader is live before the save, as a sync that sends the record
    // and the lines together would be: setting the record runs it at once,
    // and it must find the lines already stored.
    const dispose = createRoot((dispose) => {
      createEffect(() => {
        if (store.planRecord()?.status === 'answered') {
          seen.push(readPlanTexts().q3other)
        }
      })
      return dispose
    })

    store.savePlanAnswers(TYPED, { q3other: 'no time', q4app: '' }, null, NOW)
    dispose()

    expect(seen).toEqual(['no time'])
  })

  it('clips the typed lines to their limits', async () => {
    const store = await freshStore()

    store.savePlanAnswers(
      TYPED,
      { q3other: 'a'.repeat(200), q4app: 'b'.repeat(200) },
      null,
      NOW,
    )

    expect(readPlanTexts()).toEqual({
      q3other: 'a'.repeat(140),
      q4app: 'b'.repeat(60),
    })
  })

  it('keeps the "Something else" line only while it is picked', async () => {
    const store = await freshStore()

    store.savePlanAnswers(
      { ...TYPED, q3: ['progress', 'tune'] },
      LINES,
      null,
      NOW,
    )

    expect(readPlanTexts()).toEqual({ q3other: '', q4app: LINES.q4app })
    expect(keysHolding('neighbours')).toEqual([])
  })

  it('keeps the "Another app" line only while it is picked', async () => {
    const store = await freshStore()

    store.savePlanAnswers({ ...TYPED, q4: ['teacher'] }, LINES, null, NOW)

    expect(readPlanTexts()).toEqual({ q3other: LINES.q3other, q4app: '' })
    expect(keysHolding('Duolingo')).toEqual([])
  })

  it('stores empty lines over earlier ones when their options are no longer picked', async () => {
    const store = await freshStore()
    store.savePlanAnswers(TYPED, LINES, null, NOW)
    expect(readPlanTexts()).toEqual(LINES)

    // The person goes back and changes both picks. The screen may still
    // hold what was typed, and hands it over again.
    store.savePlanAnswers(CHOICES, LINES, null, LATER)

    expect(readPlanTexts()).toEqual(NO_TEXTS)
    expect(keysHolding('neighbours')).toEqual([])
    expect(keysHolding('Duolingo')).toEqual([])
  })

  it('has no line for a "Something else" that the two Q3 slots had no room for', async () => {
    const store = await freshStore()

    store.savePlanAnswers(
      { ...TYPED, q3: ['time', 'what', 'other'] },
      LINES,
      null,
      NOW,
    )

    expect(store.planRecord()?.choices.q3).toEqual(['time', 'what'])
    expect(readPlanTexts().q3other).toBe('')
  })

  it('saves a settled copy of the choices, not the object it was handed', async () => {
    const store = await freshStore()
    const handed: PlanChoices = {
      q1: 'singing',
      q2: null,
      q3: ['time', 'what', 'shy'],
      q4: ['app'],
    }

    store.savePlanAnswers(handed, NO_TEXTS, null, NOW)
    handed.q3.length = 0
    handed.q4.push('video')

    // A third hard part is more than the questions allow, so it never reaches the record.
    expect(store.planRecord()?.choices).toEqual({
      q1: 'singing',
      q2: null,
      q3: ['time', 'what'],
      q4: ['app'],
    })
    expect(isPlanRecordV1(stored())).toBe(true)
  })

  it('reads back every record it writes', async () => {
    const store = await freshStore()

    store.markPlanShown('layer', NOW)
    expect(isPlanRecordV1(stored())).toBe(true)
    store.declinePlan(OTHER, NOW)
    expect(isPlanRecordV1(stored())).toBe(true)
    store.savePlanAnswers(
      CHOICES,
      NO_TEXTS,
      { room: 'karaoke', detail: null },
      NOW,
    )
    expect(isPlanRecordV1(stored())).toBe(true)
    expect((await freshStore()).planRecord()).toEqual(stored())
  })
})

describe('what the record keeps of a voiceprint', () => {
  it.each([
    ['exercises', 'Long Note'],
    ['exercises', 'Interval Trainer'],
    ['ascent', 'Range week'],
    ['karaoke', null],
  ] as const)(
    'keeps where a %s finding pointed (%s), and never why',
    async (room, detail) => {
      const store = await freshStore()

      store.savePlanAnswers(
        CHOICES,
        NO_TEXTS,
        { room, detail, reason: 'Why it was found.' },
        NOW,
      )

      expect(store.planRecord()?.voiceprint).toEqual({ room, detail })
      expect(localStorage.getItem(PLAN_RECORD_KEY)).not.toContain(
        'Why it was found',
      )
    },
  )

  const NO_FINDING: [string, FirstStop | null | undefined][] = [
    ['the voiceprint of nothing measured', pickFirstStop(null)],
    ['no voiceprint', null],
    ['a voiceprint not given', undefined],
  ]

  it.each(NO_FINDING)('keeps nothing for %s', async (_, voiceprint) => {
    const store = await freshStore()

    store.savePlanAnswers(CHOICES, NO_TEXTS, voiceprint, NOW)

    expect(store.planRecord()).not.toHaveProperty('voiceprint')
    expect(stored()).not.toHaveProperty('voiceprint')
  })

  it('keeps a voiceprint exactly when the plan would use it', async () => {
    // The finding is build-plan's to define. A singer who picked no hard
    // part is the case where the voiceprint leads Start here, so that is the
    // probe: for every room, did the plan lead with the voiceprint, and did
    // the record keep it.
    const store = await freshStore()
    const singer: PlanChoices = {
      ...EMPTY_CHOICES,
      q1: 'singing',
      q3: [],
      q4: [],
    }
    const kept: string[] = []
    const used: string[] = []

    for (const { id: room } of ROOMS) {
      const found = { room, detail: 'A drill', reason: 'Because.' }
      store.savePlanAnswers(singer, NO_TEXTS, found, NOW)
      if (store.planRecord()?.voiceprint !== undefined) kept.push(room)
      if (
        buildPlan(singer, { voiceprint: found }).start.chips.includes(
          VOICEPRINT_CHIP,
        )
      )
        used.push(room)
    }

    expect(used.length).toBeGreaterThan(0)
    expect(kept).toEqual(used)
  })
})

describe('Not now', () => {
  it('records Not now with the answers so far, under the way the plan was first shown', async () => {
    const store = await freshStore()
    store.markPlanShown('first-light', NOW)

    store.declinePlan({ q1: 'singing', q2: 'fun', q3: [], q4: [] }, LATER)

    expect(store.planRecord()).toEqual({
      v: 1,
      status: 'declined',
      choices: { q1: 'singing', q2: 'fun', q3: [], q4: [] },
      at: LATER.toISOString(),
      via: 'first-light',
    })
    expect(stored()).toEqual(store.planRecord())
  })

  it('records Not now for a plan that was never recorded as shown', async () => {
    const store = await freshStore()

    store.declinePlan(OTHER, NOW)

    expect(store.planRecord()).toMatchObject({
      status: 'declined',
      via: 'layer',
    })
  })

  it('never overwrites an answered plan', async () => {
    const store = await freshStore()
    store.savePlanAnswers(CHOICES, NO_TEXTS, null, NOW)

    store.declinePlan(EMPTY_CHOICES, LATER)

    expect(store.planRecord()).toMatchObject({
      status: 'answered',
      choices: CHOICES,
    })
  })

  it('records a second Not now over the first, with nothing carried over from it', async () => {
    // A declined record that carries a synced date, as a settings pull from
    // another device can bring one.
    const first: PlanRecordV1 = {
      v: 1,
      status: 'declined',
      choices: OTHER,
      at: NOW.toISOString(),
      via: 'first-light',
      syncedAt: SYNCED.toISOString(),
    }
    localStorage.setItem(PLAN_RECORD_KEY, JSON.stringify(first))
    const store = await freshStore()
    expect(store.planRecord()).toEqual(first)

    store.declinePlan({ ...OTHER, q3: ['time', 'what'] }, LATER)

    expect(store.planRecord()).toEqual({
      v: 1,
      status: 'declined',
      choices: { ...OTHER, q3: ['time', 'what'] },
      at: LATER.toISOString(),
      via: 'first-light',
    })
    expect(stored()).not.toHaveProperty('syncedAt')
  })

  it('saves a settled copy of the choices, not the object it was handed', async () => {
    const store = await freshStore()
    const handed: PlanChoices = { q1: 'ear', q2: null, q3: ['time'], q4: [] }

    store.declinePlan(handed, NOW)
    handed.q3.push('setup')

    expect(store.planRecord()?.choices.q3).toEqual(['time'])
  })
})
