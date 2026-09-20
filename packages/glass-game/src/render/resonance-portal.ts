// Resonance portal — a bounds-fitted brass and iridescent veil with a bounded finish flourish.

import { AdditiveBlending, CircleGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, TorusGeometry, Vector3, } from 'three'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { deriveExitPortalGeometry } from '../core/exit-portal'
import type { MuseumMaterials } from './materials'

const SPARKLE_COUNT = 20
export const EXIT_CELEBRATION_SECONDS = 1.2
export const EXIT_REDUCED_CELEBRATION_SECONDS = 0.24

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value)
}

export function createResonancePortal(
  exit: LevelDefinition['exit'],
  materials: MuseumMaterials,
  reducedMotion: boolean,
) {
  const geometry = deriveExitPortalGeometry(exit)
  const root = new Group()
  root.name = 'resonance-veil'
  root.position.copy(geometry.center)
  root.rotation.y = geometry.yaw

  const face = new Group()
  face.name = 'resonance-veil-face'
  root.add(face)

  const outerHalo = new Mesh(
    new TorusGeometry(0.5, 0.026, 8, 64),
    materials.gold,
  )
  outerHalo.name = 'resonance-veil-outer-halo'
  outerHalo.scale.set(geometry.width + 0.14, geometry.height + 0.14, 1)
  face.add(outerHalo)

  const innerMaterial = new MeshBasicMaterial({
    color: 0xffe3a6,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: DoubleSide,
  })
  innerMaterial.forceSinglePass = true
  const innerHalo = new Mesh(
    new TorusGeometry(0.5, 0.009, 6, 64),
    innerMaterial,
  )
  innerHalo.name = 'resonance-veil-inner-halo'
  innerHalo.position.z = 0.008
  innerHalo.scale.set(geometry.width - 0.04, geometry.height - 0.04, 1)
  face.add(innerHalo)

  const veilMaterial = new MeshPhysicalMaterial({
    color: 0x8de8df,
    emissive: 0x1d7b78,
    emissiveIntensity: 0.12,
    metalness: 0,
    roughness: 0.08,
    ior: 1.28,
    iridescence: 1,
    iridescenceIOR: 1.45,
    iridescenceThicknessRange: [120, 460],
    clearcoat: 1,
    envMapIntensity: 1.4,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    side: DoubleSide,
  })
  veilMaterial.forceSinglePass = true
  const veil = new Mesh(new CircleGeometry(0.5, 64), veilMaterial)
  veil.name = 'resonance-veil-surface'
  veil.scale.set(geometry.width, geometry.height, 1)
  face.add(veil)

  const sparkleMaterial = new MeshBasicMaterial({
    color: 0xffefbd,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  })
  sparkleMaterial.forceSinglePass = true
  const sparkles = new InstancedMesh(
    new CircleGeometry(0.018, 6),
    sparkleMaterial,
    SPARKLE_COUNT,
  )
  sparkles.name = 'resonance-veil-sparkles'
  sparkles.frustumCulled = false
  const matrix = new Matrix4()
  const position = new Vector3()
  for (let index = 0; index < SPARKLE_COUNT; index++) {
    const angle = (index / SPARKLE_COUNT) * Math.PI * 2 + (index % 3) * 0.17
    const radius = 0.3 + (index % 5) * 0.035
    position.set(
      Math.cos(angle) * geometry.width * radius,
      Math.sin(angle) * geometry.height * radius,
      0.02 + (index % 4) * 0.006,
    )
    matrix.makeTranslation(position.x, position.y, position.z)
    sparkles.setMatrixAt(index, matrix)
  }
  sparkles.instanceMatrix.needsUpdate = true
  sparkles.visible = false
  root.add(sparkles)

  let previousComplete: boolean | undefined
  let celebrationSeconds = Number.POSITIVE_INFINITY
  let completionDelivered = false

  return {
    root,
    update(snapshot: GameSnapshot, delta: number): boolean {
      const ready = exit.requiresCompleted.every((id) =>
        snapshot.completedBreakableIds.includes(id),
      )
      if (previousComplete === undefined && snapshot.complete)
        completionDelivered = true
      else if (previousComplete === false && snapshot.complete) {
        celebrationSeconds = 0
        completionDelivered = false
      }
      previousComplete = snapshot.complete

      const duration = reducedMotion
        ? EXIT_REDUCED_CELEBRATION_SECONDS
        : EXIT_CELEBRATION_SECONDS
      const celebrating = celebrationSeconds < duration
      if (celebrating)
        celebrationSeconds = Math.min(
          duration,
          celebrationSeconds + Math.max(0, delta),
        )
      const progress = celebrating ? celebrationSeconds / duration : 1

      const baseOpacity = ready ? 0.34 : 0.06
      const pulse =
        ready && !reducedMotion && !snapshot.complete
          ? 1 + Math.sin(snapshot.elapsedSeconds * 2.4) * 0.014
          : 1
      const release =
        celebrating && !reducedMotion ? Math.sin(progress * Math.PI) : 0
      face.scale.setScalar(pulse + release * 0.16)
      face.rotation.z =
        ready && !reducedMotion
          ? Math.sin(snapshot.elapsedSeconds * 0.42) * 0.012
          : 0
      veilMaterial.opacity = celebrating
        ? baseOpacity + (1 - progress) * (reducedMotion ? 0.3 : 0.24)
        : baseOpacity
      veilMaterial.emissiveIntensity = ready ? 0.28 : 0.08
      innerMaterial.opacity = ready ? 0.78 : 0.24
      sparkles.visible = celebrating
      sparkleMaterial.opacity = celebrating
        ? Math.sin(progress * Math.PI) * (reducedMotion ? 0.35 : 0.92)
        : 0
      sparkles.scale.setScalar(
        reducedMotion ? 1 : 0.65 + smoothstep(progress) * 0.9,
      )

      if (
        snapshot.complete &&
        celebrationSeconds >= duration &&
        !completionDelivered
      ) {
        completionDelivered = true
        return true
      }
      return false
    },
  }
}
