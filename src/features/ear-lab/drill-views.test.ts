import { describe, expect, it } from 'vitest'
import { SPRINT_DRILL_IDS } from '@/lib/ear/sprint'
import { VIEW_FOR_DRILL, viewForDrill } from './drill-views'

describe('drill views', () => {
  it('offers in the sprint only what has a view', () => {
    for (const id of SPRINT_DRILL_IDS) {
      expect(viewForDrill(id), `${id} has no view`).toBeDefined()
    }
  })

  it('opens Pulse now that it is built, and keeps Echo off every door until it is', () => {
    expect(VIEW_FOR_DRILL).toHaveProperty('pulse', 'pulse')
    expect(SPRINT_DRILL_IDS).toContain('pulse')
    expect(VIEW_FOR_DRILL).not.toHaveProperty('echo')
    expect(SPRINT_DRILL_IDS).not.toContain('echo')
  })
})
