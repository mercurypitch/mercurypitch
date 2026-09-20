// Room decoration renderer — stable room-owned roots receive required catalogued art.

import type { Material, Mesh, MeshStandardMaterial, Object3D, Texture, } from 'three'
import { Group } from 'three'
import type { LevelDefinition, RoomDecorationInstanceDefinition, } from '../contracts'
import { getActiveSolidIds } from '../core/solid-activation'
import { disposeObject } from './dispose'
import { createKitInstance } from './kit-instance'
import type { MaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'
import type { RoomDecorationSurfaceRecipe } from './room-decoration-catalog'
import { getRoomDecorationRecipe } from './room-decoration-catalog'

export interface RoomDecorationRenderInstance {
  roomId: string
  root: Group
}

interface DecorationRecord {
  definition: RoomDecorationInstanceDefinition
  root: Group
  installed: boolean
}

/** Replacement materials own every explicit texture channel they expose. */
function cloneOwnedMaterial(
  source: Material,
  omitTextureKeys: ReadonlySet<string> = new Set(),
): Material {
  const clone = source.clone()
  const properties = clone as unknown as Record<string, unknown>
  const ownedTextures = new Map<Texture, Texture>()
  for (const [key, value] of Object.entries(source)) {
    const texture = value as Texture | null
    if (!texture?.isTexture) continue
    if (omitTextureKeys.has(key)) {
      properties[key] = null
      continue
    }
    const owned = ownedTextures.get(texture) ?? texture.clone()
    owned.needsUpdate = true
    ownedTextures.set(texture, owned)
    properties[key] = owned
  }
  return clone
}

function replaceSurface(
  art: Object3D,
  surface: RoomDecorationSurfaceRecipe,
  textures: ReadonlyMap<string, Texture>,
  materials: MuseumMaterials,
): void {
  let matches = 0
  art.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const replace = (material: Material): Material => {
      if (material.name !== surface.materialName) return material
      matches++
      if (surface.kind === 'mirror') {
        const mirror = cloneOwnedMaterial(
          materials[surface.materialId],
        ) as MeshStandardMaterial
        mirror.name = surface.materialName
        mirror.envMapIntensity = 1.15
        return mirror
      }
      const sourceTexture = textures.get(surface.textureAsset)
      if (sourceTexture === undefined)
        throw new Error(
          `Room decoration texture "${surface.textureAsset}" was not installed before its bundle.`,
        )
      const painting = cloneOwnedMaterial(
        material,
        new Set(['map']),
      ) as MeshStandardMaterial
      painting.name = surface.materialName
      painting.color.set(0xffffff)
      painting.map = sourceTexture.clone()
      painting.map.needsUpdate = true
      painting.metalness = 0
      painting.roughness = 0.44
      painting.transparent = false
      painting.opacity = 1
      painting.needsUpdate = true
      return painting
    }
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(replace)
      : replace(mesh.material)
  })
  if (matches === 0)
    throw new Error(
      `Room decoration could not find material "${surface.materialName}" in its authored node.`,
    )
}

/**
 * Empty instance roots are created synchronously so room visibility owns them
 * before any network asset resolves. Texture arguments become manager-owned.
 */
export function createRoomDecorations(
  level: LevelDefinition,
  materials: MuseumMaterials,
  materialLibrary: MaterialLibrary,
) {
  const textures = new Map<string, Texture>()
  const initialActiveSolidIds = new Set(
    getActiveSolidIds(level, new Set<string>()),
  )
  const records: DecorationRecord[] = (
    level.presentation?.decorations ?? []
  ).map((definition) => {
    const recipe = getRoomDecorationRecipe(definition.recipeId)
    const root = new Group()
    root.name = `decoration-${definition.id}`
    root.position.copy(definition.position)
    root.rotation.y = definition.yaw
    root.scale.setScalar(definition.scale * recipe.scale)
    const coveredSolidIds = definition.coveredSolidIds ?? []
    root.visible =
      coveredSolidIds.length === 0 ||
      coveredSolidIds.some((id) => initialActiveSolidIds.has(id))
    return { definition, root, installed: false }
  })

  return {
    instances: records.map(
      ({ definition, root }): RoomDecorationRenderInstance => ({
        roomId: definition.roomId,
        root,
      }),
    ),
    installTexture(assetId: string, texture: Texture): void {
      if (textures.has(assetId))
        throw new Error(
          `Room decoration texture "${assetId}" was installed more than once.`,
        )
      textures.set(assetId, texture)
    },
    installBundle(scene: Object3D, bundle: string): readonly string[] {
      const coveredSolidIds: string[] = []
      for (const record of records) {
        const recipe = getRoomDecorationRecipe(record.definition.recipeId)
        if (record.installed || recipe.bundle !== bundle) continue
        const source = scene.getObjectByName(recipe.node)
        if (source === undefined)
          throw new Error(
            `Room decoration recipe "${record.definition.recipeId}" could not find node "${recipe.node}" in bundle "${bundle}".`,
          )
        const art = createKitInstance(source, materials, {}, materialLibrary)
        try {
          if (recipe.surface !== undefined)
            replaceSurface(art, recipe.surface, textures, materials)
          art.name = `art-${record.definition.id}`
          record.root.add(art)
          record.installed = true
          coveredSolidIds.push(...(record.definition.coveredSolidIds ?? []))
        } catch (error) {
          disposeObject(art, materialLibrary.materials)
          throw error
        }
      }
      return coveredSolidIds
    },
    update(activeSolidIds: ReadonlySet<string>): void {
      for (const { definition, root } of records) {
        const coveredSolidIds = definition.coveredSolidIds ?? []
        root.visible =
          coveredSolidIds.length === 0 ||
          coveredSolidIds.some((id) => activeSolidIds.has(id))
      }
    },
    dispose(): void {
      textures.forEach((texture) => texture.dispose())
      textures.clear()
    },
  }
}

export type RoomDecorations = ReturnType<typeof createRoomDecorations>
