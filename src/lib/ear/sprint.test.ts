// ============================================================
// Daily Sprint — the scheduler's promises.
//
// Three of them matter: it never schedules a drill you cannot
// finish twice, it always spends most of the sprint on what is
// actually weakest, and the rotation slot guarantees a strong
// faculty still comes round instead of being starved forever by
// one stubborn weak spot.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { SprintCandidate } from './sprint'
import { dayIndex, planDailySprint, SPRINT_IDENTIFICATION_ROUNDS, SPRINT_SEGMENTS, SPRINT_THRESHOLD_REVERSALS, } from './sprint'

const DAY = '2026-08-09'

function candidates(
  scores: Record<string, number | null>,
  kinds: Record<string, 'threshold' | 'identification'> = {},
): SprintCandidate[] {
  return Object.entries(scores).map(([drillId, score]) => ({
    drillId,
    score,
    kind: kinds[drillId] ?? 'identification',
  }))
}

describe('dayIndex', () => {
  it('advances by one per calendar day', () => {
    expect(dayIndex('2026-08-10') - dayIndex('2026-08-09')).toBe(1)
  })

  it('is stable for the same key', () => {
    expect(dayIndex(DAY)).toBe(dayIndex(DAY))
  })

  it('survives a malformed key instead of throwing', () => {
    expect(dayIndex('not-a-date')).toBe(0)
  })
})

describe('planDailySprint', () => {
  it('returns nothing when there is nothing to run', () => {
    expect(planDailySprint([], DAY)).toEqual([])
  })

  it('fills every slot when there are enough drills', () => {
    const plan = planDailySprint(
      candidates({ a: 500, b: 400, c: 300, d: 200, e: 100 }),
      DAY,
    )
    expect(plan).toHaveLength(SPRINT_SEGMENTS)
  })

  it('never schedules the same drill twice', () => {
    const plan = planDailySprint(
      candidates({ a: 100, b: 200, c: 300, d: 400 }),
      DAY,
    )
    const ids = plan.map((s) => s.drillId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('spends the need slots on the weakest drills', () => {
    const plan = planDailySprint(
      candidates({ strong: 900, mid: 500, weak: 100 }),
      DAY,
    )
    const needSlots = plan.filter((s) => s.reason !== 'rotation')
    expect(needSlots.map((s) => s.drillId)).toEqual(['weak', 'mid'])
  })

  it('puts an unmeasured drill ahead of the weakest measured one', () => {
    // You cannot improve what has never been read, so a missing
    // reading outranks even a terrible one.
    const plan = planDailySprint(
      candidates({ awful: 5, fresh: null, fine: 800 }),
      DAY,
    )
    expect(plan[0]?.drillId).toBe('fresh')
    expect(plan[0]?.reason).toBe('unmeasured')
  })

  it('breaks ties in catalogue order so the plan does not churn', () => {
    const first = planDailySprint(candidates({ a: 400, b: 400, c: 400 }), DAY)
    const again = planDailySprint(candidates({ a: 400, b: 400, c: 400 }), DAY)
    expect(first.map((s) => s.drillId)).toEqual(again.map((s) => s.drillId))
    expect(first.slice(0, 2).map((s) => s.drillId)).toEqual(['a', 'b'])
  })

  it('is stable across repeated planning on the same day', () => {
    const scores = { a: 100, b: 200, c: 300, d: 400, e: 500 }
    expect(planDailySprint(candidates(scores), DAY)).toEqual(
      planDailySprint(candidates(scores), DAY),
    )
  })

  it('rotates the last slot as the days pass', () => {
    // The weak two never change, so if the rotation slot did not
    // move the user would get an identical sprint every morning.
    const scores = { a: 10, b: 20, c: 300, d: 400, e: 500, f: 600 }
    const seen = new Set<string>()
    for (let day = 9; day <= 15; day++) {
      const plan = planDailySprint(candidates(scores), `2026-08-${day}`)
      const rotation = plan.find((s) => s.reason === 'rotation')
      if (rotation) seen.add(rotation.drillId)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('never lets the rotation slot land on a drill already picked', () => {
    const scores = { a: 10, b: 20, c: 30 }
    for (let day = 1; day <= 28; day++) {
      const key = `2026-08-${String(day).padStart(2, '0')}`
      const plan = planDailySprint(candidates(scores), key)
      const ids = plan.map((s) => s.drillId)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('copes with fewer candidates than slots', () => {
    const plan = planDailySprint(candidates({ only: 300 }), DAY)
    expect(plan).toHaveLength(1)
    expect(plan[0]?.drillId).toBe('only')
  })

  it('gives each kind its own length field', () => {
    const plan = planDailySprint(
      candidates(
        { hairline: 100, home: 200 },
        { hairline: 'threshold', home: 'identification' },
      ),
      DAY,
    )
    const threshold = plan.find((s) => s.kind === 'threshold')
    const identification = plan.find((s) => s.kind === 'identification')
    expect(threshold?.kind === 'threshold' && threshold.reversals).toBe(
      SPRINT_THRESHOLD_REVERSALS,
    )
    expect(
      identification?.kind === 'identification' && identification.rounds,
    ).toBe(SPRINT_IDENTIFICATION_ROUNDS)
  })
})
