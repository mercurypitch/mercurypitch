// ============================================================
// Resonance surface cracks — seeded fracture paths projected onto glass surfaces with owned render resources.
// ============================================================
//
// Ray tests use a temporary clone so projecting cracks never mutates or takes
// ownership of the borrowed vase geometry. Material filtering keeps gold trim clear.

import type { Box3 } from 'three'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Raycaster, Vector3, } from 'three'
import type { NormalizedResonancePresentationConfig } from './resonance-release-config'

export interface SurfaceCracks {
  readonly root: Group
  readonly line: LineSegments<BufferGeometry, LineBasicMaterial>
  readonly stageVertexCounts: readonly number[]
  readonly totalSegments: number
}

const TAU = Math.PI * 2

export function createSurfaceCracks(
  source: BufferGeometry,
  bounds: Box3,
  settings: NormalizedResonancePresentationConfig,
  glassMaterialIndices?: readonly number[],
): SurfaceCracks {
  const allowedMaterials =
    glassMaterialIndices === undefined
      ? undefined
      : new Set(glassMaterialIndices)
  const root = new Group()
  root.name = 'resonance-surface-fractures'
  root.userData.excludeFromCameraCollision = true
  const positions: number[] = []
  const stageVertexCounts: number[] = []
  const geometry = source.clone()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const temporaryMaterial = new MeshBasicMaterial({ side: DoubleSide })
  const maximumMaterialIndex = geometry.groups.reduce(
    (maximum, group) => Math.max(maximum, group.materialIndex ?? 0),
    0,
  )
  const temporaryMesh = new Mesh(
    geometry,
    geometry.groups.length > 0
      ? Array.from(
          { length: maximumMaterialIndex + 1 },
          () => temporaryMaterial,
        )
      : temporaryMaterial,
  )
  temporaryMesh.updateMatrixWorld(true)
  const raycaster = new Raycaster()
  const centre = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())
  const outsideRadius = Math.max(size.x, size.z) * 1.35 + size.y * 0.2
  const surfaceOffset = Math.max(0.0007, size.y * 0.0015)
  const origin = new Vector3()
  const direction = new Vector3()
  const outward = new Vector3()
  const normal = new Vector3()
  let pathIndex = 0
  try {
    settings.crackStages.forEach((stage, stageIndex) => {
      for (let path = 0; path < stage.paths; path++) {
        const startAngle =
          hashUnit(settings.seed ^ 0x8da6_b343, pathIndex * 7 + 1) * TAU
        const startHeight =
          0.78 -
          stageIndex * 0.07 +
          signedHash(settings.seed ^ 0x2c1b_3c6d, pathIndex * 7 + 2) * 0.08
        const fall =
          0.18 + hashUnit(settings.seed ^ 0x297a_2d39, pathIndex * 7 + 3) * 0.2
        const turn =
          signedHash(settings.seed ^ 0x85eb_ca6b, pathIndex * 7 + 4) * 0.55
        let previous: Vector3 | undefined
        for (let segment = 0; segment <= stage.segmentsPerPath; segment++) {
          const t = segment / stage.segmentsPerPath
          const angle =
            startAngle +
            turn * t +
            Math.sin((t + pathIndex * 0.17) * Math.PI * 2) * 0.055
          const yFraction = Math.min(
            0.92,
            Math.max(
              0.1,
              startHeight - fall * t + Math.sin(t * Math.PI) * 0.025,
            ),
          )
          outward.set(Math.cos(angle), 0, Math.sin(angle))
          origin.set(
            centre.x + outward.x * outsideRadius,
            bounds.min.y + yFraction * size.y,
            centre.z + outward.z * outsideRadius,
          )
          direction.copy(outward).negate()
          raycaster.set(origin, direction)
          raycaster.near = 0
          raycaster.far = outsideRadius * 2.2
          const hit = raycaster.intersectObject(temporaryMesh, false).at(0)
          if (
            !hit ||
            !hit.face ||
            (allowedMaterials !== undefined &&
              !allowedMaterials.has(hit.face.materialIndex))
          ) {
            previous = undefined
            continue
          }
          const point = hit.point.clone()
          normal.copy(hit.face.normal)
          if (normal.dot(outward) < 0) normal.negate()
          point.addScaledVector(normal, surfaceOffset)
          if (previous)
            positions.push(...previous.toArray(), ...point.toArray())
          previous = point
        }
        pathIndex++
      }
      stageVertexCounts.push(positions.length / 3)
    })
  } finally {
    temporaryMaterial.dispose()
    geometry.dispose()
  }
  const lineGeometry = new BufferGeometry()
  lineGeometry.name = 'resonance-surface-fracture-geometry'
  lineGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(positions, 3),
  )
  lineGeometry.setDrawRange(0, 0)
  const material = new LineBasicMaterial({
    name: 'resonance-surface-fracture-material',
    color: settings.palette.crack,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  })
  const line = new LineSegments(lineGeometry, material)
  line.name = 'resonance-surface-fracture-lines'
  line.frustumCulled = false
  line.userData.excludeFromCameraCollision = true
  root.add(line)
  return {
    root,
    line,
    stageVertexCounts,
    totalSegments: positions.length / 6,
  }
}

export function disposeSurfaceCracks(cracks: SurfaceCracks): void {
  cracks.root.removeFromParent()
  cracks.line.geometry.dispose()
  cracks.line.material.dispose()
  cracks.root.clear()
}

function signedHash(seed: number, index: number): number {
  return hashUnit(seed, index) * 2 - 1
}

function hashUnit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index, 0x9e37_79b1)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0_aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a_2d97)
  value ^= value >>> 15
  return (value >>> 0) / 0x1_0000_0000
}
