import { describe, expect, it } from 'vitest'
import { SPRINT_DRILL_IDS } from '@/lib/ear/sprint'
import { VIEW_FOR_DRILL, viewForDrill } from './drill-views'

describe('drill views', () => {
  it('offers in the sprint only what has a view', () => {
    for (const id of SPRINT_DRILL_IDS) {
      expect(viewForDrill(id), `${id} has no view`).toBeDefined()
    }
  })

  it('keeps the designed rhythm drills off every door until built', () => {
    expect(VIEW_FOR_DRILL).not.toHaveProperty('pulse')
    expect(VIEW_FOR_DRILL).not.toHaveProperty('echo')
    expect(SPRINT_DRILL_IDS).not.toContain('pulse')
    expect(SPRINT_DRILL_IDS).not.toContain('echo')
  })
})
