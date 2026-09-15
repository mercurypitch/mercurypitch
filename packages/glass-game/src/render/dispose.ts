// ============================================================
// Scene disposal — release each owned GPU resource once, including late loads.
// ============================================================

import type { Material, Mesh, Object3D, Texture } from 'three'

export function disposeObject(root: Object3D): void {
  const geometries = new Set<Mesh['geometry']>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
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
      if (material === undefined) continue
      materials.add(material)
      for (const value of Object.values(material)) {
        if ((value as Texture | null)?.isTexture) textures.add(value as Texture)
      }
    }
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => texture.dispose())
  root.removeFromParent()
}
