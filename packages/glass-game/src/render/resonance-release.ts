// ============================================================
// Resonance presentation — surface-bound fractures, gentle charge tremor and stable release accents.
// ============================================================
//
// Rigid shards remain owned by the vessel renderer. This module borrows the
// intact visual only for its bounded presentation transform and never disposes
// its geometry, materials or textures.

import type { Box3, BufferGeometry } from 'three'
import { CatmullRomCurve3, Color, DynamicDrawUsage, Euler, ExtrudeGeometry, FrontSide, Group, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, Object3D, Quaternion, Shape, SphereGeometry, TubeGeometry, Vector3, } from 'three'
import type { NormalizedResonancePresentationConfig, ResonanceAccentLayout, ResonanceDroplet, ResonanceDust, ResonancePresentationConfig, ResonancePresentationPhase, ResonanceResponseFactors, } from './resonance-release-config'
import { createResonanceAccentLayout, normalizeResonancePresentationConfig, RESONANCE_HIDDEN_SCALE, RESONANCE_QUALITY_CONFIG, resonanceAccentBudget, resonanceResponseFactors, } from './resonance-release-config'
import { createSurfaceCracks, disposeSurfaceCracks, } from './resonance-surface-cracks'

export interface ResonanceRewardVisualContext {
  readonly bounds: Box3
  readonly settings: NormalizedResonancePresentationConfig
}

export interface ResonanceRewardVisual {
  readonly object: Object3D
  dispose(): void
}

export type ResonanceRewardVisualFactory = (
  context: ResonanceRewardVisualContext,
) => ResonanceRewardVisual

export interface CreateResonancePresentationOptions extends ResonancePresentationConfig {
  readonly surfaceGeometry: BufferGeometry
  readonly glassMaterialIndices?: readonly number[]
  readonly intactVisual?: Object3D
  readonly bounds?: Box3
  readonly rewardFactory?: ResonanceRewardVisualFactory
}

export interface ResonancePresentationUpdate {
  readonly deltaSeconds: number
  readonly phase: ResonancePresentationPhase
  readonly chargeProgress: number
  readonly releaseProgress: number
  readonly paused?: boolean
}

export interface ResonancePresentationSnapshot {
  readonly phase: ResonancePresentationPhase
  readonly chargeProgress: number
  readonly releaseProgress: number
  readonly crackStage: number
  readonly visibleCrackSegments: number
  readonly totalCrackSegments: number
  readonly particles: number
  readonly accentTriangles: number
  readonly rewardVisible: boolean
}

export interface ResonancePresentation {
  readonly root: Group
  update(input: ResonancePresentationUpdate): void
  resetCharge(): void
  snapshot(): ResonancePresentationSnapshot
  dispose(): void
}

interface AccentState {
  readonly layout: ResonanceAccentLayout
  readonly spray: readonly Mesh<TubeGeometry, MeshPhysicalMaterial>[]
  readonly sprayMaterial: MeshPhysicalMaterial
  readonly sphereGeometry: SphereGeometry
  readonly droplets: InstancedMesh<SphereGeometry, MeshPhysicalMaterial>
  readonly dropletMaterial: MeshPhysicalMaterial
  readonly dust: InstancedMesh<SphereGeometry, MeshPhysicalMaterial>
  readonly dustMaterial: MeshPhysicalMaterial
}

const TAU = Math.PI * 2
const IDENTITY_QUATERNION = new Quaternion()

