// Runner scenery — fixed-capacity donor assemblies with fog-safe two-chunk residency.

import type { BufferGeometry, Material, Object3D, TypedArray } from 'three'
import { DynamicDrawUsage, Group, InstancedMesh, Matrix4 } from 'three'
import type { CompiledRunnerCourse, RunnerSnapshot } from '../runner/contracts'
import type { MaterialFinishBank } from './material-finishes'
import { buildRunnerSceneryDonorAssembly } from './runner-scenery-geometry'
import type { RunnerSceneryKind, RunnerSceneryWindow, } from './runner-scenery-layout'
import { createRunnerSceneryLayout, runnerSceneryPlacementMatrix, } from './runner-scenery-layout'
import { createSourcePoolSurface } from './source-pool'

export interface RunnerSceneryOptions {
  readonly course: CompiledRunnerCourse
  readonly museumScene: Object3D
  readonly gardenScene: Object3D
  readonly arcadeScene: Object3D
  readonly canopyScene: Object3D
  readonly finishes?: MaterialFinishBank
  readonly reducedMotion: boolean
  readonly skipFirstChunks?: number
}

export interface RunnerSceneryMetrics {
  readonly residentChunks: number
  readonly drawBatches: number
  readonly triangles: number
  readonly buffersBytes: number
}

interface SceneryPool {
  readonly meshes: readonly InstancedMesh[]
  readonly matricesByWindow: ReadonlyMap<string, readonly Matrix4[]>
  readonly warmupMatrix: Matrix4
}

interface WarmupMeshState {
  readonly mesh: InstancedMesh
  readonly count: number
  readonly visible: boolean
  readonly frustumCulled: boolean
  readonly firstMatrix: Matrix4
  readonly boundingBox: InstancedMesh['boundingBox']
  readonly boundingSphere: InstancedMesh['boundingSphere']
}

function maximumKindCount(
  windows: readonly RunnerSceneryWindow[],
  kind: RunnerSceneryKind,
) {
  return Math.max(
    1,
    ...windows.map(
      (window) =>
        window.placements.filter((placement) => placement.kind === kind).length,
    ),
  )
}

function matricesForKind(
  windows: readonly RunnerSceneryWindow[],
  kind: RunnerSceneryKind,
  skipFirstChunks: number,
) {
  return new Map(
    windows.map((window) => [
      window.key,
      Object.freeze(
        window.placements
          .filter(
            (placement) =>
              placement.kind === kind &&
              placement.chunkIndex >= skipFirstChunks,
          )
          .map((placement) => runnerSceneryPlacementMatrix(placement)),
      ),
    ]),
  )
}

function configureMesh(mesh: InstancedMesh, name: string, root: Group) {
  mesh.name = name
  mesh.count = 0
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  root.add(mesh)
  return mesh
}

function geometryTriangles(geometry: BufferGeometry): number {
  return (geometry.index?.count ?? geometry.getAttribute('position').count) / 3
}

function geometryBytes(geometry: BufferGeometry): number {
  let bytes = geometry.index?.array.byteLength ?? 0
  for (const attribute of Object.values(geometry.attributes))
    bytes += (attribute.array as TypedArray).byteLength
  return bytes
}

