// Room transforms — translation and cardinal yaw applied uniformly to authored data.

import type { Bounds3, BoundsXZ, PlatformRenderQuarterTurns, PlatformScrollAxis, Vec3, } from '../contracts'
import type { QuarterTurn, RoomPlacement } from './contracts'

const TAU = Math.PI * 2

export function assertSupportedRoomTransform(
  placement: RoomPlacement,
  path = `rooms.${placement.id}`,
): void {
  const raw = placement as RoomPlacement & Record<string, unknown>
  for (const unsupported of ['scale', 'rotation', 'pitch', 'roll', 'yaw'])
    if (raw[unsupported] !== undefined)
      throw new Error(
        `${path} uses unsupported ${unsupported}; only translation and yawQuarterTurns are supported.`,
      )
  if (
    ![
      placement.translate.x,
      placement.translate.y,
      placement.translate.z,
    ].every(Number.isFinite)
  )
    throw new Error(`${path}.translate must contain finite coordinates.`)
  if (![0, 1, 2, 3].includes(placement.yawQuarterTurns))
    throw new Error(`${path}.yawQuarterTurns must be one of 0, 1, 2 or 3.`)
}

export function normalizeYaw(yaw: number): number {
  const normalized = ((((yaw + Math.PI) % TAU) + TAU) % TAU) - Math.PI
  return Math.abs(normalized + Math.PI) < 1e-12 ? Math.PI : normalized
}

export function transformYaw(yaw: number, quarterTurns: QuarterTurn): number {
  return normalizeYaw(yaw + quarterTurns * (Math.PI / 2))
}

/** Maps a prefab-local scroll axis onto compiled world-aligned bounds. */
export function transformPlatformScrollAxis(
  axis: PlatformScrollAxis,
  quarterTurns: QuarterTurn,
): PlatformScrollAxis {
  return quarterTurns % 2 === 0 ? axis : axis === 'x' ? 'z' : 'x'
}

/** Carries prefab-local art orientation into the compiled world orientation. */
export function transformPlatformRenderQuarterTurns(
  renderQuarterTurns: PlatformRenderQuarterTurns | undefined,
  roomQuarterTurns: QuarterTurn,
): PlatformRenderQuarterTurns | undefined {
  if (renderQuarterTurns === undefined && roomQuarterTurns === 0)
    return undefined
  return (((renderQuarterTurns ?? 0) + roomQuarterTurns) %
    4) as PlatformRenderQuarterTurns
}

export function transformPoint(
  point: Vec3,
  placement: Pick<RoomPlacement, 'translate' | 'yawQuarterTurns'>,
): Vec3 {
  const { x, y, z } = point
  let rotatedX: number
  let rotatedZ: number
  switch (placement.yawQuarterTurns) {
    case 0:
      rotatedX = x
      rotatedZ = z
      break
    case 1:
      rotatedX = z
      rotatedZ = -x
      break
    case 2:
      rotatedX = -x
      rotatedZ = -z
      break
    case 3:
      rotatedX = -z
      rotatedZ = x
      break
  }
  return {
    x: rotatedX + placement.translate.x,
    y: y + placement.translate.y,
    z: rotatedZ + placement.translate.z,
  }
}

export function transformBoundsXZ(
  bounds: BoundsXZ,
  placement: Pick<RoomPlacement, 'translate' | 'yawQuarterTurns'>,
): BoundsXZ {
  const corners = [
    transformPoint({ x: bounds.minX, y: 0, z: bounds.minZ }, placement),
    transformPoint({ x: bounds.minX, y: 0, z: bounds.maxZ }, placement),
    transformPoint({ x: bounds.maxX, y: 0, z: bounds.minZ }, placement),
    transformPoint({ x: bounds.maxX, y: 0, z: bounds.maxZ }, placement),
  ]
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minZ: Math.min(...corners.map((point) => point.z)),
    maxZ: Math.max(...corners.map((point) => point.z)),
  }
}

export function transformBounds3(
  bounds: Bounds3,
  placement: Pick<RoomPlacement, 'translate' | 'yawQuarterTurns'>,
): Bounds3 {
  return {
    ...transformBoundsXZ(bounds, placement),
    minY: bounds.minY + placement.translate.y,
    maxY: bounds.maxY + placement.translate.y,
  }
}
