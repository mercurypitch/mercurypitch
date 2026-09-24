// ============================================================
// Adventure guidance tests — route state yields one useful instruction at a time.
// ============================================================

import { describe, expect, it } from 'vitest'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import { createGlassGame } from '../core/game'
import { deriveAdventureProgressGuidance } from './AdventureGuidance'

const level = GLASSWORKS_JOURNEY
const prefix = 'glassworks-journey/journey'
const required = {
  vestibule: level.breakables.find(
    (item) => item.id === `${prefix}/vestibule/encounter/vestibule-goblet`,
  )!,
  garden: level.breakables.find(
    (item) => item.id === `${prefix}/garden/encounter/garden-decanter`,
  )!,
  archive: level.breakables.find(
    (item) => item.id === `${prefix}/archive/encounter/archive-carafe`,
  )!,
  portrait: level.breakables.find(
    (item) => item.id === `${prefix}/portrait/encounter/portrait-finale`,
  )!,
}

describe('adventure progress guidance', () => {
  it('points a fresh visitor to the first required exhibit', () => {
    const snapshot = createGlassGame(level).snapshot()

    const guidance = deriveAdventureProgressGuidance(level, snapshot)

    expect(guidance).toEqual({
      kind: 'next',
      heading: `Next: ${required.vestibule.label}.`,
      detail: 'Follow its glowing circle, then tap Sing.',
    })
  })

  it('names the next required exhibit when a later one is still sealed', () => {
    const snapshot = {
      ...createGlassGame(level).snapshot(),
      nearbyLockedBreakableId: required.archive.id,
    }

    const guidance = deriveAdventureProgressGuidance(level, snapshot)

    expect(guidance).toEqual({
      kind: 'locked',
      heading: `${required.archive.label} is still sealed.`,
      detail: `Sing to ${required.vestibule.label.replace(/^The /, 'the ')} first.`,
    })
  })

  it('counts the dependency-closed route at a sealed exit', () => {
    const snapshot = {
      ...createGlassGame(level, {
        version: 2,
        levelId: level.id,
        checkpointId: level.spawn.checkpointId,
        completedBreakableIds: [
          required.vestibule.id,
          required.garden.id,
          required.archive.id,
        ],
        finished: false,
      }).snapshot(),
      nearLockedExit: true,
    }

    const guidance = deriveAdventureProgressGuidance(level, snapshot)

    expect(guidance).toEqual({
      kind: 'exit',
      heading: 'Exit sealed.',
      detail: `1 exhibit remains. Next: ${required.portrait.label}.`,
    })
  })

  it('does not cover an encounter that is already actionable', () => {
    const snapshot = {
      ...createGlassGame(level).snapshot(),
      nearbyBreakableId: required.vestibule.id,
    }

    const guidance = deriveAdventureProgressGuidance(level, snapshot)

    expect(guidance).toBeUndefined()
  })
})