export function createResonancePresentation(
  options: CreateResonancePresentationOptions,
): ResonancePresentation {
  if (!options.surfaceGeometry.hasAttribute('position'))
    throw new Error('Resonance presentation requires surface position data.')
  validateGlassMaterialIndices(options.glassMaterialIndices)
  const settings = normalizeResonancePresentationConfig(options)
  const bounds = resolveBounds(options.surfaceGeometry, options.bounds)
  const size = bounds.getSize(new Vector3())
  const centre = bounds.getCenter(new Vector3())
  const root = new Group()
  root.name = 'resonance-release'
  root.userData.excludeFromCameraCollision = true
  const cracks = createSurfaceCracks(
    options.surfaceGeometry,
    bounds,
    settings,
    options.glassMaterialIndices,
  )
  const accentLayout = createResonanceAccentLayout(settings)
  const accentBudget = resonanceAccentBudget(accentLayout, settings.quality)
  const quality = RESONANCE_QUALITY_CONFIG[settings.quality]
  if (accentBudget.renderedTriangles > quality.maximumAccentTriangles)
    throw new Error('Resonance release exceeds its accent triangle budget.')
  const accents = createAccents(root, bounds, settings, accentLayout)
  const rewardFactory =
    options.rewardFactory ?? createResonanceHeartRewardVisual
  let reward: ResonanceRewardVisual
  try {
    const candidate: unknown = rewardFactory({
      bounds: bounds.clone(),
      settings,
    })
    if (!isResonanceRewardVisual(candidate)) {
      bestEffortDisposeRewardCandidate(candidate)
      throw new Error(
        'Resonance reward factories must return an Object3D and disposer.',
      )
    }
    reward = candidate
  } catch (error) {
    disposeSurfaceCracks(cracks)
    disposeAccents(accents)
    throw error
  }
  const rewardAnchor = new Group()
  rewardAnchor.name = 'resonance-reward-anchor'
  rewardAnchor.userData.excludeFromCameraCollision = true
  rewardAnchor.add(reward.object)
  rewardAnchor.scale.setScalar(RESONANCE_HIDDEN_SCALE)
  root.add(rewardAnchor)

  const borrowedVisual = options.intactVisual
  const visualBasePosition = borrowedVisual?.position.clone() ?? new Vector3()
  const visualBaseQuaternion =
    borrowedVisual?.quaternion.clone() ?? new Quaternion()
  const movingTarget = borrowedVisual ?? cracks.root
  if (borrowedVisual) borrowedVisual.add(cracks.root)
  else root.add(cracks.root)
  const scratchMatrix = new Matrix4()
  const scratchPosition = new Vector3()
  const scratchScale = new Vector3()
  const scratchEuler = new Euler()
  const scratchQuaternion = new Quaternion()
  let clock = 0
  let phase: ResonancePresentationPhase = 'idle'
  let chargeProgress = 0
  let releaseProgress = 0
  let crackStage = -1
  let visibleCrackSegments = 0
  let rewardVisible = false
  let disposed = false

  function restoreBorrowedVisual(): void {
    if (!borrowedVisual) {
      cracks.root.position.set(0, 0, 0)
      cracks.root.quaternion.identity()
      return
    }
    borrowedVisual.position.copy(visualBasePosition)
    borrowedVisual.quaternion.copy(visualBaseQuaternion)
  }

  function applyTremor(factors: ResonanceResponseFactors): void {
    restoreBorrowedVisual()
    if (
      settings.reducedMotion ||
      phase !== 'charging' ||
      factors.tremorStrength <= 0
    )
      return
    const wave =
      clock * settings.tremor.frequencyHz * TAU + settings.seed * 0.0001
    const positionAmount =
      settings.tremor.maximumPositionMetres * factors.tremorStrength
    const rotationAmount =
      settings.tremor.maximumRotationRadians * factors.tremorStrength
    movingTarget.position.x += Math.sin(wave) * positionAmount
    movingTarget.position.z +=
      Math.sin(wave * 0.73 + 1.7) * positionAmount * 0.65
    scratchEuler.set(
      Math.sin(wave * 0.61 + 0.8) * rotationAmount * 0.55,
      0,
      Math.sin(wave * 1.07) * rotationAmount,
    )
    scratchQuaternion.setFromEuler(scratchEuler)
    movingTarget.quaternion.multiply(scratchQuaternion)
  }

  function updateCracks(factors: ResonanceResponseFactors): void {
    if (phase === 'charging') {
      crackStage = -1
      settings.crackStages.forEach((stage, index) => {
        if (chargeProgress >= stage.threshold) crackStage = index
      })
    } else if (phase === 'releasing' && factors.crackOpacity > 0) {
      crackStage = settings.crackStages.length - 1
    } else crackStage = -1
    const vertexCount =
      crackStage < 0 ? 0 : (cracks.stageVertexCounts[crackStage] ?? 0)
    cracks.line.geometry.setDrawRange(0, vertexCount)
    visibleCrackSegments = vertexCount / 2
    cracks.line.material.opacity =
      crackStage < 0
        ? 0
        : factors.crackOpacity * settings.crackStages[crackStage]!.opacity
  }

  function setParticle(
    mesh: InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
    scale: number,
  ): void {
    scratchPosition.set(x, y, z)
    scratchScale.setScalar(scale > 0 ? scale : RESONANCE_HIDDEN_SCALE)
    scratchMatrix.compose(scratchPosition, IDENTITY_QUATERNION, scratchScale)
    mesh.setMatrixAt(index, scratchMatrix)
  }

  function updateDroplet(
    droplet: ResonanceDroplet,
    index: number,
    factors: ResonanceResponseFactors,
  ): void {
    const local = Math.max(0, releaseProgress - droplet.delay)
    const progress = Math.min(1, local / droplet.duration)
    const active =
      phase === 'releasing' &&
      releaseProgress >= droplet.delay &&
      progress < 1 &&
      factors.dropletStrength > 0
    const travelled = smoothstep(progress) * droplet.travel * size.y
    const curl = Math.sin(progress * Math.PI) * droplet.curl * size.y
    const originX = centre.x + droplet.origin[0] * size.y
    const originY = bounds.min.y + droplet.origin[1] * size.y
    const originZ = centre.z + droplet.origin[2] * size.y
    setParticle(
      accents.droplets,
      index,
      originX + droplet.direction[0] * travelled - droplet.direction[2] * curl,
      originY +
        droplet.direction[1] * travelled -
        progress * progress * size.y * 0.06,
      originZ + droplet.direction[2] * travelled + droplet.direction[0] * curl,
      active
        ? droplet.size *
            size.y *
            factors.dropletStrength *
            Math.pow(Math.sin(progress * Math.PI), 0.28)
        : 0,
    )
  }

  function updateDust(
    dust: ResonanceDust,
    index: number,
    factors: ResonanceResponseFactors,
  ): void {
    const local = Math.max(0, releaseProgress - dust.delay)
    const progress = Math.min(1, local / dust.duration)
    const active =
      phase === 'releasing' &&
      releaseProgress >= dust.delay &&
      progress < 1 &&
      factors.dustStrength > 0
    const drift = Math.sin(dust.phase + progress * TAU) * 0.0125 * progress
    const y = Math.max(
      bounds.min.y + size.y * 0.006,
      bounds.min.y +
        dust.origin[1] * size.y +
        dust.velocity[1] * local * size.y -
        local * local * size.y * 0.0275,
    )
    setParticle(
      accents.dust,
      index,
      centre.x + (dust.origin[0] + dust.velocity[0] * local + drift) * size.y,
      y,
      centre.z +
        (dust.origin[2] + dust.velocity[2] * local - drift * 0.7) * size.y,
      active
        ? dust.size *
            size.y *
            factors.dustStrength *
            Math.pow(1 - progress, 0.72)
        : 0,
    )
  }

  function updateAccents(factors: ResonanceResponseFactors): void {
    accents.sprayMaterial.opacity = factors.sprayStrength * 0.9
    accents.sprayMaterial.emissiveIntensity = 0.3 + factors.sprayStrength * 1.3
    accents.layout.droplets.forEach((droplet, index) =>
      updateDroplet(droplet, index, factors),
    )
    accents.layout.dust.forEach((dust, index) =>
      updateDust(dust, index, factors),
    )
    accents.droplets.instanceMatrix.needsUpdate = true
    accents.dust.instanceMatrix.needsUpdate = true
    accents.dropletMaterial.emissiveIntensity =
      0.4 + factors.dropletStrength * 1.2
    accents.dustMaterial.opacity = factors.dustStrength * 0.62
  }

  function updateReward(factors: ResonanceResponseFactors): void {
    let reveal = factors.rewardProgress
    if (settings.reducedMotion && reveal > 0) reveal = 1
    rewardVisible = reveal > 0
    rewardAnchor.scale.setScalar(
      rewardVisible
        ? Math.max(RESONANCE_HIDDEN_SCALE, reveal)
        : RESONANCE_HIDDEN_SCALE,
    )
    rewardAnchor.position.set(
      centre.x,
      bounds.min.y + size.y * (0.58 + reveal * 0.62),
      centre.z + size.z * 0.18,
    )
    rewardAnchor.rotation.y = settings.reducedMotion ? 0 : (1 - reveal) * -0.18
  }

  function render(factors: ResonanceResponseFactors): void {
    applyTremor(factors)
    updateCracks(factors)
    updateAccents(factors)
    updateReward(factors)
  }

  render(resonanceResponseFactors(settings, phase, 0, 0))

  return {
    root,
    update(input): void {
      if (disposed) throw new Error('Resonance presentation is disposed.')
      const deltaSeconds = finiteNonNegative(input.deltaSeconds, 'deltaSeconds')
      phase = input.phase
      chargeProgress = unit(input.chargeProgress, 'chargeProgress')
      releaseProgress = unit(input.releaseProgress, 'releaseProgress')
      if (
        phase === 'charging' &&
        !settings.reducedMotion &&
        input.paused !== true &&
        deltaSeconds > 0
      )
        clock += Math.min(deltaSeconds, 0.1)
      render(
        resonanceResponseFactors(
          settings,
          phase,
          chargeProgress,
          releaseProgress,
        ),
      )
    },
    resetCharge(): void {
      if (disposed) throw new Error('Resonance presentation is disposed.')
      phase = 'idle'
      chargeProgress = 0
      releaseProgress = 0
      clock = 0
      render(resonanceResponseFactors(settings, 'idle', 0, 0))
    },
    snapshot(): ResonancePresentationSnapshot {
      return {
        phase,
        chargeProgress,
        releaseProgress,
        crackStage,
        visibleCrackSegments,
        totalCrackSegments: cracks.totalSegments,
        particles: accentBudget.particles,
        accentTriangles: accentBudget.renderedTriangles,
        rewardVisible,
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      restoreBorrowedVisual()
      cracks.root.removeFromParent()
      root.removeFromParent()
      reward.object.removeFromParent()
      bestEffortDisposeRewardCandidate(reward)
      disposeSurfaceCracks(cracks)
      disposeAccents(accents)
      rewardAnchor.clear()
      root.clear()
    },
  }
}

function isResonanceRewardVisual(
  candidate: unknown,
): candidate is ResonanceRewardVisual {
  if (candidate === null || typeof candidate !== 'object') return false
  const record = candidate as Record<string, unknown>
  return (
    record.object instanceof Object3D && typeof record.dispose === 'function'
  )
}

function bestEffortDisposeRewardCandidate(candidate: unknown): void {
  if (candidate === null || typeof candidate !== 'object') return
  const dispose = (candidate as Record<string, unknown>).dispose
  if (typeof dispose !== 'function') return
  try {
    dispose.call(candidate)
  } catch {
    // Preserve the invalid factory error while presentation resources are reclaimed.
  }
}

export function createResonanceHeartRewardVisual(
  context: ResonanceRewardVisualContext,
): ResonanceRewardVisual {
  const shape = new Shape()
  shape.moveTo(0, -0.48)
  shape.bezierCurveTo(-0.62, -0.12, -0.56, 0.42, -0.25, 0.47)
  shape.bezierCurveTo(-0.08, 0.5, 0, 0.36, 0, 0.24)
  shape.bezierCurveTo(0, 0.36, 0.08, 0.5, 0.25, 0.47)
  shape.bezierCurveTo(0.56, 0.42, 0.62, -0.12, 0, -0.48)
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: context.settings.quality === 'high' ? 3 : 2,
    bevelSize: 0.055,
    bevelThickness: 0.045,
    curveSegments: context.settings.quality === 'high' ? 16 : 12,
    steps: 1,
  })
  geometry.name = 'resonance-heart-geometry'
  geometry.center()
  geometry.computeVertexNormals()
  const material = new MeshPhysicalMaterial({
    name: 'resonance-heart-material',
    color: context.settings.palette.heart,
    emissive: context.settings.palette.heartGlow,
    emissiveIntensity: 0.18 + context.settings.intensity * 0.05,
    metalness: 0.48,
    roughness: 0.16,
    clearcoat: 0.95,
    clearcoatRoughness: 0.06,
    iridescence: 0.22,
    iridescenceThicknessRange: [120, 220],
    side: FrontSide,
  })
  const object = new Mesh(geometry, material)
  object.name = 'resonance-heart-reward'
  object.userData.excludeFromCameraCollision = true
  const height = context.bounds.max.y - context.bounds.min.y
  object.scale.setScalar(height * 0.16)
  object.rotation.y = -0.08
  let disposed = false
  return {
    object,
    dispose(): void {
      if (disposed) return
      disposed = true
      geometry.dispose()
      material.dispose()
    },
  }
}

