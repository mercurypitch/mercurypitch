// Quarter-turn platform layout — bind the two authored contact boxes to one translated, cardinal visual.

import { PEARL_QUARTER_TURN_RENDER_ID, PEARL_QUARTER_TURN_SUPPORT, } from '../content/pearl-quarter-turn-profile'
import type { PlatformDefinition, PlatformRenderQuarterTurns, Vec3, } from '../contracts'
import { PLATFORM_RENDER_QUARTER_TURNS } from '../contracts'

const EPSILON = 1e-6

export interface PearlQuarterTurnPlacement {
  readonly platformIds: readonly [string, string]
  readonly publicPlatformId: string
  readonly position: Vec3
  readonly rotationY: number
  readonly turns: PlatformRenderQuarterTurns
}

function fail(detail: string): never {
  throw new Error(`Pearl quarter-turn layout: ${detail}`)
}

function rotateXZ(
  x: number,
  z: number,
  turns: PlatformRenderQuarterTurns,
): readonly [number, number] {
  switch (turns) {
    case 0:
      return [x, z]
    case 1:
      return [z, -x]
    case 2:
      return [-x, -z]
    case 3:
      return [-z, x]
  }
}

function expectedBounds(
  box: (typeof PEARL_QUARTER_TURN_SUPPORT.boxes)[number],
  turns: PlatformRenderQuarterTurns,
  offsetX: number,
  offsetZ: number,
) {
  const [centerX, centerZ] = rotateXZ(box.centre[0], box.centre[2], turns)
  const width = turns % 2 === 0 ? box.size[0] : box.size[2]
  const depth = turns % 2 === 0 ? box.size[2] : box.size[0]
  return {
    minX: centerX + offsetX - width / 2,
    maxX: centerX + offsetX + width / 2,
    minZ: centerZ + offsetZ - depth / 2,
    maxZ: centerZ + offsetZ + depth / 2,
  }
}

function close(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON
}

function clean(value: number): number {
  return Math.abs(value) <= EPSILON ? 0 : value
}

function assertContact(
  platform: PlatformDefinition,
  expected: ReturnType<typeof expectedBounds>,
): void {
  if (
    !close(platform.minX, expected.minX) ||
    !close(platform.maxX, expected.maxX) ||
    !close(platform.minZ, expected.minZ) ||
    !close(platform.maxZ, expected.maxZ) ||
    !close(platform.thickness, PEARL_QUARTER_TURN_SUPPORT.thickness)
  )
    fail(`platform "${platform.id}" does not match its measured union box.`)
}

function resolveCompound(
  root: PlatformDefinition,
  child: PlatformDefinition,
): PearlQuarterTurnPlacement {
  for (const part of [root, child]) {
    if (
      part.kind !== 'deck' ||
      part.activation !== undefined ||
      part.unlockAfter !== undefined ||
      part.behavior !== undefined ||
      part.catchCheckpointId !== undefined
    )
      fail(
        `platform "${part.id}" must be an always-active static deck; compound animation and independent activation are unsupported.`,
      )
  }
  const turns = root.renderQuarterTurns ?? 0
  if (!PLATFORM_RENDER_QUARTER_TURNS.includes(turns))
    fail(`platform "${root.id}" has invalid renderQuarterTurns.`)
  if ((child.renderQuarterTurns ?? 0) !== turns)
    fail('both compound parts must use the same renderQuarterTurns.')
  if (!close(child.top, root.top))
    fail('both compound parts must share one top.')

  const canonicalRoot = PEARL_QUARTER_TURN_SUPPORT.boxes[0]
  const [rootCenterX, rootCenterZ] = rotateXZ(
    canonicalRoot.centre[0],
    canonicalRoot.centre[2],
    turns,
  )
  const offsetX = (root.minX + root.maxX) / 2 - rootCenterX
  const offsetZ = (root.minZ + root.maxZ) / 2 - rootCenterZ
  assertContact(root, expectedBounds(canonicalRoot, turns, offsetX, offsetZ))
  assertContact(
    child,
    expectedBounds(
      PEARL_QUARTER_TURN_SUPPORT.boxes[1],
      turns,
      offsetX,
      offsetZ,
    ),
  )
  return {
    platformIds: [root.id, child.id],
    publicPlatformId: root.id,
    position: {
      x: clean(offsetX),
      y: root.top - PEARL_QUARTER_TURN_SUPPORT.topY,
      z: clean(offsetZ),
    },
    rotationY: turns * (Math.PI / 2),
    turns,
  }
}

export function resolvePearlQuarterTurnPlacements(
  platforms: readonly PlatformDefinition[],
): readonly PearlQuarterTurnPlacement[] {
  const candidates = platforms.filter(
    (platform) => platform.renderId === PEARL_QUARTER_TURN_RENDER_ID,
  )
  if (candidates.length === 0) return []
  const roots = candidates.filter(
    (platform) => platform.parentPlatformId === undefined,
  )
  const consumed = new Set<string>()
  const placements = roots.map((root) => {
    const children = candidates.filter(
      (platform) => platform.parentPlatformId === root.id,
    )
    if (children.length !== 1)
      fail(
        `platform "${root.id}" must own exactly one Z arm; found ${children.length}.`,
      )
    consumed.add(root.id)
    consumed.add(children[0]!.id)
    return resolveCompound(root, children[0]!)
  })
  if (consumed.size !== candidates.length) {
    const orphanIds = candidates
      .filter((platform) => !consumed.has(platform.id))
      .map((platform) => platform.id)
    fail(`orphan compound parts: ${orphanIds.join(', ')}.`)
  }
  return placements
}
