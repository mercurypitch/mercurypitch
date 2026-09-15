// ============================================================
// Museum asset adapter — host URLs become renderer-owned geometry and textures.
// ============================================================

import type { BufferGeometry, Mesh, Object3D, Texture } from 'three'
import { Box3, Float32BufferAttribute, Matrix4, SRGBColorSpace, TextureLoader, Vector3, } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { LevelDefinition } from '../contracts'
import { getBreakableRenderRecipe, getPlatformRenderRecipe, MUSEUM_MATERIAL_CATALOG, } from './catalog'
import { disposeObject } from './dispose'
import type { FracturePiece } from './fracture'
import { createKitInstance } from './kit-instance'
import type { MuseumMaterials } from './materials'
import type { createMuseum } from './museum'
import { getMuseumSceneRecipe } from './scene-catalog'
import type { createVessel } from './vessels'

/** Bake glTF's node transforms and material seams, preserving the authored UVs. */
function flattenGeometry(
  object: Object3D,
  transform = new Matrix4(),
  portraitMaterial?: string,
): BufferGeometry {
  const sources: BufferGeometry[] = []
  const groups: { start: number; count: number; materialIndex: number }[] = []
  let offset = 0
  object.updateWorldMatrix(true, true)
  object.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld).applyMatrix4(transform)
    for (const name of Object.keys(geometry.attributes))
      if (!['position', 'normal', 'uv'].includes(name))
        geometry.deleteAttribute(name)
    const count = geometry.getAttribute('position').count
    if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals()
    if (!geometry.hasAttribute('uv'))
      geometry.setAttribute(
        'uv',
        new Float32BufferAttribute(new Float32Array(count * 2), 2),
      )
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    const sourceGroups = geometry.groups.length
      ? geometry.groups
      : [{ start: 0, count, materialIndex: 0 }]
    for (const group of sourceGroups)
      groups.push({
        start: offset + group.start,
        count: group.count,
        materialIndex:
          portraitMaterial !== undefined &&
          materials[group.materialIndex ?? 0]?.name === portraitMaterial
            ? 1
            : 0,
      })
    geometry.clearGroups()
    offset += count
    sources.push(geometry)
  })
  const geometry = mergeGeometries(sources, false)
  sources.forEach((source) => source.dispose())
  if (geometry === null)
    throw new Error(`Museum asset has no mergeable geometry: ${object.name}`)
  for (const group of groups)
    geometry.addGroup(group.start, group.count, group.materialIndex)
  return geometry
}

export async function loadMuseumAssets(
  level: LevelDefinition,
  assetUrl: (id: string) => string,
  vessels: Map<string, ReturnType<typeof createVessel>>,
  museum: ReturnType<typeof createMuseum>,
  materials: MuseumMaterials,
  setSky: (texture: Texture) => void,
  disposed: () => boolean,
  onError?: (id: string, error: unknown) => void,
): Promise<void> {
  const loadBundle = async (id: string, use: (scene: Object3D) => void) => {
    let scene: Object3D | undefined
    try {
      scene = (await new GLTFLoader().loadAsync(assetUrl(id))).scene
      if (!disposed()) use(scene)
    } catch (error) {
      if (!disposed()) onError?.(id, error)
    } finally {
      if (scene) disposeObject(scene)
    }
  }
  const loadTexture = async (
    id: string,
    use: (texture: Awaited<ReturnType<TextureLoader['loadAsync']>>) => void,
  ) => {
    try {
      const texture = await new TextureLoader().loadAsync(assetUrl(id))
      texture.colorSpace = SRGBColorSpace
      if (disposed()) texture.dispose()
      else use(texture)
    } catch (error) {
      if (!disposed()) onError?.(id, error)
    }
  }
  const installTargets = (scene: Object3D, bundle: string) => {
    for (const target of level.breakables) {
      const recipe = getBreakableRenderRecipe(target.variant)
      if (recipe.bundle !== bundle || recipe.intactNode === undefined) continue
      const intact = scene.getObjectByName(recipe.intactNode)
      if (!intact)
        throw new Error(
          `Missing exhibit node ${recipe.intactNode} in ${bundle}`,
        )
      const box = new Box3().setFromObject(intact)
      const scale =
        recipe.displayHeight / Math.max(0.001, box.max.y - box.min.y)
      const transform = new Matrix4()
        .makeScale(scale, scale, scale)
        .multiply(
          new Matrix4().makeTranslation(
            -(box.min.x + box.max.x) / 2,
            -box.min.y,
            -(box.min.z + box.max.z) / 2,
          ),
        )
      const pieces: FracturePiece[] = []
      // The asset's 16 closed pieces are the same silhouette, with their own pivots.
      for (let i = 0; i < 24; i++) {
        const shard = scene.getObjectByName(
          `${recipe.shardPrefix}${String(i).padStart(3, '0')}`,
        )
        if (!shard) continue
        const geometry = flattenGeometry(
          shard,
          transform,
          recipe.portraitMaterial,
        )
        geometry.computeBoundingBox()
        const centre = geometry.boundingBox!.getCenter(new Vector3())
        geometry.translate(-centre.x, -centre.y, -centre.z)
        pieces.push({ geometry, centre })
      }
      vessels
        .get(target.id)
        ?.setGeometry(
          flattenGeometry(intact, transform, recipe.portraitMaterial),
          pieces.length ? pieces : undefined,
        )
      if (recipe.persistentPrefix !== undefined)
        scene.traverse((node) => {
          if (
            !node.name.startsWith(recipe.persistentPrefix!) ||
            node.parent?.name.startsWith(recipe.persistentPrefix!) === true
          )
            return
          const part = createKitInstance(node, materials)
          part.applyMatrix4(transform)
          vessels.get(target.id)?.addPersistent(part)
        })
    }
  }
  const sceneRecipe = getMuseumSceneRecipe(level.id)
  const bundles = new Set<string>(
    sceneRecipe.kitDecorations.map((item) => item.bundle),
  )
  const portraitTextures = new Set<string>()
  for (const target of level.breakables) {
    const recipe = getBreakableRenderRecipe(target.variant)
    if (recipe.bundle !== undefined) bundles.add(recipe.bundle)
    if (recipe.portraitTexture !== undefined)
      portraitTextures.add(recipe.portraitTexture)
  }
  for (const platform of level.platforms) {
    const recipe = getPlatformRenderRecipe(platform.renderId ?? platform.kind)
    if (recipe.bundle !== undefined) bundles.add(recipe.bundle)
  }
  await Promise.all([
    ...(sceneRecipe.skyTexture !== undefined
      ? [loadTexture(sceneRecipe.skyTexture, setSky)]
      : []),
    ...[...bundles].map((bundle) =>
      loadBundle(bundle, (scene) => {
        museum.setKit(scene, bundle)
        installTargets(scene, bundle)
      }),
    ),
    ...[...portraitTextures].map((id) =>
      loadTexture(id, (texture) => {
        texture.flipY = false
        for (const target of level.breakables)
          if (getBreakableRenderRecipe(target.variant).portraitTexture === id)
            vessels.get(target.id)?.setPortrait(texture)
      }),
    ),
    ...Object.entries(MUSEUM_MATERIAL_CATALOG)
      .filter(([, recipe]) => recipe.texture !== undefined)
      .map(([id, recipe]) =>
        loadTexture(recipe.texture!, (texture) => {
          materials[id].map?.dispose()
          materials[id].map = texture
          materials[id].needsUpdate = true
        }),
      ),
  ])
}