function validateGlassMaterialIndices(
  glassMaterialIndices: readonly number[] | undefined,
): void {
  if (
    glassMaterialIndices?.some(
      (index) => !Number.isInteger(index) || index < 0,
    ) === true
  )
    throw new Error(
      'Resonance glassMaterialIndices must contain non-negative integers.',
    )
}

function createAccents(
  root: Group,
  bounds: Box3,
  settings: NormalizedResonancePresentationConfig,
  layout: ResonanceAccentLayout,
): AccentState {
  const quality = RESONANCE_QUALITY_CONFIG[settings.quality]
  const size = bounds.getSize(new Vector3())
  const centre = bounds.getCenter(new Vector3())
  const sprayMaterial = new MeshPhysicalMaterial({
    name: 'resonance-spray-material',
    color: settings.palette.spray,
    emissive: settings.palette.heartGlow,
    emissiveIntensity: 0.3,
    metalness: 0.2,
    roughness: 0.085,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    iridescence: 0.55,
    iridescenceThicknessRange: [100, 260],
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: FrontSide,
  })
  const spray = layout.spray.map((path, index) => {
    const curve = new CatmullRomCurve3(
      path.points.map(
        (point) =>
          new Vector3(
            centre.x + point[0] * size.y,
            bounds.min.y + point[1] * size.y,
            centre.z + point[2] * size.y,
          ),
      ),
      false,
      'centripetal',
      0.5,
    )
    const geometry = new TubeGeometry(
      curve,
      quality.spraySegments,
      path.radiusScale * size.y,
      quality.sprayRadialSegments,
      false,
    )
    geometry.name = `resonance-spray-geometry-${index}`
    const mesh = new Mesh(geometry, sprayMaterial)
    mesh.name = `resonance-spray-${index}`
    mesh.frustumCulled = false
    mesh.userData.excludeFromCameraCollision = true
    root.add(mesh)
    return mesh
  })
  const sphereGeometry = new SphereGeometry(
    1,
    quality.sphereWidthSegments,
    quality.sphereHeightSegments,
  )
  sphereGeometry.name = 'resonance-shared-particle-geometry'
  const dropletMaterial = new MeshPhysicalMaterial({
    name: 'resonance-droplet-material',
    color: 0xffffff,
    emissive: settings.palette.heartGlow,
    emissiveIntensity: 0.4,
    metalness: 0.24,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    iridescence: 0.42,
    iridescenceThicknessRange: [110, 250],
    side: FrontSide,
  })
  const droplets = new InstancedMesh(
    sphereGeometry,
    dropletMaterial,
    layout.droplets.length,
  )
  droplets.name = 'resonance-bright-droplets'
  droplets.instanceMatrix.setUsage(DynamicDrawUsage)
  droplets.frustumCulled = false
  droplets.userData.excludeFromCameraCollision = true
  layout.droplets.forEach((droplet, index) => {
    droplets.setColorAt(
      index,
      new Color(settings.palette.droplets[droplet.colorIndex]),
    )
  })
  if (droplets.instanceColor) droplets.instanceColor.needsUpdate = true
  const dustMaterial = new MeshPhysicalMaterial({
    name: 'resonance-dust-material',
    color: settings.palette.dust,
    emissive: settings.palette.dust,
    emissiveIntensity: 0.12,
    metalness: 0.14,
    roughness: 0.22,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: FrontSide,
  })
  const dust = new InstancedMesh(
    sphereGeometry,
    dustMaterial,
    layout.dust.length,
  )
  dust.name = 'resonance-fading-dust'
  dust.instanceMatrix.setUsage(DynamicDrawUsage)
  dust.frustumCulled = false
  dust.userData.excludeFromCameraCollision = true
  root.add(droplets, dust)
  return {
    layout,
    spray,
    sprayMaterial,
    sphereGeometry,
    droplets,
    dropletMaterial,
    dust,
    dustMaterial,
  }
}

