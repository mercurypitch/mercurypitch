// ============================================================
// Procedural court wings — tapered stone returns attach the existing wall to its court below the floor datum.
// ============================================================

import type { BufferGeometry } from 'three'
import { ExtrudeGeometry, Shape } from 'three'
import type { PlatformDefinition, SolidPropDefinition } from '../contracts'
import { CLOUDWAY_LAB_PLATFORM_RENDER_IDS } from './cloudway-laboratory-catalog'

type BoxSolid = Extract<SolidPropDefinition, { shape: 'box' }>

const EPSILON = 1e-5
const RETURN_DROP = 0.65

/** Only the generated court's persistent stone wings opt into this presentation. */
export function createProceduralCourtWingGeometry(
  solid: BoxSolid,
  platforms: readonly PlatformDefinition[],
): BufferGeometry | undefined {
  if (
    !/^barrier:.*:court-(?:left|right)-wing$/.test(solid.id) ||
    solid.presentation?.role !== 'wall' ||
    solid.presentation.material !== 'stone'
  )
    return undefined

  const alongX = solid.maxX - solid.minX > solid.maxZ - solid.minZ
  const min = alongX ? solid.minX : solid.minZ
  const max = alongX ? solid.maxX : solid.maxZ
  const crossMin = alongX ? solid.minZ : solid.minX
  const crossMax = alongX ? solid.maxZ : solid.maxX
  const center = (min + max) / 2
  const bottom = solid.top - solid.thickness
  const floor = platforms.find((platform) => {
    if (
      platform.renderId !== CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest ||
      platform.behavior !== undefined ||
      platform.activation !== undefined ||
      platform.unlockAfter !== undefined ||
      platform.parentPlatformId !== undefined ||
      platform.supportPolygon !== undefined ||
      Math.abs(platform.top - bottom) > EPSILON
    )
      return false
    const floorMin = alongX ? platform.minX : platform.minZ
    const floorMax = alongX ? platform.maxX : platform.maxZ
    const floorCrossMin = alongX ? platform.minZ : platform.minX
    const floorCrossMax = alongX ? platform.maxZ : platform.maxX
    // A return needs a real slab under the inner foot, across the whole wall
    // depth; it must never bridge a gap or enlarge a disconnected court.
    return (
      floorCrossMin <= crossMin + EPSILON &&
      floorCrossMax >= crossMax - EPSILON &&
      ((floorMin < min && floorMax > min && floorMax < center) ||
        (floorMax > max && floorMin < max && floorMin > center))
    )
  })
  if (floor === undefined) return undefined

  const floorMin = alongX ? floor.minX : floor.minZ
  const floorMax = alongX ? floor.maxX : floor.maxZ
  const sign = center > (floorMin + floorMax) / 2 ? 1 : -1
  const halfWidth = (max - min) / 2
  const halfHeight = solid.thickness / 2
  const depth = crossMax - crossMin
  const attachment = (sign > 0 ? floorMax : floorMin) - center
  const shape = new Shape()
  shape.moveTo(-sign * halfWidth, halfHeight)
  shape.lineTo(sign * halfWidth, halfHeight)
  shape.lineTo(sign * halfWidth, -halfHeight)
  shape.lineTo(attachment, -halfHeight - RETURN_DROP)
  shape.lineTo(-sign * halfWidth, -halfHeight - RETURN_DROP)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
  })
  geometry.translate(0, 0, -depth / 2)
  if (!alongX) geometry.rotateY(-Math.PI / 2)
  // One material keeps the cuboid and its return in the original wall draw.
  // Extrusion UVs keep continuous local-space stone across the return.
  geometry.clearGroups()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
