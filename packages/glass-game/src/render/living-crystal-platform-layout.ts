// Living-crystal platform layout — validate exact contacts and rectangular multi-deck support unions.

import { LIVING_CRYSTAL_PLATFORM_RENDER_ID, LIVING_CRYSTAL_PLATFORM_SUPPORT, } from '../content/living-crystal-profile'
import type { LevelDefinition, LivingCrystalInteriorTuningDefinition, LivingCrystalSupportPresentationDefinition, PlatformDefinition, PlatformRenderQuarterTurns, } from '../contracts'
import { PLATFORM_RENDER_QUARTER_TURNS } from '../contracts'

const EPSILON = 1e-6
const MAXIMUM_APRON_PER_SIDE = 0.25

export interface LivingCrystalPlatformPlacement {
  /** A legacy platform ID or the authored grouped-support ID. */
  readonly platformId: string
  readonly coveredPlatformIds: readonly string[]
  readonly roomId?: string
  readonly position: {
    readonly x: number
    readonly y: number
    readonly z: number
  }
  readonly rotationY: number
  readonly turns: PlatformRenderQuarterTurns
  readonly contactWidth: number
  readonly contactDepth: number
  readonly interior: LivingCrystalInteriorTuningDefinition
}

function fail(detail: string): never {
  throw new Error(`Living-crystal platform layout: ${detail}`)
}

function close(left: number, right: number): boolean {
  return Number.isFinite(left) && Math.abs(left - right) <= EPSILON
}

function stableMetres(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000
}

function validateResponse(
  level: LevelDefinition,
  id: string,
  interior: LivingCrystalInteriorTuningDefinition,
): void {
  if (interior.effect === 'pearl-current') {
    if (interior.responseExhibitId === undefined)
      fail(`support "${id}" pearl-current effect has no response exhibit.`)
    if (
      !level.breakables.some(
        (target) => target.id === interior.responseExhibitId,
      )
    )
      fail(
        `support "${id}" pearl-current effect references missing exhibit "${interior.responseExhibitId}".`,
      )
  } else if (interior.responseExhibitId !== undefined) {
    fail(
      `support "${id}" has a response exhibit without a pearl-current effect.`,
    )
  }
}

function validateStaticDeck(
  platform: PlatformDefinition,
  ownerId: string,
): void {
  if (
    platform.kind !== 'deck' ||
    platform.parentPlatformId !== undefined ||
    platform.activation !== undefined ||
    platform.unlockAfter !== undefined ||
    platform.behavior !== undefined ||
    platform.catchCheckpointId !== undefined ||
    platform.supportPolygon !== undefined
  )
    fail(
      `support "${ownerId}" platform "${platform.id}" must be an always-active static deck with rectangular contact.`,
    )
}

