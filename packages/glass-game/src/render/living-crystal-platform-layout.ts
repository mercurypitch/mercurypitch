// Living-crystal platform layout — validate static box contact and bind each placement to one authored interior palette.

import { LIVING_CRYSTAL_PLATFORM_RENDER_ID, LIVING_CRYSTAL_PLATFORM_SUPPORT, } from '../content/living-crystal-profile'
import type { LevelDefinition, LivingCrystalInteriorPresentationDefinition, PlatformRenderQuarterTurns, } from '../contracts'
import { PLATFORM_RENDER_QUARTER_TURNS } from '../contracts'

const EPSILON = 1e-6

export interface LivingCrystalPlatformPlacement {
  readonly platformId: string
  readonly position: {
    readonly x: number
    readonly y: number
    readonly z: number
  }
  readonly rotationY: number
  readonly turns: PlatformRenderQuarterTurns
  readonly interior: LivingCrystalInteriorPresentationDefinition
}

function fail(detail: string): never {
  throw new Error(`Living-crystal platform layout: ${detail}`)
}

function close(left: number, right: number): boolean {
  return Number.isFinite(left) && Math.abs(left - right) <= EPSILON
}

export function resolveLivingCrystalPlatformPlacements(
  level: LevelDefinition,
): readonly LivingCrystalPlatformPlacement[] {
  const platforms = level.platforms.filter(
    (platform) => platform.renderId === LIVING_CRYSTAL_PLATFORM_RENDER_ID,
  )
  const presentations = level.presentation?.livingCrystalInteriors ?? []
  if (platforms.length === 0) {
    if (presentations.length > 0)
      fail('interior presentations exist without a living-crystal platform.')
    return []
  }
  const byPlatform = new Map<
    string,
    LivingCrystalInteriorPresentationDefinition
  >()
  for (const interior of presentations) {
    if (byPlatform.has(interior.platformId))
      fail(`platform "${interior.platformId}" has duplicate interior settings.`)
    byPlatform.set(interior.platformId, interior)
  }
  const placements = platforms.map((platform) => {
    if (
      platform.kind !== 'deck' ||
      platform.parentPlatformId !== undefined ||
      platform.activation !== undefined ||
      platform.unlockAfter !== undefined ||
      platform.behavior !== undefined ||
      platform.catchCheckpointId !== undefined
    )
      fail(`platform "${platform.id}" must be an always-active static deck.`)
    const turns = platform.renderQuarterTurns ?? 0
    if (!PLATFORM_RENDER_QUARTER_TURNS.includes(turns))
      fail(`platform "${platform.id}" has invalid renderQuarterTurns.`)
    const expectedWidth =
      turns % 2 === 0
        ? LIVING_CRYSTAL_PLATFORM_SUPPORT.width
        : LIVING_CRYSTAL_PLATFORM_SUPPORT.depth
    const expectedDepth =
      turns % 2 === 0
        ? LIVING_CRYSTAL_PLATFORM_SUPPORT.depth
        : LIVING_CRYSTAL_PLATFORM_SUPPORT.width
    if (
      !close(platform.maxX - platform.minX, expectedWidth) ||
      !close(platform.maxZ - platform.minZ, expectedDepth) ||
      !close(platform.thickness, LIVING_CRYSTAL_PLATFORM_SUPPORT.height)
    )
      fail(
        `platform "${platform.id}" must match the rotated ${expectedWidth} × ${expectedDepth} × ${LIVING_CRYSTAL_PLATFORM_SUPPORT.height} m support.`,
      )
    const interior = byPlatform.get(platform.id)
    if (interior === undefined)
      fail(`platform "${platform.id}" has no interior presentation.`)
    if (interior.effect === 'pearl-current') {
      if (interior.responseExhibitId === undefined)
        fail(
          `platform "${platform.id}" pearl-current effect has no response exhibit.`,
        )
      if (
        !level.breakables.some(
          (target) => target.id === interior.responseExhibitId,
        )
      )
        fail(
          `platform "${platform.id}" pearl-current effect references missing exhibit "${interior.responseExhibitId}".`,
        )
    } else if (interior.responseExhibitId !== undefined) {
      fail(
        `platform "${platform.id}" has a response exhibit without a pearl-current effect.`,
      )
    }
    byPlatform.delete(platform.id)
    return {
      platformId: platform.id,
      position: {
        x: (platform.minX + platform.maxX) / 2,
        y: platform.top - LIVING_CRYSTAL_PLATFORM_SUPPORT.topY,
        z: (platform.minZ + platform.maxZ) / 2,
      },
      rotationY: turns * (Math.PI / 2),
      turns,
      interior,
    }
  })
  if (byPlatform.size > 0)
    fail(
      `orphan interior presentations: ${[...byPlatform.keys()].sort().join(', ')}.`,
    )
  return placements
}
