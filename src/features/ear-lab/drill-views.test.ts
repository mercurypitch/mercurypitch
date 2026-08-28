import { describe, expect, it } from 'vitest'
import { SPRINT_DRILL_IDS } from '@/lib/ear/sprint'
import { VIEW_FOR_DRILL, viewForDrill } from './drill-views'

describe('drill views', () => {
  it('offers in the sprint only what has a view', () => {
    for (const id of SPRINT_DRILL_IDS) {
      expect(viewForDrill(id), `${id} has no view`).toBeDefined()
    }
  })

  it('opens the built drills, and keeps the unbuilt off every door', () => {
    for (const id of ['pulse', 'echo', 'span', 'beat-hunt', 'drift']) {
      expect(VIEW_FOR_DRILL).toHaveProperty(id, id)
      expect(SPRINT_DRILL_IDS).toContain(id)
    }
    for (const id of ['gravity', 'the-pull', 'cadence', 'bassline']) {
      expect(VIEW_FOR_DRILL).not.toHaveProperty(id)
      expect(SPRINT_DRILL_IDS).not.toContain(id)
    }
  })
})
