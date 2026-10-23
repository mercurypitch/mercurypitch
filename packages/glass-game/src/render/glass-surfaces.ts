// Glass surfaces — which materials are glass, whether a mesh may cast a solid shadow, and the charge's glow on glass.
import type { Material, MeshStandardMaterial } from 'three'
import { Color, MeshPhysicalMaterial } from 'three'
import { isGlassMaterial } from './glass-material'

/** Three's transmission, or an owned glass look (whose transmission stays 0). */
export function isGlassSurface(material: Material): boolean {
  return (
    isGlassMaterial(material) ||
    (material instanceof MeshPhysicalMaterial && material.transmission > 0)
  )
}

/** Three's shadow map ignores transmission, so glass would throw a solid shadow. */
export function castsSolidShadow(
  material: Material | readonly Material[],
): boolean {
  const materials = Array.isArray(material) ? material : [material as Material]
  return !materials.some(isGlassSurface)
}

// The authored emissive radiance (colour times intensity) of each material, as first seen.
const authoredGlow = new WeakMap<MeshStandardMaterial, Color>()
const stressGlow = new Color()

/**
 * Adds the charge's glow to a glass surface's own emissive. A surface with no
 * authored glow takes the stress colour at the stress intensity, as before.
 */
export function applyStressGlow(
  material: MeshStandardMaterial,
  stressHex: number,
  intensity: number,
): void {
  let authored = authoredGlow.get(material)
  if (authored === undefined) {
    authored = material.emissive
      .clone()
      .multiplyScalar(material.emissiveIntensity)
    authoredGlow.set(material, authored)
  }
  if (authored.r === 0 && authored.g === 0 && authored.b === 0) {
    material.emissive.setHex(stressHex)
    material.emissiveIntensity = intensity
    return
  }
  material.emissive
    .copy(authored)
    .add(stressGlow.setHex(stressHex).multiplyScalar(intensity))
  material.emissiveIntensity = 1
}
