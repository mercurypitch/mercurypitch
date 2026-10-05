// Runner opening — finite instanced planting, architecture and animated canal banks.
import type { BufferGeometry, Material, MeshStandardMaterial, Object3D, Texture, } from 'three'
import { BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshPhysicalMaterial, Quaternion, Vector3, } from 'three'
import type { CompiledRunnerCourse, RunnerSnapshot } from '../runner/contracts'
import type { MaterialFinishBank } from './material-finishes'
import { buildOpeningDonor } from './runner-opening-geometry'
import type { RunnerOpeningKind } from './runner-opening-layout'
import { createRunnerOpeningLayout, RUNNER_OPENING_LENGTH_METERS, } from './runner-opening-layout'
import { createRunnerOpeningWater } from './runner-opening-water'

export interface RunnerOpeningOptions {
  readonly course: CompiledRunnerCourse
  readonly museum: Object3D
  readonly garden: Object3D
  readonly arcade: Object3D
  readonly canopy: Object3D
  readonly marble: Texture
  readonly finishes: MaterialFinishBank
  readonly reducedMotion: boolean
}

/** All heavyweight donor textures are borrowed. New buffers/materials belong to this visit. */
export function createRunnerOpening(options: RunnerOpeningOptions) {
  const root = new Group()
  root.name = 'runner-opening'
  const placements = createRunnerOpeningLayout(options.course)
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const meshes: InstancedMesh[] = []
  const water = createRunnerOpeningWater()
  const donorMaterials = new Map<Material, Material>()
  let time = 0
  let disposed = false
  const matrix = new Matrix4()
  const position = new Vector3()
  const scale = new Vector3()
  const rotation = new Quaternion()
  const up = new Vector3(0, 1, 0)

  const finish = (source: Material) => {
    const existing = donorMaterials.get(source)
    if (existing) return existing
    const material =
      source.name === 'museum_petrol'
        ? options.finishes.create('celadon-porcelain')
        : source.clone()
    const standard = material as MeshStandardMaterial
    if (standard.isMeshStandardMaterial) {
      standard.envMapIntensity = source.name.includes('brass') ? 0.8 : 0.55
    }
    materials.add(material)
    donorMaterials.set(source, material)
    return material
  }
  const batch = (
    kind: RunnerOpeningKind,
    geometry: BufferGeometry,
    material: Material,
  ) => {
    const items = placements.filter((item) => item.kind === kind)
    const mesh = new InstancedMesh(geometry, material, items.length)
    mesh.name = `runner-opening-${kind}-${material.name}`
    items.forEach((item, index) => {
      position.fromArray(item.position)
      scale.fromArray(item.scale)
      rotation.setFromAxisAngle(up, item.yaw)
      mesh.setMatrixAt(index, matrix.compose(position, rotation, scale))
    })
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
    mesh.receiveShadow = true
    // Fine foliage stays out of the repeated real-time shadow pass.
    mesh.castShadow = kind === 'column' || kind === 'rail-post'
    root.add(mesh)
    meshes.push(mesh)
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    root.clear()
    meshes.forEach((mesh) => mesh.dispose())
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    water.dispose()
  }
  try {
    const box = new BoxGeometry(1, 1, 1)
    const rail = new CylinderGeometry(0.027, 0.027, 1, 10)
    rail.rotateX(Math.PI / 2)
    const post = new CylinderGeometry(0.022, 0.045, 0.46, 8)
    geometries.add(box).add(rail).add(post)
    const ivory = new MeshPhysicalMaterial({
      name: 'runner-opening-warm-ivory',
      color: 0xf3ead8,
      map: options.marble,
      roughness: 0.45,
      metalness: 0,
      envMapIntensity: 0.45,
    })
    const celadon = options.finishes.create('celadon-porcelain')
    const gold = new MeshPhysicalMaterial({
      name: 'runner-opening-brushed-gold',
      color: 0xcaa852,
      roughness: 0.24,
      metalness: 0.88,
      envMapIntensity: 0.85,
    })
    materials.add(ivory).add(celadon).add(gold)
    batch('canal-bed', box, celadon)
    batch('canal-lip', box, ivory)
    batch('plinth', box, ivory)
    batch('rail', rail, gold)
    batch('rail-post', post, gold)
    batch('water', water.geometry, water.material)
    for (const [kind, source, prefab] of [
      ['column', options.museum, 'museum_column'],
      ['foliage', options.garden, 'garden_foliage'],
      ['flowers', options.garden, 'garden_perimeter'],
      ['ivy', options.garden, 'ivy_trail'],
      ['arcade', options.arcade, 'meshy_garden_arcade'],
      ['canopy', options.canopy, 'meshy_observatory_canopy'],
    ] as const) {
      const parts = buildOpeningDonor(source, prefab)
      parts.forEach((part) => geometries.add(part.geometry))
      for (const part of parts) {
        batch(kind, part.geometry, finish(part.material))
      }
    }
  } catch (error) {
    dispose()
    throw error
  }
  const triangles = meshes.reduce(
    (sum, mesh) =>
      sum +
      ((mesh.geometry.index?.count ??
        mesh.geometry.getAttribute('position').count) /
        3) *
        mesh.count,
    0,
  )
  return {
    root,
    update(snapshot: RunnerSnapshot, deltaSeconds: number) {
      if (disposed) return
      root.position.z = snapshot.courseDistanceMeters
      // Last authored detail ends at 40m, well behind every runner camera by 48m.
      root.visible =
        snapshot.courseDistanceMeters < RUNNER_OPENING_LENGTH_METERS + 8
      if (snapshot.status === 'running' && Number.isFinite(deltaSeconds))
        time += Math.max(0, Math.min(0.1, deltaSeconds))
      water.update(time, options.reducedMotion)
    },
    metrics: () => ({
      drawBatches: disposed || !root.visible ? 0 : meshes.length,
      triangles: disposed || !root.visible ? 0 : triangles,
    }),
    dispose,
  }
}
