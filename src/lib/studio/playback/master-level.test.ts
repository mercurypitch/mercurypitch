// Studio master level tests — a run starts at the level heard: a fresh measurement, the held run's, or the song's last.
import { describe, expect, it } from 'vitest'
import { studioFixture } from '../model/model.test-fixtures'
import { checkStudioMasterGain, createStudioMasterLevel } from './master-level'

const { project } = studioFixture()
const token = (gainDb: number, revision = project.revision) => ({
  projectId: project.id,
  revision,
  gainDb,
  safetyGainDb: -1,
})

describe('Studio master level', () => {
  it('starts at a fresh measurement, then the held run, then the song last measured, and 0 dB only before any', () => {
    const level = createStudioMasterLevel()
    expect(level.startingGain(project, null)).toEqual({
      gainDb: 0,
      safetyGainDb: 0,
    })
    level.set(token(4.5))
    expect(level.observe(project)).toBe(true)
    const held = { gainDb: 2, safetyGainDb: 0 }
    expect(level.startingGain(project, held)).toEqual({
      gainDb: 4.5,
      safetyGainDb: -1,
    })

    // An edit: the measurement is stale, the level it set is not forgotten.
    const edited = { ...project, revision: project.revision + 1 }
    expect(level.observe(edited)).toBe(false)
    expect(level.fresh()).toBeNull()
    expect(level.startingGain(edited, held)).toEqual(held)
    expect(level.startingGain(edited, null)).toEqual({
      gainDb: 4.5,
      safetyGainDb: -1,
    })
    // Another song never starts at this one's level.
    expect(level.startingGain({ ...edited, id: 'other' }, null)).toEqual({
      gainDb: 0,
      safetyGainDb: 0,
    })
    level.set(null)
    expect(level.startingGain(edited, null)).toEqual({
      gainDb: 0,
      safetyGainDb: 0,
    })
  })

  it('refuses a gain the master chain cannot take', () => {
    for (const gainDb of [Number.NaN, -24.5, 36.5])
      expect(() => checkStudioMasterGain(token(gainDb))).toThrow(
        /invalid gain settings/,
      )
    for (const safetyGainDb of [0.5, -24.5, Number.POSITIVE_INFINITY])
      expect(() =>
        checkStudioMasterGain({ ...token(0), safetyGainDb }),
      ).toThrow(/invalid gain settings/)
    expect(() => checkStudioMasterGain(token(36))).not.toThrow()
    expect(() => createStudioMasterLevel().set(token(40))).toThrow(
      /invalid gain settings/,
    )
  })
})