function resolveGroupedPlacement(
  level: LevelDefinition,
  support: LivingCrystalSupportPresentationDefinition,
  platformsById: ReadonlyMap<string, PlatformDefinition>,
): LivingCrystalPlatformPlacement {
  if (support.coveredPlatformIds.length === 0)
    fail(`support "${support.id}" must cover at least one platform.`)
  if (
    level.presentation?.rooms.some((room) => room.id === support.roomId) !==
    true
  )
    fail(`support "${support.id}" references missing room "${support.roomId}".`)
  validateResponse(level, support.id, support)

  const localIds = new Set<string>()
  const platforms = support.coveredPlatformIds.map((id) => {
    if (localIds.has(id))
      fail(`support "${support.id}" repeats platform "${id}".`)
    localIds.add(id)
    const platform = platformsById.get(id)
    if (platform === undefined)
      fail(`support "${support.id}" references missing platform "${id}".`)
    validateStaticDeck(platform, support.id)
    return platform
  })
  const top = platforms[0]!.top
  if (platforms.some((platform) => !close(platform.top, top)))
    fail(`support "${support.id}" platforms must share one top plane.`)

  let area = 0
  for (const [index, platform] of platforms.entries()) {
    const width = platform.maxX - platform.minX
    const depth = platform.maxZ - platform.minZ
    if (!(width > EPSILON && depth > EPSILON))
      fail(`support "${support.id}" platform "${platform.id}" has no area.`)
    area += width * depth
    for (const other of platforms.slice(index + 1)) {
      const overlapWidth =
        Math.min(platform.maxX, other.maxX) -
        Math.max(platform.minX, other.minX)
      const overlapDepth =
        Math.min(platform.maxZ, other.maxZ) -
        Math.max(platform.minZ, other.minZ)
      if (overlapWidth > EPSILON && overlapDepth > EPSILON)
        fail(
          `support "${support.id}" platforms "${platform.id}" and "${other.id}" overlap.`,
        )
    }
  }
  const minX = Math.min(...platforms.map((platform) => platform.minX))
  const maxX = Math.max(...platforms.map((platform) => platform.maxX))
  const minZ = Math.min(...platforms.map((platform) => platform.minZ))
  const maxZ = Math.max(...platforms.map((platform) => platform.maxZ))
  const contactWidth = maxX - minX
  const contactDepth = maxZ - minZ
  if (!close(area, contactWidth * contactDepth))
    fail(`support "${support.id}" platforms must form one gap-free rectangle.`)

  const candidates = ([0, 1] as const).filter((turns) => {
    const donorWidth =
      turns === 0
        ? LIVING_CRYSTAL_PLATFORM_SUPPORT.width
        : LIVING_CRYSTAL_PLATFORM_SUPPORT.depth
    const donorDepth =
      turns === 0
        ? LIVING_CRYSTAL_PLATFORM_SUPPORT.depth
        : LIVING_CRYSTAL_PLATFORM_SUPPORT.width
    const marginX = (contactWidth - donorWidth) / 2
    const marginZ = (contactDepth - donorDepth) / 2
    return (
      marginX >= -EPSILON &&
      marginZ >= -EPSILON &&
      marginX <= MAXIMUM_APRON_PER_SIDE + EPSILON &&
      marginZ <= MAXIMUM_APRON_PER_SIDE + EPSILON
    )
  })
  if (candidates.length === 0)
    fail(
      `support "${support.id}" cannot contain the living-crystal donor with at most ${MAXIMUM_APRON_PER_SIDE} m apron per side.`,
    )
  if (candidates.length !== 1)
    fail(`support "${support.id}" has an ambiguous donor orientation.`)
  const turns = candidates[0]!
  return {
    platformId: support.id,
    coveredPlatformIds: [...support.coveredPlatformIds],
    roomId: support.roomId,
    position: {
      x: stableMetres((minX + maxX) / 2),
      y: stableMetres(top),
      z: stableMetres((minZ + maxZ) / 2),
    },
    rotationY: turns * (Math.PI / 2),
    turns,
    contactWidth: stableMetres(contactWidth),
    contactDepth: stableMetres(contactDepth),
    interior: support,
  }
}

export function resolveLivingCrystalPlatformPlacements(
  level: LevelDefinition,
): readonly LivingCrystalPlatformPlacement[] {
  const platforms = level.platforms.filter(
    (platform) => platform.renderId === LIVING_CRYSTAL_PLATFORM_RENDER_ID,
  )
  const presentations = level.presentation?.livingCrystalInteriors ?? []
  const supports = level.presentation?.livingCrystalSupports ?? []
  if (platforms.length === 0 && presentations.length > 0)
    fail('interior presentations exist without a living-crystal platform.')

  const platformsById = new Map(
    level.platforms.map((platform) => [platform.id, platform] as const),
  )
  const claimedPlatformIds = new Set<string>()
  const supportIds = new Set<string>()
  const grouped = supports.map((support) => {
    if (supportIds.has(support.id))
      fail(`support "${support.id}" has duplicate grouped settings.`)
    supportIds.add(support.id)
    const placement = resolveGroupedPlacement(level, support, platformsById)
    for (const id of placement.coveredPlatformIds) {
      if (claimedPlatformIds.has(id))
        fail(`platform "${id}" is shared by multiple living-crystal supports.`)
      claimedPlatformIds.add(id)
    }
    return placement
  })

  const byPlatform = new Map<string, (typeof presentations)[number]>()
  for (const interior of presentations) {
    if (byPlatform.has(interior.platformId))
      fail(`platform "${interior.platformId}" has duplicate interior settings.`)
    byPlatform.set(interior.platformId, interior)
  }
  const legacy = platforms.map((platform) => {
    if (claimedPlatformIds.has(platform.id))
      fail(
        `platform "${platform.id}" is shared by multiple living-crystal supports.`,
      )
    claimedPlatformIds.add(platform.id)
    validateStaticDeck(platform, platform.id)
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
    validateResponse(level, platform.id, interior)
    byPlatform.delete(platform.id)
    return {
      platformId: platform.id,
      coveredPlatformIds: [platform.id],
      position: {
        x: (platform.minX + platform.maxX) / 2,
        y: platform.top - LIVING_CRYSTAL_PLATFORM_SUPPORT.topY,
        z: (platform.minZ + platform.maxZ) / 2,
      },
      rotationY: turns * (Math.PI / 2),
      turns,
      contactWidth: expectedWidth,
      contactDepth: expectedDepth,
      interior,
    } satisfies LivingCrystalPlatformPlacement
  })
  if (byPlatform.size > 0)
    fail(
      `orphan interior presentations: ${[...byPlatform.keys()].sort().join(', ')}.`,
    )
  return [...legacy, ...grouped]
}
