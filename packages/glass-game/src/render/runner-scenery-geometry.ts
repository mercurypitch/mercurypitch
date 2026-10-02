// Runner scenery geometry — preserve finished donor transforms in reusable instanced assemblies.

import type { BufferGeometry, Material, Mesh, Object3D } from 'three'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { RunnerSceneryDonorPart, RunnerSceneryDonorSource, } from './runner-scenery-layout'
import { RUNNER_SCENERY_ASSEMBLIES } from './runner-scenery-layout'

export interface RunnerSceneryGeometryPart {
  readonly geometry: BufferGeometry
  readonly material: Material
}

export type RunnerSceneryDonorScenes = Readonly<
  Record<RunnerSceneryDonorSource, Object3D>
>

interface DonorPiece extends RunnerSceneryGeometryPart {
  readonly relativeMatrix: Matrix4
}

const EXPECTED_DONOR_MATERIALS = Object.freeze({
  terrace: Object.freeze([
    'museum:museum_brass',
    'museum:museum_ivory',
    'museum:museum_limestone',
    'museum:museum_petrol',
    'garden:garden_palette',
    'garden:museum_ivory',
    'garden:museum_limestone',
  ]),
  canopy: Object.freeze(['canopy:meshy_observatory_canopy_atlas']),
  arcade: Object.freeze(['arcade:meshy_garden_arcade_atlas']),
})

const Y_AXIS = new Vector3(0, 1, 0)

function donorPieces(scene: Object3D, prefabName: string) {
  scene.updateWorldMatrix(true, true)
  const prefab = scene.getObjectByName(prefabName)
  if (!prefab)
    throw new Error(`Runner scenery could not find donor node "${prefabName}".`)
  const inversePrefab = prefab.matrixWorld.clone().invert()
  const pieces: DonorPiece[] = []
  prefab.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    if (Array.isArray(mesh.material))
      throw new Error(
        `Runner scenery donor "${prefabName}" uses an unsupported material array.`,
      )
    pieces.push({
      geometry: mesh.geometry,
      material: mesh.material,
      relativeMatrix: inversePrefab.clone().multiply(mesh.matrixWorld),
    })
  })
  if (pieces.length === 0)
    throw new Error(
      `Runner scenery donor "${prefabName}" has no mesh geometry.`,
    )
  return Object.freeze(pieces)
}

function partMatrix(part: RunnerSceneryDonorPart): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...part.position),
    new Quaternion().setFromAxisAngle(Y_AXIS, part.yawRadians),
    new Vector3(part.scale, part.scale, part.scale),
  )
}

/**
 * Bakes one assembly once. The returned geometry is owned by the runner; source
 * geometry, materials and textures remain borrowed from their loaded bundles.
 */
export function buildRunnerSceneryDonorAssembly(
  kind: 'terrace' | 'canopy' | 'arcade',
  scenes: RunnerSceneryDonorScenes,
) {
  const geometriesByMaterial = new Map<
    string,
    { material: Material; geometries: BufferGeometry[] }
  >()
  const temporary: BufferGeometry[] = []
  try {
    for (const part of RUNNER_SCENERY_ASSEMBLIES[kind].donorParts) {
      const assemblyMatrix = partMatrix(part)
      for (const piece of donorPieces(scenes[part.source], part.prefab)) {
        const materialName = piece.material.name
        if (!materialName)
          throw new Error(
            `Runner scenery donor "${part.prefab}" has an unnamed material.`,
          )
        const geometry = piece.geometry.clone()
        temporary.push(geometry)
        geometry.applyMatrix4(
          assemblyMatrix.clone().multiply(piece.relativeMatrix),
        )
        const key = `${part.source}:${materialName}`
        const group = geometriesByMaterial.get(key)
        if (group) {
          if (group.material !== piece.material)
            throw new Error(
              `Runner scenery donor material "${key}" no longer has one shared identity.`,
            )
          group.geometries.push(geometry)
        } else
          geometriesByMaterial.set(key, {
            material: piece.material,
            geometries: [geometry],
          })
      }
    }

    const expected = EXPECTED_DONOR_MATERIALS[kind]
    const actual = [...geometriesByMaterial.keys()].sort()
    if (
      actual.length !== expected.length ||
      expected.some((name) => !geometriesByMaterial.has(name))
    )
      throw new Error(
        `Runner scenery ${kind} donor materials changed: ${actual.join(', ')}.`,
      )

    const merged: RunnerSceneryGeometryPart[] = []
    try {
      for (const materialKey of expected) {
        const group = geometriesByMaterial.get(materialKey)!
        const geometry = mergeGeometries(
          group.geometries,
          false,
        ) as BufferGeometry | null
        if (geometry === null)
          throw new Error(
            `Runner scenery could not merge ${kind}:${materialKey}.`,
          )
        geometry.name = `runner-scenery-${kind}-${materialKey.replace(':', '-')}`
        merged.push(Object.freeze({ geometry, material: group.material }))
      }
      return Object.freeze(merged)
    } catch (error) {
      merged.forEach(({ geometry }) => geometry.dispose())
      throw error
    }
  } finally {
    temporary.forEach((geometry) => geometry.dispose())
  }
}