/** Creates the complete fixed-capacity visual dressing for Singing Current. */
export function createRunnerScenery(options: RunnerSceneryOptions) {
  const root = new Group()
  root.name = 'runner-scenery'
  let cameraProfile = options.course.presentation.cameraProfile
  let layout = createRunnerSceneryLayout(options.course)
  const layoutsByProfile = new Map([[cameraProfile, layout]])
  const ownedGeometries: BufferGeometry[] = []
  const ownedMaterials: Material[] = []
  const meshes: InstancedMesh[] = []
  const pools: SceneryPool[] = []
  const sourcePool = createSourcePoolSurface({ fog: true })
  let disposed = false
  let warming = false
  let activeWindow = layout.windows[0]!
  let presentationSeconds = 0
  let courseDistanceMeters = 0

  const createPool = (
    kind: RunnerSceneryKind,
    parts: readonly {
      readonly geometry: BufferGeometry
      readonly material: Material
    }[],
  ) => {
    const capacity = maximumKindCount(layout.windows, kind)
    const matricesByWindow = matricesForKind(
      layout.windows,
      kind,
      options.skipFirstChunks ?? 0,
    )
    const warmupMatrix = [...matricesByWindow.values()].find(
      (matrices) => matrices.length > 0,
    )?.[0]
    // An authored opening may replace every placement on a short course.
    // Such a pool has nothing to draw or warm; its donor buffers still retire below.
    if (!warmupMatrix) return
    const poolMeshes = parts.map(({ geometry, material }, partIndex) => {
      const mesh = configureMesh(
        new InstancedMesh(geometry, material, capacity),
        `runner-scenery-${kind}-${partIndex}-${geometry.name}-instances`,
        root,
      )
      meshes.push(mesh)
      return mesh
    })
    pools.push({ meshes: poolMeshes, matricesByWindow, warmupMatrix })
  }

  try {
    const donorScenes = {
      museum: options.museumScene,
      garden: options.gardenScene,
      arcade: options.arcadeScene,
      canopy: options.canopyScene,
    }
    for (const kind of ['terrace', 'canopy', 'arcade'] as const) {
      const parts = buildRunnerSceneryDonorAssembly(kind, donorScenes)
      parts.forEach(({ geometry }) => ownedGeometries.push(geometry))
      const finishedParts = parts.map((part) => {
        if (part.material.name !== 'museum_petrol' || !options.finishes)
          return part
        const material = options.finishes.create('celadon-porcelain')
        ownedMaterials.push(material)
        return { ...part, material }
      })
      createPool(kind, finishedParts)
    }
    createPool('water', [
      { geometry: sourcePool.geometry, material: sourcePool.material },
    ])
    createPool('waterfall', [
      { geometry: sourcePool.geometry, material: sourcePool.material },
    ])
  } catch (error) {
    meshes.forEach((mesh) => mesh.dispose())
    ownedGeometries.forEach((geometry) => geometry.dispose())
    ownedMaterials.forEach((material) => material.dispose())
    sourcePool.dispose()
    throw error
  }

  const buffersBytes =
    ownedGeometries.reduce(
      (total, geometry) => total + geometryBytes(geometry),
      0,
    ) +
    geometryBytes(sourcePool.geometry) +
    meshes.reduce(
      (total, mesh) => total + mesh.instanceMatrix.array.byteLength,
      0,
    )

  const applyWindow = (window: RunnerSceneryWindow) => {
    for (const pool of pools) {
      const matrices = pool.matricesByWindow.get(window.key)!
      for (const mesh of pool.meshes) {
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
        mesh.count = matrices.length
        mesh.visible = matrices.length > 0
        mesh.instanceMatrix.needsUpdate = true
        if (matrices.length > 0) {
          mesh.computeBoundingBox()
          mesh.computeBoundingSphere()
        } else {
          mesh.boundingBox = null
          mesh.boundingSphere = null
        }
      }
    }
    activeWindow = window
  }
  applyWindow(activeWindow)
  sourcePool.setPresentation(0, options.reducedMotion)

  const update = (snapshot: RunnerSnapshot, deltaSeconds = 0) => {
    if (disposed) return
    courseDistanceMeters = snapshot.courseDistanceMeters
    root.position.z = snapshot.courseDistanceMeters
    const selected = layout.select(snapshot.courseDistanceMeters)
    if (selected !== activeWindow) applyWindow(selected)
    if (
      snapshot.status === 'running' &&
      Number.isFinite(deltaSeconds) &&
      deltaSeconds > 0
    )
      presentationSeconds += Math.min(deltaSeconds, 0.1)
    sourcePool.setPresentation(presentationSeconds, options.reducedMotion)
  }

  /** Change only the handoff schedule; every donor, GPU buffer and pool stays owned by this visit. */
  const setCameraProfile = (
    profile: CompiledRunnerCourse['presentation']['cameraProfile'],
  ): boolean => {
    if (disposed || warming) return false
    if (profile === cameraProfile) return true
    const nextLayout =
      layoutsByProfile.get(profile) ??
      createRunnerSceneryLayout({
        ...options.course,
        presentation: {
          ...options.course.presentation,
          cameraProfile: profile,
        },
      })
    layoutsByProfile.set(profile, nextLayout)
    layout = nextLayout
    cameraProfile = profile
    const selected = layout.select(courseDistanceMeters)
    if (selected.key !== activeWindow.key) applyWindow(selected)
    else activeWindow = selected
    return true
  }

  const metrics = (): RunnerSceneryMetrics =>
    disposed
      ? { residentChunks: 0, drawBatches: 0, triangles: 0, buffersBytes: 0 }
      : {
          residentChunks: activeWindow.chunkIds.length,
          drawBatches: meshes.filter((mesh) => mesh.count > 0).length,
          triangles: meshes.reduce(
            (total, mesh) =>
              total + geometryTriangles(mesh.geometry) * mesh.count,
            0,
          ),
          buffersBytes,
        }

  const withWarmupState = async <T>(callback: () => T | Promise<T>) => {
    if (disposed) throw new Error('Runner scenery is disposed.')
    if (warming) throw new Error('Runner scenery warmup is already active.')
    warming = true
    const states: WarmupMeshState[] = meshes.map((mesh) => {
      const firstMatrix = new Matrix4()
      mesh.getMatrixAt(0, firstMatrix)
      return {
        mesh,
        count: mesh.count,
        visible: mesh.visible,
        frustumCulled: mesh.frustumCulled,
        firstMatrix,
        boundingBox: mesh.boundingBox?.clone() ?? null,
        boundingSphere: mesh.boundingSphere?.clone() ?? null,
      }
    })
    try {
      for (const pool of pools)
        for (const mesh of pool.meshes) {
          if (mesh.count === 0) {
            mesh.setMatrixAt(0, pool.warmupMatrix)
            mesh.count = 1
            mesh.instanceMatrix.needsUpdate = true
            mesh.computeBoundingBox()
            mesh.computeBoundingSphere()
          }
          mesh.visible = true
          mesh.frustumCulled = false
        }
      return await callback()
    } finally {
      if (!disposed)
        for (const state of states) {
          state.mesh.setMatrixAt(0, state.firstMatrix)
          state.mesh.count = state.count
          state.mesh.visible = state.visible
          state.mesh.frustumCulled = state.frustumCulled
          state.mesh.boundingBox = state.boundingBox
          state.mesh.boundingSphere = state.boundingSphere
          state.mesh.instanceMatrix.needsUpdate = true
        }
      warming = false
    }
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    layoutsByProfile.clear()
    root.clear()
    meshes.forEach((mesh) => mesh.dispose())
    ownedGeometries.forEach((geometry) => geometry.dispose())
    ownedMaterials.forEach((material) => material.dispose())
    sourcePool.dispose()
  }

  return { root, update, metrics, setCameraProfile, withWarmupState, dispose }
}
