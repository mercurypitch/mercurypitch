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
    for (const spillway of FLOATING_MUSEUM_JOURNEY.spillways) {
      const stage = FLOATING_MUSEUM_JOURNEY.stages.find(
        (candidate) => candidate.id === spillway.stageId,
      )!
      const rimDistance = Math.hypot(
        spillway.position[0] - stage.position[0],
        spillway.position[2] - stage.position[2],
      )
      expect(rimDistance).toBeGreaterThan(2.25)
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
        'Unknown journey chapter: missing',
        'Unknown bridge destination: missing-isle',
        'Unknown spillway stage: missing-isle',
        'Campaign chapter missing from journey: glassworks',
      ]),
    )
  })
})
