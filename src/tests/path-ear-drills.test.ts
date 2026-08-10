// ============================================================
// The Ascent's ear week points into the Ear Lab.
//
// The link is by drill *id* rather than by type, because Ear Lab
// drills are deliberately kept out of the vocal ExerciseType union
// — which means nothing but a test stops a typo from shipping as a
// chip that renders a raw id and navigates nowhere.
// ============================================================

import { describe, expect, it } from 'vitest'
import { ASCENT_WEEKS } from '@/features/path/path-content'
import { findIdentificationDrill, findThresholdDrill } from '@/lib/ear/drills'
import { SPRINT_DRILL_IDS } from '@/lib/ear/sprint'

const referenced = ASCENT_WEEKS.flatMap((week) => week.earDrills ?? [])

describe("The Ascent's Ear Lab links", () => {
  it('the ear week actually references drills', () => {
    const earWeek = ASCENT_WEEKS.find((week) => week.theme === 'ear')
    expect(earWeek?.earDrills?.length ?? 0).toBeGreaterThan(0)
  })

  it('every referenced id exists in the drill catalogue', () => {
    for (const drillId of referenced) {
      const drill =
        findThresholdDrill(drillId) ?? findIdentificationDrill(drillId)
      expect(drill, `unknown Ear Lab drill id: ${drillId}`).toBeDefined()
    }
  })

  it('every referenced drill is one a user can actually open', () => {
    // The catalogue is larger than what has a view; a chip pointing at
    // a designed-but-unbuilt drill would dead-end.
    for (const drillId of referenced) {
      expect(SPRINT_DRILL_IDS, `no view for drill: ${drillId}`).toContain(
        drillId,
      )
    }
  })

  it('does not repeat a drill within a week', () => {
    for (const week of ASCENT_WEEKS) {
      const ids = week.earDrills ?? []
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
