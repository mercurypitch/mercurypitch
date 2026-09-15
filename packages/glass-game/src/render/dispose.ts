// ============================================================
// Scene disposal — release each owned GPU resource once, including late loads.
// ============================================================

import type { Material, Mesh, Object3D, Texture } from 'three'

export function disposeObject(
  root: Object3D,
  borrowedMaterials: ReadonlySet<Material> = new Set(),
): void {
  const geometries = new Set<Mesh['geometry']>()
  const materials = new Set<Material>()
  root.traverse((object) => {
    const mesh = object as Mesh
    if (
      !mesh.isMesh &&
      (object as unknown as { isLine?: boolean }).isLine !== true
    )
      return
    geometries.add(mesh.geometry)
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      if (material === undefined || borrowedMaterials.has(material)) continue
      materials.add(material)
    }
  })
  geometries.forEach((geometry) => geometry.dispose())
  disposeMaterials(materials)
  root.removeFromParent()
}

/** Shared palettes may own textures that were never attached to a visible mesh. */
export function disposeMaterials(materials: Iterable<Material>): void {
  const unique = new Set(materials)
  const textures = new Set<Texture>()
  for (const material of unique)
    for (const value of Object.values(material))
      if ((value as Texture | null)?.isTexture) textures.add(value as Texture)
  unique.forEach((material) => material.dispose())
  textures.forEach((texture) => texture.dispose())
}
