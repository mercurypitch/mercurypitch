// Shatter burst — a few instanced draws turn deterministic chip plans into varied, allocation-free flight.

import type { Box3 } from 'three'
import { AdditiveBlending, Color, ConeGeometry, DoubleSide, DynamicDrawUsage, Euler, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshPhysicalMaterial, OctahedronGeometry, Quaternion, TetrahedronGeometry, Vector3, } from 'three'
import type { ShatterParticlePlan, ShatterProfile } from './shatter-motion'
import { planShatterMicroBurst } from './shatter-motion'

export interface ShatterBurst {
  readonly chipCount: number
  readonly glintCount: number
  readonly root: Group
  dispose(): void
  update(flightSeconds: number, fade: number, visible: boolean): void
}

interface InstanceLane {
  mesh: InstancedMesh
  particles: readonly ShatterParticlePlan[]
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function createShatterBurst(
  targetId: string,
  profile: ShatterProfile,
  bounds: Box3,
  tint: number,
): ShatterBurst {
  const plan = planShatterMicroBurst(targetId, profile, bounds)
  const root = new Group()
  root.name = `shatter-burst-${targetId}`
  root.visible = false
  root.userData.shatterProfile = profile
  root.userData.chipCount = plan.chips.length
  root.userData.glintCount = plan.glints.length

  const chipMaterial = new MeshPhysicalMaterial({
    clearcoat: 1,
    color: tint,
    envMapIntensity: 1.3,
    ior: 1.46,
    metalness: 0,
    roughness: 0.08,
    side: DoubleSide,
    thickness: 0.018,
    transmission: 0.82,
    // setColorAt uses instanceColor independently of vertexColors. Enabling
    // vertexColors without a geometry color attribute multiplies chips by black.
  })
  const chipGeometries = [
    new TetrahedronGeometry(1, 0),
    new OctahedronGeometry(1, 0),
    new ConeGeometry(1, 1, 3, 1, false),
  ] as const
  const particleLanes: ShatterParticlePlan[][] = [[], [], []]
  for (const particle of plan.chips)
    particleLanes[particle.shape].push(particle)
  const baseColor = new Color(tint)
  const instanceColor = new Color()
  const lanes: InstanceLane[] = particleLanes.map((particles, shape) => {
    const mesh = new InstancedMesh(
      chipGeometries[shape],
      chipMaterial,
      particles.length,
    )
    mesh.name = `shatter-chips-${shape}-${targetId}`
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    particles.forEach((particle, index) => {
      const lift = ((index * 17 + shape * 11) % 13) / 160
      instanceColor.copy(baseColor).offsetHSL(0.01 + lift, 0, lift)
      mesh.setColorAt(index, instanceColor)
      particle.scale.multiplyScalar(shape === 2 ? 0.86 : 1)
    })
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    root.add(mesh)
    return { mesh, particles }
  })

  const glintMaterial = new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: 0xeaffff,
    depthWrite: false,
    opacity: 0,
    side: DoubleSide,
    transparent: true,
  })
  const glintGeometry = new OctahedronGeometry(1, 0)
  const glints = new InstancedMesh(
    glintGeometry,
    glintMaterial,
    plan.glints.length,
  )
  glints.name = `shatter-glints-${targetId}`
  glints.castShadow = false
  glints.receiveShadow = false
  glints.frustumCulled = false
  glints.instanceMatrix.setUsage(DynamicDrawUsage)
  root.add(glints)

  const matrix = new Matrix4()
  const position = new Vector3()
  const rotation = new Euler()
  const quaternion = new Quaternion()
  const scale = new Vector3()
  let disposed = false

  function writeParticle(
    particle: ShatterParticlePlan,
    flightSeconds: number,
    fade: number,
    gravity: number,
    sparkle: boolean,
  ): void {
    const localTime = flightSeconds - particle.delay
    const elapsed = Math.max(0, localTime)
    position.copy(particle.origin).addScaledVector(particle.velocity, elapsed)
    position.y -= gravity * elapsed * elapsed
    rotation.set(
      particle.rotation.x + particle.spin.x * elapsed,
      particle.rotation.y + particle.spin.y * elapsed,
      particle.rotation.z + particle.spin.z * elapsed,
    )
    quaternion.setFromEuler(rotation)
    const emergence = localTime <= 0 ? 0.001 : Math.min(1, localTime / 0.055)
    const shimmer = sparkle
      ? 0.58 + Math.abs(Math.sin((elapsed + particle.delay) * 24)) * 0.42
      : 1
    scale
      .copy(particle.scale)
      .multiplyScalar(Math.max(0.001, emergence * (1 - fade) * shimmer))
    matrix.compose(position, quaternion, scale)
  }

  return {
    chipCount: plan.chips.length,
    glintCount: plan.glints.length,
    root,
    update(flightSeconds, fade, visible) {
      if (disposed) return
      root.visible = visible
      if (!visible) return
      const safeFlight = Math.max(0, flightSeconds)
      const safeFade = clampUnit(fade)
      for (const lane of lanes) {
        for (let index = 0; index < lane.particles.length; index++) {
          writeParticle(
            lane.particles[index],
            safeFlight,
            safeFade,
            2.05,
            false,
          )
          lane.mesh.setMatrixAt(index, matrix)
        }
        lane.mesh.instanceMatrix.needsUpdate = true
      }
      for (let index = 0; index < plan.glints.length; index++) {
        writeParticle(plan.glints[index], safeFlight, safeFade, 1.35, true)
        glints.setMatrixAt(index, matrix)
      }
      glints.instanceMatrix.needsUpdate = true
      glintMaterial.opacity =
        clampUnit(safeFlight / 0.045) * (1 - safeFade) * 0.86
    },
    dispose() {
      if (disposed) return
      disposed = true
      root.removeFromParent()
      root.clear()
      for (const lane of lanes) lane.mesh.dispose()
      glints.dispose()
      for (const geometry of chipGeometries) geometry.dispose()
      glintGeometry.dispose()
      chipMaterial.dispose()
      glintMaterial.dispose()
    },
  }
}
