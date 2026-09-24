// Room decoration renderer — stable room-owned roots receive required catalogued art.

import type { Material, Mesh, MeshStandardMaterial, Object3D, Texture, } from 'three'
import { Group } from 'three'
import type { LevelDefinition, RoomDecorationInstanceDefinition, } from '../contracts'
import { getActiveSolidIds } from '../core/solid-activation'
import { disposeMaterials, disposeObject } from './dispose'
import { createKitInstance, removeKitGeometry } from './kit-instance'
import type { MaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'
import type { PlanarMirrorSurface } from './planar-reflections'
import { createPlanarMirrorSurface } from './planar-reflections'
import type { RoomDecorationSurfaceRecipe } from './room-decoration-catalog'
import { getRoomDecorationRecipe } from './room-decoration-catalog'
import { createStaticDecorationBatch } from './static-decoration-batch'

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
): readonly PlanarMirrorSurface[] {
  let matches = 0
  const planarMirrors: PlanarMirrorSurface[] = []
  art.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    if (surface.kind === 'mirror') {
      let planarMirror: PlanarMirrorSurface | undefined
      const replace = (material: Material): Material => {
        if (material.name !== surface.materialName) return material
        matches++
        if (planarMirror === undefined) {
          const fallback = cloneOwnedMaterial(
            materials[surface.materialId],
          ) as MeshStandardMaterial
          fallback.name = surface.materialName
          fallback.envMapIntensity = 1.15
          try {
            planarMirror = createPlanarMirrorSurface(
              mesh,
              materials[surface.materialId].color,
              fallback,
            )
          } catch (error) {
            disposeMaterials([fallback])
            throw error
          }
        }
        return planarMirror.material
      }
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(replace)
        : replace(mesh.material)
      if (planarMirror !== undefined) planarMirrors.push(planarMirror)
      return
    }
    const replace = (material: Material): Material => {
      if (material.name !== surface.materialName) return material
      matches++
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
  return planarMirrors
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
  const planarMirrors: PlanarMirrorSurface[] = []
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
  // Keep every room as an independent visibility owner. Unique paintings and
  // live reflection surfaces retain their own material/picking lifecycle.
  const repeated = new Map<string, DecorationRecord[]>()
  for (const record of records) {
    if (getRoomDecorationRecipe(record.definition.recipeId).surface) continue
    const key = `${record.definition.roomId}:${record.definition.recipeId}`
    const members = repeated.get(key) ?? []
    members.push(record)
    repeated.set(key, members)
  }
  const batches = [...repeated.values()]
    .filter((members) => members.length > 1)
    .map((members) => {
      const root = new Group()
      root.name = `decoration-batch-${members[0]!.definition.id}`
      return {
        members,
        root,
        renderer: undefined as ReturnType<typeof createStaticDecorationBatch>,
      }
    })

  return {
    planarMirrors,
    instances: [
      ...records.map(
        ({ definition, root }): RoomDecorationRenderInstance => ({
          roomId: definition.roomId,
          root,
        }),
      ),
      ...batches.map(({ members, root }) => ({
        roomId: members[0]!.definition.roomId,
        root,
      })),
    ],
    installTexture(assetId: string, texture: Texture): void {
      if (textures.has(assetId))
        throw new Error(
          `Room decoration texture "${assetId}" was installed more than once.`,
        )
      textures.set(assetId, texture)
    },
    installBundle(scene: Object3D, bundle: string): readonly string[] {
      const coveredSolidIds: string[] = []
      for (const batch of batches) {
        const first = batch.members[0]!
        const recipe = getRoomDecorationRecipe(first.definition.recipeId)
        if (first.installed || recipe.bundle !== bundle) continue
        const source = scene.getObjectByName(recipe.node)
        if (source === undefined) continue // The individual path reports the missing node.
        const template = createKitInstance(
          source,
          materials,
          {},
          materialLibrary,
        )
        batch.renderer = createStaticDecorationBatch(
          template,
          batch.members.map((member) => member.root),
          batch.root,
        )
        if (batch.renderer === undefined) {
          removeKitGeometry(template)
          continue
        }
        for (const member of batch.members) {
          member.installed = true
          coveredSolidIds.push(...(member.definition.coveredSolidIds ?? []))
        }
      }
      for (const record of records) {
        const recipe = getRoomDecorationRecipe(record.definition.recipeId)
        if (record.installed || recipe.bundle !== bundle) continue
        const source = scene.getObjectByName(recipe.node)
        if (source === undefined)
          throw new Error(
            `Room decoration recipe "${record.definition.recipeId}" could not find node "${recipe.node}" in bundle "${bundle}".`,
          )
        const art = createKitInstance(source, materials, {}, materialLibrary)
        let installedMirrors: readonly PlanarMirrorSurface[] = []
        try {
          if (recipe.surface !== undefined)
            installedMirrors = replaceSurface(
              art,
              recipe.surface,
              textures,
              materials,
            )
          art.name = `art-${record.definition.id}`
          record.root.add(art)
          record.installed = true
          planarMirrors.push(...installedMirrors)
          coveredSolidIds.push(...(record.definition.coveredSolidIds ?? []))
        } catch (error) {
          installedMirrors.forEach((mirror) => mirror.disposeTarget())
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
      batches.forEach((batch) => batch.renderer?.update())
    },
    dispose(): void {
      batches.forEach((batch) => batch.renderer?.dispose())
      planarMirrors.forEach((mirror) => mirror.disposeTarget())
      planarMirrors.length = 0
      textures.forEach((texture) => texture.dispose())
      textures.clear()
    },
  }
}

export type RoomDecorations = ReturnType<typeof createRoomDecorations>