function resolveBounds(geometry: BufferGeometry, supplied?: Box3): Box3 {
  const bounds =
    supplied?.clone() ??
    (() => {
      const clone = geometry.clone()
      clone.computeBoundingBox()
      const result = clone.boundingBox?.clone()
      clone.dispose()
      return result
    })()
  if (!bounds || bounds.isEmpty())
    throw new Error('Resonance presentation requires non-empty surface bounds.')
  for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()])
    if (!Number.isFinite(value))
      throw new Error('Resonance presentation bounds must be finite.')
  const size = bounds.getSize(new Vector3())
  if (size.x <= 0 || size.y <= 0 || size.z <= 0)
    throw new Error('Resonance presentation bounds must have positive volume.')
  return bounds
}

function disposeAccents(accents: AccentState): void {
  accents.spray.forEach((mesh) => {
    mesh.removeFromParent()
    mesh.geometry.dispose()
  })
  accents.droplets.removeFromParent()
  accents.dust.removeFromParent()
  accents.droplets.dispose()
  accents.dust.dispose()
  accents.sphereGeometry.dispose()
  accents.sprayMaterial.dispose()
  accents.dropletMaterial.dispose()
  accents.dustMaterial.dispose()
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`Resonance ${label} must be finite and non-negative.`)
  return value
}

function unit(value: number, label: string): number {
  if (!Number.isFinite(value))
    throw new Error(`Resonance ${label} must be finite.`)
  return Math.min(1, Math.max(0, value))
}

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}
