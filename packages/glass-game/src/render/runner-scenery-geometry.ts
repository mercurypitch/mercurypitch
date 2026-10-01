// Runner scenery geometry — preserve donor transforms and build owned composite assemblies.

import type { BufferGeometry, Material, Mesh, Object3D } from 'three'
import { BoxGeometry, Color, Float32BufferAttribute, Matrix4, PlaneGeometry, Quaternion, Vector3, } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { RunnerSceneryDonorPart } from './runner-scenery-layout'
import { RUNNER_SCENERY_ASSEMBLIES } from './runner-scenery-layout'

export interface RunnerSceneryGeometryPart {
  readonly geometry: BufferGeometry
  readonly material: Material
}

interface DonorPiece extends RunnerSceneryGeometryPart {
  readonly relativeMatrix: Matrix4
}

const EXPECTED_DONOR_MATERIALS = Object.freeze({
  pavilion: Object.freeze(['museum_brass', 'museum_ivory', 'museum_limestone']),
  landmark: Object.freeze(['museum_brass', 'museum_ivory', 'museum_limestone']),
  garden: Object.freeze(['garden_palette', 'museum_ivory']),
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

function foundationGeometry(
  width: number,
  height: number,
  depth: number,
  x = 0,
  z = 0,
): BufferGeometry {
  const geometry = new BoxGeometry(width, height, depth)
  geometry.translate(x, -height / 2, z)
  return geometry
}

export function buildRunnerSceneryDonorAssembly(
  kind: 'pavilion' | 'landmark' | 'garden',
  scenes: Readonly<Record<'museum' | 'garden', Object3D>>,
) {
  const geometriesByMaterial = new Map<
    string,
    { material: Material; geometries: BufferGeometry[] }
  >()
  const temporary: BufferGeometry[] = []
  try {
    for (const part of RUNNER_SCENERY_ASSEMBLIES[kind].donorParts) {
      const scene =
        part.prefab === 'garden_perimeter' || part.prefab === 'ivy_trail'
          ? scenes.garden
          : scenes.museum
      const assemblyMatrix = partMatrix(part)
      for (const piece of donorPieces(scene, part.prefab)) {
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
        const group = geometriesByMaterial.get(materialName)
        if (group) {
          if (group.material !== piece.material)
            throw new Error(
              `Runner scenery donor material "${materialName}" no longer has one shared identity.`,
            )
          group.geometries.push(geometry)
        } else
          geometriesByMaterial.set(materialName, {
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

    const support =
      kind === 'pavilion'
        ? {
            materialName: 'museum_limestone',
            geometries: [foundationGeometry(3.3, 0.2, 1.4)],
          }
        : kind === 'landmark'
          ? {
              materialName: 'museum_limestone',
              geometries: [
                foundationGeometry(4.8, 0.24, 4.4, -5.4),
                foundationGeometry(3.3, 0.2, 1.4, 4.65),
              ],
            }
          : {
              materialName: 'museum_ivory',
              geometries: [
                foundationGeometry(3.3, 0.18, 4.9, -4.65, 0.75),
                foundationGeometry(3.3, 0.18, 4.9, 4.65, -0.65),
              ],
            }
    const supportMaterial = geometriesByMaterial.get(support.materialName)
    temporary.push(...support.geometries)
    if (supportMaterial === undefined)
      throw new Error(
        `Runner scenery ${kind} has no ${support.materialName} support material.`,
      )
    support.geometries.forEach((geometry) => {
      const exemplar = supportMaterial.geometries[0]!
      for (const name of Object.keys(geometry.attributes))
        if (!exemplar.hasAttribute(name)) geometry.deleteAttribute(name)
      if (exemplar.hasAttribute('tangent')) geometry.computeTangents()
      if (exemplar.hasAttribute('color')) colorize(geometry, new Color(1, 1, 1))
      for (const name of Object.keys(exemplar.attributes))
        if (!geometry.hasAttribute(name))
          throw new Error(
            `Runner scenery ${kind} support cannot match donor attribute "${name}".`,
          )
      if (
        Object.keys(geometry.attributes).some((name) => {
          const actual = geometry.getAttribute(name)
          const expectedAttribute = exemplar.getAttribute(name)
          return (
            actual.itemSize !== expectedAttribute.itemSize ||
            actual.normalized !== expectedAttribute.normalized ||
            actual.array.constructor !== expectedAttribute.array.constructor
          )
        })
      )
        throw new Error(
          `Runner scenery ${kind} support attributes changed incompatibly.`,
        )
      supportMaterial.geometries.push(geometry)
    })

    const merged: RunnerSceneryGeometryPart[] = []
    try {
      for (const materialName of expected) {
        const group = geometriesByMaterial.get(materialName)!
        const geometry = mergeGeometries(
          group.geometries,
          false,
        ) as BufferGeometry | null
        if (geometry === null)
          throw new Error(
            `Runner scenery could not merge ${kind}:${materialName}.`,
          )
        geometry.name = `runner-scenery-${kind}-${materialName}`
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

function colorize(geometry: BufferGeometry, color: Color): BufferGeometry {
  const positions = geometry.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)
  for (let index = 0; index < positions.count; index++)
    color.toArray(colors, index * 3)
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

export function createRunnerSceneryPaintingGeometry(): {
  readonly plane: BufferGeometry
  readonly frame: BufferGeometry
} {
  const plane = new PlaneGeometry(1.3, 1.83)
  plane.translate(0, 1.075, 0)
  plane.name = 'runner-scenery-painting-plane'
  const pieces: BufferGeometry[] = []
  let frame: BufferGeometry | null = null
  const addPiece = (geometry: BufferGeometry, color: Color) => {
    pieces.push(geometry)
    colorize(geometry, color)
  }
  try {
    const brass = new Color(0xb57626)
    const ivory = new Color(0xdbd6c7)
    addPiece(
      new BoxGeometry(0.12, 2.15, 0.08).translate(-0.72, 1.075, 0),
      brass,
    )
    addPiece(new BoxGeometry(0.12, 2.15, 0.08).translate(0.72, 1.075, 0), brass)
    addPiece(new BoxGeometry(1.32, 0.12, 0.08).translate(0, 0.06, 0), brass)
    addPiece(new BoxGeometry(1.32, 0.12, 0.08).translate(0, 2.09, 0), brass)
    addPiece(
      new BoxGeometry(0.035, 1.91, 0.09).translate(-0.65, 1.075, 0),
      ivory,
    )
    addPiece(
      new BoxGeometry(0.035, 1.91, 0.09).translate(0.65, 1.075, 0),
      ivory,
    )
    addPiece(new BoxGeometry(1.27, 0.035, 0.09).translate(0, 0.13, 0), ivory)
    addPiece(new BoxGeometry(1.27, 0.035, 0.09).translate(0, 2.02, 0), ivory)
    frame = mergeGeometries(pieces, false) as BufferGeometry | null
    if (frame === null)
      throw new Error('Runner scenery could not merge painting frame.')
    frame.name = 'runner-scenery-painting-frame'
    return { plane, frame }
  } catch (error) {
    frame?.dispose()
    plane.dispose()
    throw error
  } finally {
    pieces.forEach((piece) => piece.dispose())
  }
}
