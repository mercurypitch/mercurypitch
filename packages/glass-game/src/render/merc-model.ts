// ============================================================
// Merc model asset — shared GLB loading and authored material dressing.
// ============================================================

import type { AnimationClip, Group, Material, Mesh } from 'three'
import { Box3, LoadingManager, MeshPhysicalMaterial } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { disposeObject } from './dispose'

export interface MercModelAsset {
  readonly body: Group
  readonly animations: readonly AnimationClip[]
  readonly bounds: Box3
  readonly metal: MeshPhysicalMaterial
  dispose(): void
}

export interface LoadMercModelOptions {
  readonly castShadows?: boolean
  readonly signal?: AbortSignal
}

/** Gameplay and lightweight previews deliberately share this exact finish. */
export function createMercMetalMaterial(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: 0xf4f7f8,
    metalness: 1,
    roughness: 0.065,
    iridescence: 0.85,
    iridescenceIOR: 1.65,
    iridescenceThicknessRange: [120, 480],
    envMapIntensity: 1.25,
  })
}

function abortError(): DOMException {
  return new DOMException('Merc model loading was aborted', 'AbortError')
}

/**
 * Loads one owned Merc document. Body and hand shells receive the canonical
 * finish while the authored eye material and every animation remain intact.
 */
export async function loadMercModel(
  url: string,
  options: LoadMercModelOptions = {},
): Promise<MercModelAsset> {
  const isAborted = (): boolean => options.signal?.aborted === true
  if (isAborted()) throw abortError()

  const failedDependencies: string[] = []
  const manager = new LoadingManager()
  manager.onError = (failedUrl) => failedDependencies.push(failedUrl)
  const gltf = await new GLTFLoader(manager).loadAsync(url)
  if (failedDependencies.length > 0 || isAborted()) {
    disposeObject(gltf.scene)
    if (isAborted()) throw abortError()
    throw new Error(
      `Merc has unavailable dependencies: ${failedDependencies.join(', ')}`,
    )
  }

  const body = gltf.scene
  body.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(body)
  const metal = createMercMetalMaterial()
  const replacedMaterials = new Set<Material>()
  let usesMetal = false

  try {
    body.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      // GLTFLoader creates an unnamed default material for unassigned shells.
      // The exported merc_eye material belongs to the authored face and stays.
      if (mesh.name === 'merc_body' || mesh.name.startsWith('merc_hand')) {
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material])
          replacedMaterials.add(material)
        mesh.material = metal
        usesMetal = true
      }
      mesh.castShadow = options.castShadows === true
      mesh.receiveShadow = options.castShadows === true
    })
    for (const material of replacedMaterials) material.dispose()
  } catch (error) {
    for (const material of replacedMaterials) material.dispose()
    disposeObject(body)
    if (!usesMetal) metal.dispose()
    throw error
  }

  let disposed = false
  return {
    body,
    animations: gltf.animations,
    bounds,
    metal,
    dispose() {
      if (disposed) return
      disposed = true
      // Environment maps belong to the scene using this model.
      metal.envMap = null
      disposeObject(body)
      if (!usesMetal) metal.dispose()
    },
  }
}
