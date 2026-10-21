// Platform connectivity — actual convex floor footprints, not their broad-phase envelopes.
import type { PlatformDefinition, PointXZ } from '../contracts'

function outline(platform: PlatformDefinition): readonly PointXZ[] {
  return (
    platform.supportPolygon ?? [
      { x: platform.minX, z: platform.minZ },
      { x: platform.maxX, z: platform.minZ },
      { x: platform.maxX, z: platform.maxZ },
      { x: platform.minX, z: platform.maxZ },
    ]
  )
}

/** Separating-axis contact includes real shared edges without forgiving authored voids. */
export function platformFootprintsConnect(
  first: PlatformDefinition,
  second: PlatformDefinition,
  epsilon: number,
): boolean {
  if (
    first.maxX < second.minX - epsilon ||
    second.maxX < first.minX - epsilon ||
    first.maxZ < second.minZ - epsilon ||
    second.maxZ < first.minZ - epsilon
  )
    return false
  if (first.supportPolygon === undefined && second.supportPolygon === undefined)
    return true
  const a = outline(first)
  const b = outline(second)
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const start = polygon[i]
      const end = polygon[(i + 1) % polygon.length]
      const nx = -(end.z - start.z)
      const nz = end.x - start.x
      const length = Math.hypot(nx, nz)
      if (length <= epsilon) continue
      const project = (point: PointXZ) => (point.x * nx + point.z * nz) / length
      const firstProjection = a.map(project)
      const secondProjection = b.map(project)
      if (
        Math.max(...firstProjection) <
          Math.min(...secondProjection) - epsilon ||
        Math.max(...secondProjection) < Math.min(...firstProjection) - epsilon
      )
        return false
    }
  }
  return true
}
