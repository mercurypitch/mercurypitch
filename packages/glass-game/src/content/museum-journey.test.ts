// Floating museum authoring tests — stage references remain complete and extensible.

import { describe, expect, it } from 'vitest'
import { MUSEUM_CAMPAIGN } from './campaign'
import { FLOATING_MUSEUM_JOURNEY, validateMuseumJourney, } from './museum-journey'

describe('floating museum journey authoring', () => {
  it('assigns every campaign chapter once and connects known stages', () => {
    expect(
      validateMuseumJourney(FLOATING_MUSEUM_JOURNEY, MUSEUM_CAMPAIGN),
    ).toEqual([])
    expect(
      FLOATING_MUSEUM_JOURNEY.stages.flatMap((stage) => stage.chapterIds),
    ).toEqual(MUSEUM_CAMPAIGN.map((chapter) => chapter.id))
    expect(FLOATING_MUSEUM_JOURNEY.landmasses).toHaveLength(3)
    expect(FLOATING_MUSEUM_JOURNEY.stages).toHaveLength(4)
    expect(FLOATING_MUSEUM_JOURNEY.stages[0]!.islandId).toBe(
      FLOATING_MUSEUM_JOURNEY.stages[1]!.islandId,
    )
    expect(
      new Set(FLOATING_MUSEUM_JOURNEY.stages.map((stage) => stage.islandId)),
    ).toEqual(
      new Set(FLOATING_MUSEUM_JOURNEY.landmasses.map((island) => island.id)),
    )
    const [firstLight, twins, conservatory] = FLOATING_MUSEUM_JOURNEY.landmasses
    expect(firstLight!.position[0]).toBeLessThan(twins!.position[0])
    expect(twins!.position[0]).toBeLessThan(conservatory!.position[0])
    expect(firstLight!.position[2]).toBeGreaterThan(twins!.position[2])
    expect(twins!.position[2]).toBeGreaterThan(conservatory!.position[2])
    for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
      const labelClearance = Math.hypot(
        stage.position[0] - stage.architecturePosition[0],
        stage.position[2] - stage.architecturePosition[2],
      )
      expect(labelClearance).toBeGreaterThan(0.8)
    }
    for (const spillway of FLOATING_MUSEUM_JOURNEY.spillways) {
      const stage = FLOATING_MUSEUM_JOURNEY.stages.find(
        (candidate) => candidate.id === spillway.stageId,
      )!
      const island = FLOATING_MUSEUM_JOURNEY.landmasses.find(
        (candidate) => candidate.id === stage.islandId,
      )!
      const rimDistance = Math.hypot(
        spillway.position[0] - island.position[0],
        spillway.position[2] - island.position[2],
      )
      expect(rimDistance).toBeGreaterThan(1.25)
      expect(spillway.height).toBeGreaterThan(6)
      expect(spillway.basin).toBe(false)
    }
  })

  it('reports duplicate, unknown and omitted chapter references', () => {
    const invalid = {
      ...FLOATING_MUSEUM_JOURNEY,
      stages: [
        {
          ...FLOATING_MUSEUM_JOURNEY.stages[0]!,
          islandId: 'missing-landmass',
          chapterIds: ['first-light', 'first-light', 'missing'],
        },
      ],
      bridges: [
        {
          ...FLOATING_MUSEUM_JOURNEY.bridges[0]!,
          toStageId: 'missing-isle',
        },
      ],
      spillways: [
        {
          ...FLOATING_MUSEUM_JOURNEY.spillways[0]!,
          stageId: 'missing-isle',
        },
      ],
    }
    expect(validateMuseumJourney(invalid, MUSEUM_CAMPAIGN)).toEqual(
      expect.arrayContaining([
        'Journey chapter assigned twice: first-light',
        'Unknown journey landmass: missing-landmass',
        'Unknown journey chapter: missing',
        'Unknown bridge destination: missing-isle',
        'Unknown spillway stage: missing-isle',
        'Campaign chapter missing from journey: glassworks',
      ]),
    )
  })
})
