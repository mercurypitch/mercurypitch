// Procedural vessel fallbacks preserve a recipe's authored display envelope until its GLB arrives.

import type { BufferGeometry } from 'three'
import { BoxGeometry, LatheGeometry, Vector2 } from 'three'
import { PORTRAIT_EXHIBIT_ENVELOPE } from '../content/solid-props'
import { getBreakableRenderRecipe } from './catalog'

/** Fallbacks and authored GLBs share the same recipe-sized, floor-based envelope. */
function fitDisplayHeight(
  geometry: BufferGeometry,
  height: number,
): BufferGeometry {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!
  const scale = height / Math.max(0.001, bounds.max.y - bounds.min.y)
  geometry.translate(0, -bounds.min.y, 0)
  geometry.scale(scale, scale, scale)
  return geometry
}

export function createVesselGeometry(variant: string): BufferGeometry {
  const recipe = getBreakableRenderRecipe(variant)
  const shape = recipe.fallbackShape
  if (shape === 'slab') {
    const envelope = recipe.barrierEnvelope ?? PORTRAIT_EXHIBIT_ENVELOPE
    const geometry = new BoxGeometry(
      envelope.width,
      envelope.height,
      envelope.depth,
      6,
      8,
      1,
    )
    geometry.translate(0, envelope.height / 2, 0)
    return fitDisplayHeight(geometry, recipe.displayHeight)
  }
  const profile =
    shape === 'goblet'
      ? [
          [0, 0],
          [0.14, 0],
          [0.16, 0.025],
          [0.055, 0.05],
          [0.025, 0.09],
          [0.025, 0.3],
          [0.095, 0.33],
          [0.17, 0.4],
          [0.2, 0.53],
          [0.19, 0.66],
          [0.177, 0.66],
          [0.185, 0.53],
          [0.155, 0.41],
          [0.08, 0.35],
          [0, 0.34],
        ]
      : shape === 'fluted'
        ? [
            [0, 0],
            [0.12, 0],
            [0.17, 0.05],
            [0.13, 0.18],
            [0.11, 0.42],
            [0.13, 0.65],
            [0.19, 0.78],
            [0.173, 0.78],
            [0.115, 0.64],
            [0.095, 0.42],
            [0.115, 0.18],
            [0.15, 0.065],
            [0, 0.035],
          ]
        : [
            [0, 0],
            [0.11, 0],
            [0.19, 0.045],
            [0.25, 0.19],
            [0.235, 0.35],
            [0.15, 0.45],
            [0.085, 0.49],
            [0.085, 0.57],
            [0.11, 0.6],
            [0.092, 0.6],
            [0.07, 0.56],
            [0.07, 0.485],
            [0.135, 0.435],
            [0.218, 0.34],
            [0.232, 0.19],
            [0.17, 0.06],
            [0, 0.03],
          ]
  const geometry = new LatheGeometry(
    profile.map(([x, y]) => new Vector2(x, y)),
    48,
  )
  if (shape === 'fluted') {
    const attribute = geometry.getAttribute('position')
    for (let i = 0; i < attribute.count; i++) {
      const angle = Math.atan2(attribute.getX(i), attribute.getZ(i))
      const scale = 1 + Math.cos(angle * 12) * 0.055
      attribute.setX(i, attribute.getX(i) * scale)
      attribute.setZ(i, attribute.getZ(i) * scale)
    }
    geometry.computeVertexNormals()
  }
  return fitDisplayHeight(geometry, recipe.displayHeight)
}
