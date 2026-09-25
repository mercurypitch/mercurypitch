// ============================================================
// Break outcome tests — narration follows real access transitions, not requiredness.
// ============================================================

import { describe, expect, it } from 'vitest'
import { CLOUDWAY_GLASS_RIBBON } from '../content/cloudway-trial'
import { GLASSWORKS } from '../content/glassworks'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import { deriveBreakOutcome } from './break-outcome'

describe('break outcome', () => {
  it('keeps Cloudway progression neutral until the exit actually opens', () => {
    const [arrival, crossing, finale] =
      CLOUDWAY_GLASS_RIBBON.exit.requiresCompleted

    expect(
      deriveBreakOutcome(CLOUDWAY_GLASS_RIBBON, new Set(), new Set([arrival])),
    ).toBe('celebration')
    expect(
      deriveBreakOutcome(
        CLOUDWAY_GLASS_RIBBON,
        new Set([arrival]),
        new Set([arrival, crossing]),
      ),
    ).toBe('celebration')
    expect(
      deriveBreakOutcome(
        CLOUDWAY_GLASS_RIBBON,
        new Set([arrival, crossing]),
        new Set([arrival, crossing, finale]),
      ),
    ).toBe('exit-opened')
  })

  it('recognizes a newly active legacy bridge as an opened path', () => {
    const bridgeEncounter = GLASSWORKS.platforms.find(
      (platform) => platform.unlockAfter !== undefined,
    )?.unlockAfter
    expect(bridgeEncounter).toBeDefined()

    expect(
      deriveBreakOutcome(GLASSWORKS, new Set(), new Set([bridgeEncounter!])),
    ).toBe('path-opened')
  })

  it('keeps the museum gate outcome when the same break also opens the exit', () => {
    const finale = GLASSWORKS_JOURNEY.exit.requiresCompleted[0]
    const completedBefore = new Set(
      GLASSWORKS_JOURNEY.breakables
        .filter((item) => item.id !== finale && !item.optional)
        .map((item) => item.id),
    )

    expect(
      deriveBreakOutcome(
        GLASSWORKS_JOURNEY,
        completedBefore,
        new Set([...completedBefore, finale]),
      ),
    ).toBe('path-opened')
  })
})
