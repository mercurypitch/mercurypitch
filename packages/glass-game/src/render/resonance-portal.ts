// Resonance portal — a bounds-fitted brass and iridescent veil with a bounded finish flourish.

import { AdditiveBlending, CircleGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, TorusGeometry, Vector3, } from 'three'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { deriveExitPortalGeometry } from '../core/exit-portal'
import type { MuseumMaterials } from './materials'

const SPARKLE_COUNT = 20
const RIM_FLOOR_CLEARANCE = 0.08
const OUTER_RIM_RADIUS = 0.526
const SEAL_OPEN_SECONDS = 0.6
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
  // The authored exit is a walk-through aperture. Its decorative rim is wider
  // and breathes during the flourish, so keep that entire rim above the floor
  // without moving the gameplay crossing plane or requiring a jump.
  const keepRimAboveFloor = () => {
    const verticalRadius =
      OUTER_RIM_RADIUS *
      face.scale.y *
      (Math.abs(Math.sin(face.rotation.z)) * outerHalo.scale.x +
        Math.abs(Math.cos(face.rotation.z)) * outerHalo.scale.y)
    face.position.y = RIM_FLOOR_CLEARANCE + verticalRadius - geometry.height / 2
  }
  keepRimAboveFloor()

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
    roughness: 0.7,
    ior: 1.28,
    iridescence: 1,
    iridescenceIOR: 1.45,
    iridescenceThicknessRange: [120, 460],
    clearcoat: 1,
    envMapIntensity: 1.4,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    side: DoubleSide,
  })
  veilMaterial.forceSinglePass = true
  const veil = new Mesh(new CircleGeometry(0.5, 64), veilMaterial)
  veil.name = 'resonance-veil-surface'
  veil.scale.set(geometry.width, geometry.height, 1)
  face.add(veil)

  // A frosted face closes the aperture; each gold seal belongs to a required
  // exhibit. These share one small geometry/material, with no transmission pass.
  const sealMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: DoubleSide,
  })
  sealMaterial.forceSinglePass = true
  const seals = new InstancedMesh(
    new CircleGeometry(0.048, 4),
    sealMaterial,
    exit.requiresCompleted.length,
  )
  seals.name = 'resonance-veil-seals'
  const sealedColor = new Color(0x916f35)
  const completedColor = new Color(0xffedb9)
  const frostedColor = new Color(0x9bbdb8)
  const openColor = veilMaterial.color.clone()
  const sealStates: boolean[] = []
  const sealMatrix = new Matrix4()
  const sealSpacing = Math.min(
    0.18,
    (geometry.width * 0.65) / Math.max(1, seals.count),
  )
  for (let index = 0; index < seals.count; index++) {
    sealMatrix.makeTranslation(
      (index - (seals.count - 1) / 2) * sealSpacing,
      geometry.height * 0.24,
      0.012,
    )
    seals.setMatrixAt(index, sealMatrix)
    seals.setColorAt(index, sealedColor)
  }
  face.add(seals)

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
  let lowestSparkle = 0
  for (let index = 0; index < SPARKLE_COUNT; index++) {
    const angle = (index / SPARKLE_COUNT) * Math.PI * 2 + (index % 3) * 0.17
    const radius = 0.3 + (index % 5) * 0.035
    position.set(
      Math.cos(angle) * geometry.width * radius,
      Math.sin(angle) * geometry.height * radius,
      0.02 + (index % 4) * 0.006,
    )
    lowestSparkle = Math.min(lowestSparkle, position.y - 0.018)
    matrix.makeTranslation(position.x, position.y, position.z)
    sparkles.setMatrixAt(index, matrix)
  }
  sparkles.instanceMatrix.needsUpdate = true
  sparkles.visible = false
  root.add(sparkles)

  let previousComplete: boolean | undefined
  let previousReady: boolean | undefined
  let sealOpening = 0
  let celebrationSeconds = Number.POSITIVE_INFINITY
  let completionDelivered = false

  return {
    root,
    update(snapshot: GameSnapshot, delta: number): boolean {
      const ready = exit.requiresCompleted.every((id) =>
        snapshot.completedBreakableIds.includes(id),
      )
      sealOpening = !ready
        ? 0
        : previousReady === undefined || reducedMotion
          ? 1
          : Math.min(1, sealOpening + Math.max(0, delta) / SEAL_OPEN_SECONDS)
      previousReady = ready
      const openAmount = smoothstep(sealOpening)
      seals.visible = seals.count > 0 && openAmount < 1
      sealMaterial.opacity = 1 - openAmount
      if (seals.visible) {
        for (let index = 0; index < seals.count; index++) {
          const complete = snapshot.completedBreakableIds.includes(
            exit.requiresCompleted[index]!,
          )
          if (sealStates[index] === complete) continue
          sealStates[index] = complete
          seals.setColorAt(index, complete ? completedColor : sealedColor)
          if (seals.instanceColor !== null)
            seals.instanceColor.needsUpdate = true
        }
      }
      veilMaterial.color.copy(frostedColor).lerp(openColor, openAmount)
      veilMaterial.roughness = 0.7 + (0.08 - 0.7) * openAmount
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

      const baseOpacity = 0.68 + (0.34 - 0.68) * openAmount
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
      keepRimAboveFloor()
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

      sparkles.position.y = Math.max(
        face.position.y,
        RIM_FLOOR_CLEARANCE -
          geometry.height / 2 -
          lowestSparkle * sparkles.scale.y,
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
