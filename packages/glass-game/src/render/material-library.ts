// ============================================================
// Imported material ownership — preserve authored channels without borrowing disposed GLTF resources.
// ============================================================

import type { Material, MeshPhysicalMaterial, Texture } from 'three'

export function createMaterialLibrary() {
  const copies = new Map<
    Material,
    Map<MeshPhysicalMaterial | undefined, Material>
  >()
  const textures = new Map<Texture, Texture>()
  const materials = new Set<Material>()
  return {
    materials,
    clone(source: Material, surface?: MeshPhysicalMaterial): Material {
      const variants =
        copies.get(source) ??
        new Map<MeshPhysicalMaterial | undefined, Material>()
      const previous = variants.get(surface)
      if (previous) return previous
      const copy = source.clone()
      const rendered = copy as MeshPhysicalMaterial
      if (surface && rendered.isMeshStandardMaterial) {
        rendered.color.copy(surface.color)
        rendered.roughness = surface.roughness
        rendered.metalness = surface.metalness
        rendered.normalScale.copy(surface.normalScale)
      }
      const properties = copy as unknown as Record<string, unknown>
      const channels = { ...source } as unknown as Record<string, unknown>
      for (const key of [
        'map',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'aoMap',
      ] as const)
        if (surface?.[key]) channels[key] = surface[key]
      for (const [key, value] of Object.entries(channels)) {
        const texture = value as Texture | null
        if (!texture?.isTexture) continue
        let owned = textures.get(texture)
        if (!owned) {
          owned = texture.clone()
          textures.set(texture, owned)
        }
        properties[key] = owned
      }
      variants.set(surface, copy)
      copies.set(source, variants)
      materials.add(copy)
      return copy
    },
    dispose() {
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
      materials.clear()
      textures.clear()
      copies.clear()
    },
  }
}

export type MaterialLibrary = ReturnType<typeof createMaterialLibrary>
