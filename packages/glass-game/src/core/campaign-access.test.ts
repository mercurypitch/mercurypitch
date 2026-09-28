// Campaign access regression tests — previews bypass locks, never completion or earned stars.
import { describe, expect, it } from 'vitest'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import type { SavedProgress } from '../contracts'
import { campaignChapterAccess } from './campaign-access'

function complete(index: number): SavedProgress {
  const level = MUSEUM_CAMPAIGN[index]!.level
  return {
    version: 2,
    levelId: level.id,
    checkpointId: level.spawn.checkpointId ?? '',
    completedBreakableIds: level.breakables.map((item) => item.id),
    finished: true,
  }
}

describe('campaign sequential access', () => {
  it('starts with only the prologue available', () => {
    expect(
      campaignChapterAccess('first-light', MUSEUM_CAMPAIGN, () => null),
    ).toEqual({ unlocked: true })
    for (const chapter of MUSEUM_CAMPAIGN.slice(1))
      expect(
        campaignChapterAccess(chapter.id, MUSEUM_CAMPAIGN, () => null),
      ).toMatchObject({
        unlocked: false,
        blockedBy: { chapterId: 'first-light' },
      })
  })

  it('opens exactly the next chapter after a valid completed visit', () => {
    const saved = new Map([[complete(0).levelId, complete(0)]])
    const load = (id: string) => saved.get(id)
    expect(
      campaignChapterAccess('glassworks', MUSEUM_CAMPAIGN, load).unlocked,
    ).toBe(true)
    expect(
      campaignChapterAccess('twin-galleries', MUSEUM_CAMPAIGN, load),
    ).toMatchObject({ unlocked: false, blockedBy: { chapterId: 'glassworks' } })
    saved.set(complete(1).levelId, complete(1))
    expect(
      campaignChapterAccess('twin-galleries', MUSEUM_CAMPAIGN, load).unlocked,
    ).toBe(true)
  })

  it('does not trust a finished flag when required exhibits are missing', () => {
    const incomplete = { ...complete(0), completedBreakableIds: [] }
    expect(
      campaignChapterAccess('glassworks', MUSEUM_CAMPAIGN, () => incomplete)
        .unlocked,
    ).toBe(false)
  })

  it('checks the entire earlier route rather than only the preceding gallery', () => {
    const saved = complete(2)
    expect(
      campaignChapterAccess('resonance-conservatory', MUSEUM_CAMPAIGN, (id) =>
        id === saved.levelId ? saved : null,
      ),
    ).toMatchObject({
      unlocked: false,
      blockedBy: { chapterId: 'first-light' },
    })
  })

  it('unlocks every known preview without loading or changing saved progress', () => {
    for (const chapter of MUSEUM_CAMPAIGN)
      expect(
        campaignChapterAccess(
          chapter.id,
          MUSEUM_CAMPAIGN,
          () => {
            throw new Error(
              'Preview unlock must not read or fabricate progress',
            )
          },
          true,
        ),
      ).toEqual({ unlocked: true })
  })

  it('fails closed for unknown routes even in development', () => {
    expect(
      campaignChapterAccess('unknown', MUSEUM_CAMPAIGN, () => null, true),
    ).toEqual({ unlocked: false })
    expect(campaignChapterAccess('first-light', [], () => null)).toEqual({
      unlocked: false,
    })
  })
})
