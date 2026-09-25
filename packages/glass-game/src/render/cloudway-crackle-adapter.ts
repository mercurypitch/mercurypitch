// Cloudway crackle adapter — preserve source surfaces and animate authored shards from simulation snapshots, without live physics.

import type { Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, } from 'three'
import { Group, Matrix4, Vector3 } from 'three'
import type { PlatformDefinition, PlatformRuntimeSnapshot } from '../contracts'
import { validateCloudwayCrackleDonor } from './cloudway-crackle-contract'

export interface CloudwayCrackleMaterialBinding {
  readonly mesh: string
  readonly kind: 'glass' | 'opaque'
  /** Borrowed PBR material. The adapter owns geometry copies only. */
  readonly material: MeshStandardMaterial
}

export interface CloudwayCrackleAdapter {
  readonly root: Group
  update(snapshot: PlatformRuntimeSnapshot): void
  dispose(): void
}

function check(condition: unknown, detail: string): asserts condition {
  if (condition !== true) throw new Error(`Cloudway crackle adapter: ${detail}`)
}

export function createCloudwayCrackleAdapter(options: {
  readonly source: Object3D
  readonly platform: PlatformDefinition
  readonly materials: readonly CloudwayCrackleMaterialBinding[]
}): CloudwayCrackleAdapter {
  const { source, platform } = options
  const validated = validateCloudwayCrackleDonor(source, platform)
  const meshes = new Map<string, Mesh>()
  for (const role of validated.visual)
    role.traverse((node) => {
      if ((node as Mesh).isMesh) meshes.set(node.name, node as Mesh)
    })
  const bindings = new Map<string, MeshStandardMaterial>()
  for (const binding of options.materials) {
    check(
      meshes.has(binding.mesh) && !bindings.has(binding.mesh),
      `unknown or duplicate binding ${binding.mesh}.`,
    )
    const m = binding.material
    check(m?.isMeshStandardMaterial, 'bindings require PBR materials.')
    const p = m as MeshPhysicalMaterial
    const transmission = p.isMeshPhysicalMaterial ? p.transmission : 0
    check(
      Number.isFinite(transmission) &&
        transmission >= 0 &&
        transmission <= 1 &&
        Number.isFinite(m.metalness) &&
        m.metalness >= 0 &&
        m.metalness <= 1 &&
        Number.isFinite(m.roughness) &&
        m.roughness >= 0 &&
        m.roughness <= 1 &&
        !m.transparent &&
        m.opacity === 1,
      'materials must use finite opaque-surface PBR or physical transmission.',
    )
    check(
      binding.kind === 'glass'
        ? p.isMeshPhysicalMaterial && transmission > 0 && m.metalness === 0
        : binding.kind === 'opaque' && transmission === 0,
      'material does not match its reviewed region kind.',
    )
    bindings.set(binding.mesh, m)
  }
  check(
    bindings.size === meshes.size,
    'every visible mesh needs a reviewed material binding.',
  )

  const root = new Group()
  root.name = `${platform.id}__crackle-art`
  root.position.set(
    (platform.minX + platform.maxX) / 2,
    platform.top,
    (platform.minZ + platform.maxZ) / 2,
  )
  root.rotation.y = (validated.turns * Math.PI) / 2
  root.visible = false
  const ownedGeometry = new Set<Mesh['geometry']>()

  // Compute local authored matrices without touching source parent/world state.
  function sourceRelative(node: Object3D): Matrix4 {
    const chain: Object3D[] = []
    for (
      let current: Object3D | null = node;
      current !== source;
      current = current.parent
    ) {
      check(current !== null, 'role must remain below the donor root.')
      chain.unshift(current)
    }
    const matrix = new Matrix4()
    for (const current of chain) {
      const local = current.matrixAutoUpdate
        ? new Matrix4().compose(
            current.position,
            current.quaternion,
            current.scale,
          )
        : current.matrix
      matrix.multiply(local)
    }
    return matrix
  }

  function cloneRole(authored: Object3D) {
    const motion = new Group()
    const copy = authored.clone(true)
    copy.matrix.copy(sourceRelative(authored))
    const centre = new Vector3().setFromMatrixPosition(copy.matrix)
    motion.position.copy(centre)
    copy.matrix.setPosition(0, 0, 0)
    copy.matrixAutoUpdate = false
    copy.traverse((node) => {
      // Blender viewport visibility does not define runtime role visibility.
      node.visible = true
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.geometry = mesh.geometry.clone()
      ownedGeometry.add(mesh.geometry)
      mesh.material = bindings.get(mesh.name)!
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.userData.excludeFromCameraCollision = true
    })
    motion.add(copy)
    root.add(motion)
    return { motion, centre }
  }
  let intact: ReturnType<typeof cloneRole>
  let shards: ReturnType<typeof cloneRole>[]
  try {
    intact = cloneRole(validated.intact)
    for (const role of validated.persistent) cloneRole(role)
    shards = validated.shards.map(cloneRole)
  } catch (error) {
    ownedGeometry.forEach((geometry) => geometry.dispose())
    root.clear()
    throw error
  }
  let disposed = false
  return {
    root,
    update(snapshot) {
      check(!disposed, 'adapter is disposed.')
      check(
        snapshot.id === platform.id,
        'snapshot belongs to another platform.',
      )
      check(
        ['intact', 'warning', 'released', 'resetting'].includes(
          snapshot.phase,
        ) &&
          Number.isFinite(snapshot.phaseProgress) &&
          snapshot.phaseProgress >= 0 &&
          snapshot.phaseProgress <= 1 &&
          [snapshot.offset.x, snapshot.offset.y, snapshot.offset.z].every(
            (value) => Number.isFinite(value) && Math.abs(value) < 1e-6,
          ),
        'invalid crackle snapshot.',
      )
      const fractured =
        snapshot.phase === 'released' || snapshot.phase === 'resetting'
      const progress =
        snapshot.phase === 'resetting'
          ? 1 - snapshot.phaseProgress
          : snapshot.phaseProgress
      intact.motion.visible = !fractured
      intact.motion.rotation.z =
        snapshot.phase === 'warning'
          ? Math.sin(snapshot.phaseProgress * Math.PI * 18) *
            snapshot.phaseProgress *
            0.003
          : 0
      shards.forEach((shard, index) => {
        shard.motion.visible = fractured
        // Repeated snapshots produce identical transforms, including pause and reset.
        const t = fractured ? progress : 0
        const angle = index * 2.399963229728653
        shard.motion.position.set(
          shard.centre.x + Math.cos(angle) * t * 0.25,
          shard.centre.y - 3.8 * t * t,
          shard.centre.z + Math.sin(angle) * t * 0.25,
        )
        shard.motion.rotation.set(
          t * (index % 2 ? 0.65 : -0.5),
          t * 0.25,
          t * ((index % 3) - 1) * 0.45,
        )
      })
      root.visible = true
    },
    dispose() {
      if (disposed) return
      disposed = true
      root.visible = false
      ownedGeometry.forEach((geometry) => geometry.dispose())
      ownedGeometry.clear()
      root.clear()
      root.removeFromParent()
    },
  }
}
