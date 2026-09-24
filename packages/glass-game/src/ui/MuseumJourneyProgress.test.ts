// Museum journey projection tests — completion never invents a star or portrait.

import { describe, expect, it } from 'vitest'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import { projectMuseumJourneyChapter } from './MuseumJourneyProgress'

const chapter = MUSEUM_CAMPAIGN.find((item) => item.id === 'glassworks')!
const finalEncounter = chapter.level.rewards!.grading[0]!.encounterId

describe('museum journey progress projection', () => {
  it('migrates an old completed portrait while leaving singing quality absent', () => {
    const view = projectMuseumJourneyChapter(
      chapter,
      'glassworks-isle',
      {
        version: 1,
        levelId: chapter.level.id,
        checkpointId: chapter.level.spawn.checkpointId,
        completedBreakableIds: chapter.level.breakables
          .filter((item) => !item.optional)
          .map((item) => item.id),
        finished: true,
      },
      (id) => `/assets/${id}`,
    )

    expect(view.action).toBe('Replay')
    expect(view.stars).toBeUndefined()
    expect(view.notGraded).toBe(false)
    expect(view.portrait).toEqual({
      title: 'She Who Woke the Glass',
      imageUrl: '/assets/painting-portrait-v5',
    })
  })

  it('shows only the saved grade and identifies an earlier policy edition', () => {
    const view = projectMuseumJourneyChapter(
      chapter,
      'glassworks-isle',
      {
        version: 2,
        levelId: chapter.level.id,
        checkpointId: chapter.level.spawn.checkpointId,
        completedBreakableIds: [],
        finished: false,
        rewards: {
          version: 1,
          discoveredEncounterIds: [],
          collectedCoinIds: [],
          collectedPortraitIds: [],
          qualityResults: [
            {
              encounterId: finalEncounter,
              grade: 2,
              challengeRevision: 1,
              policyRevision: 99,
              contentRevision: 1,
              evidenceVersion: 'pitch-accuracy-v1',
              reliableSeconds: 1.5,
              meanAbsoluteCents: 48,
            },
          ],
        },
      },
      (id) => id,
    )
    expect(view.stars).toBe(2)
    expect(view.historicalGrade).toBe(true)
    expect(view.portrait).toBeUndefined()
  })

  it('keeps an insufficient-evidence save explicitly ungraded', () => {
    const view = projectMuseumJourneyChapter(
      chapter,
      'glassworks-isle',
      {
        version: 2,
        levelId: chapter.level.id,
        checkpointId: chapter.level.spawn.checkpointId,
        completedBreakableIds: [],
        finished: false,
        rewards: {
          version: 1,
          discoveredEncounterIds: [],
          collectedCoinIds: [],
          collectedPortraitIds: [],
          qualityResults: [
            {
              encounterId: finalEncounter,
              grade: 'not-graded',
              challengeRevision: 1,
              policyRevision: 1,
              contentRevision: 1,
              evidenceVersion: 'pitch-accuracy-v1',
              reliableSeconds: 0.3,
            },
          ],
        },
      },
      (id) => id,
    )

    expect(view.stars).toBeUndefined()
    expect(view.notGraded).toBe(true)
  })
})
