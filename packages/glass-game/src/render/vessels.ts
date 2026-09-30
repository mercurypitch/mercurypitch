// ============================================================
// Adventure vessels — dimensional glass, an earned stress glow and bounded shatter.
// ============================================================

import type { BufferGeometry, Material, Texture, Vector3 } from 'three'
import { Box3, BoxGeometry, DoubleSide, EdgesGeometry, Group, LatheGeometry, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PlaneGeometry, RingGeometry, Vector2, } from 'three'
import { DEFAULT_EXHIBIT_MOUNT_HEIGHT, PORTRAIT_EXHIBIT_ENVELOPE, } from '../content/solid-props'
import type { BreakableDefinition, BreakableSnapshot } from '../contracts'
import { SHATTER_PRESENTATION_TIMING } from '../core/shatter-presentation'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import type { FracturePiece } from './fracture'
import { fractureGeometry } from './fracture'
import { createMaterialLibrary } from './material-library'
import type { ResonancePresentation, ResonanceRewardVisualFactory, } from './resonance-release'
import { createResonancePresentation } from './resonance-release'
import { RESONANCE_PEARL_PALETTE } from './resonance-release-config'
import type { ShatterBurst } from './shatter-burst'
import { createShatterBurst } from './shatter-burst'
import { fallbackShatterProfile, planShatterShardMotion, } from './shatter-motion'

/** Fallbacks and authored GLBs share the same recipe-sized, floor-based envelope. */
function fitDisplayHeight(
  geometry: BufferGeometry,
  height: number,
): BufferGeometry {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!
  const scale = height / Math.max(0.001, bounds.max.y - bounds.min.y)
  geometry.translate(0, -bounds.min.y, 0)
  geometry.scale(scale, scale, scale)
  return geometry
}

export function createVesselGeometry(variant: string): BufferGeometry {
  const recipe = getBreakableRenderRecipe(variant)
  const shape = recipe.fallbackShape
  if (shape === 'slab') {
    const envelope = recipe.barrierEnvelope ?? PORTRAIT_EXHIBIT_ENVELOPE
    const geometry = new BoxGeometry(
      envelope.width,
      envelope.height,
      envelope.depth,
      6,
      8,
      1,
    )
    geometry.translate(0, envelope.height / 2, 0)
    return fitDisplayHeight(geometry, recipe.displayHeight)
  }
  const profile =
    shape === 'goblet'
      ? [
          [0, 0],
          [0.14, 0],
          [0.16, 0.025],
          [0.055, 0.05],
          [0.025, 0.09],
          [0.025, 0.3],
          [0.095, 0.33],
          [0.17, 0.4],
          [0.2, 0.53],
          [0.19, 0.66],
          [0.177, 0.66],
          [0.185, 0.53],
          [0.155, 0.41],
          [0.08, 0.35],
          [0, 0.34],
        ]
      : shape === 'fluted'
        ? [
            [0, 0],
            [0.12, 0],
            [0.17, 0.05],
            [0.13, 0.18],
            [0.11, 0.42],
            [0.13, 0.65],
            [0.19, 0.78],
            [0.173, 0.78],
            [0.115, 0.64],
            [0.095, 0.42],
            [0.115, 0.18],
            [0.15, 0.065],
            [0, 0.035],
          ]
        : [
            [0, 0],
            [0.11, 0],
            [0.19, 0.045],
            [0.25, 0.19],
            [0.235, 0.35],
            [0.15, 0.45],
            [0.085, 0.49],
            [0.085, 0.57],
            [0.11, 0.6],
            [0.092, 0.6],
            [0.07, 0.56],
            [0.07, 0.485],
            [0.135, 0.435],
            [0.218, 0.34],
            [0.232, 0.19],
            [0.17, 0.06],
            [0, 0.03],
          ]
  const geometry = new LatheGeometry(
    profile.map(([x, y]) => new Vector2(x, y)),
    48,
  )
  if (shape === 'fluted') {
    const attribute = geometry.getAttribute('position')
    for (let i = 0; i < attribute.count; i++) {
      const angle = Math.atan2(attribute.getX(i), attribute.getZ(i))
      const scale = 1 + Math.cos(angle * 12) * 0.055
      attribute.setX(i, attribute.getX(i) * scale)
      attribute.setZ(i, attribute.getZ(i) * scale)
    }
    geometry.computeVertexNormals()
  }
  return fitDisplayHeight(geometry, recipe.displayHeight)
}

export interface VesselPresentationOptions {
  /** Purely visual replacement for the recipe's default inner reward. */
  readonly resonanceRewardFactory?: ResonanceRewardVisualFactory
}

/** Keeps authored RoseGlass readable while the projected fracture carries charge. */
export const RESONANCE_SURFACE_STRESS_TUNING = {
  emissiveScale: 0.18,
  maximumEmissiveIntensity: 0.12,
} as const

interface VesselShardPresentation {
  readonly delay: number
  readonly mesh: Mesh
  readonly origin: Vector3
  readonly velocity: Vector3
  readonly spin: Vector3
}

interface VesselInstallation {
  readonly intact: Mesh
  readonly bounds: Box3
  readonly shardGroup: Group
  readonly shardMeshes: VesselShardPresentation[]
  readonly cracks: LineSegments[]
  readonly burst?: ShatterBurst
  readonly resonance?: ResonancePresentation
}

export function createVessel(
  target: BreakableDefinition,
  reducedMotion: boolean,
  options: VesselPresentationOptions = {},
) {
  const recipe = getBreakableRenderRecipe(target.variant)
  const shatterProfile =
    recipe.shatterProfile ?? fallbackShatterProfile(recipe.fallbackShape)
  const pictureBearingPortrait = recipe.portraitFracture === 'picture-bearing'
  const stressEmissive =
    recipe.resonancePresentation?.palette?.crackGlow ??
    (recipe.resonancePresentation === undefined
      ? 0x3fccbe
      : RESONANCE_PEARL_PALETTE.crackGlow)
  const root = new Group()
  const materialLibrary = createMaterialLibrary()
  root.name = `vessel-${target.id}`
  root.position.copy(target.position)
  if (target.presentation?.kind === 'barrier') {
    root.rotation.y = target.presentation.facingYaw
  } else {
    root.position.y += target.mount?.height ?? DEFAULT_EXHIBIT_MOUNT_HEIGHT
    if (target.mount !== undefined) root.rotation.y = target.mount.facingYaw
  }
  if (target.presentation?.kind !== 'barrier' && recipe.faceAnchor === true)
    root.rotation.y = Math.atan2(
      target.anchor.x - target.position.x,
      target.anchor.z - target.position.z,
    )
  const glass = new MeshPhysicalMaterial({
    color: recipe.tint,
    metalness: 0,
    roughness: recipe.roughness,
    transmission: recipe.transmission,
    thickness: recipe.thickness,
    ior: 1.48,
    iridescence: 0.8,
    iridescenceThicknessRange: [150, 480],
    clearcoat: 1,
    envMapIntensity: 1.5,
    side: DoubleSide,
    emissive: stressEmissive,
    emissiveIntensity: 0,
  })
  const portraitPlane = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.24,
    metalness: 0.14,
    clearcoat: 1,
    side: DoubleSide,
  })
  const portraitSurface = portraitPlane.clone()
  portraitSurface.name = recipe.portraitMaterial ?? 'portrait-surface'
  let intactMaterial: Material | Material[] =
    recipe.portraitTexture !== undefined &&
    recipe.persistentPortrait === undefined
      ? [glass, portraitSurface]
      : glass
  let shardMaterial: Material | Material[] = pictureBearingPortrait
    ? [glass, portraitSurface]
    : intactMaterial
  const persistentPortraitRecipe = recipe.persistentPortrait
  let persistentPortrait: Mesh | undefined
  let portraitReady = false
  if (persistentPortraitRecipe !== undefined) {
    persistentPortrait = new Mesh(
      new PlaneGeometry(
        persistentPortraitRecipe.width,
        persistentPortraitRecipe.height,
      ),
      portraitPlane,
    )
    persistentPortrait.name = `persistent-portrait-${target.id}`
    persistentPortrait.position.set(
      0,
      persistentPortraitRecipe.centerY,
      persistentPortraitRecipe.z,
    )
    persistentPortrait.visible = false
    root.add(persistentPortrait)
  }
  let intact: Mesh
  let intactLocalBounds = new Box3()
  let shardMeshes: VesselShardPresentation[] = []
  let cracks: LineSegments[] = []
  let burst: ShatterBurst | undefined
  let resonance: ResonancePresentation | undefined
  let shardGroup: Group
  let installation: VesselInstallation | undefined
  const crackMaterial = new LineBasicMaterial({
    color: 0xcaffee,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })

  function disposeInstallation(current: VesselInstallation): void {
    current.resonance?.dispose()
    current.burst?.dispose()
    for (const crack of current.cracks) {
      crack.removeFromParent()
      crack.geometry.dispose()
    }
    const geometries = new Set<BufferGeometry>([
      current.intact.geometry,
      ...current.shardMeshes.map((shard) => shard.mesh.geometry),
    ])
    geometries.forEach((geometry) => geometry.dispose())
    current.intact.removeFromParent()
    current.shardGroup.removeFromParent()
    current.shardGroup.clear()
  }

  function stageInstallation(
    geometry: BufferGeometry,
    authoredPieces?: FracturePiece[],
    authoredMaterials?: readonly Material[],
    nextIntactMaterial: Material | Material[] = intactMaterial,
    nextShardMaterial: Material | Material[] = shardMaterial,
  ): VesselInstallation {
    const nextIntact = new Mesh(geometry, nextIntactMaterial)
    nextIntact.name = `vessel-intact-${target.id}`
    nextIntact.castShadow = true
    geometry.computeBoundingBox()
    const nextBounds = (geometry.boundingBox ?? new Box3()).clone()
    const nextShardGroup = new Group()
    nextShardGroup.name = `vessel-shards-${target.id}`
    nextShardGroup.visible = false
    const nextShardMeshes: VesselShardPresentation[] = []
    const nextCracks: LineSegments[] = []
    let nextPieces = authoredPieces
    let nextResonance: ResonancePresentation | undefined
    let nextBurst: ShatterBurst | undefined
    try {
      const glassMaterialIndices =
        recipe.resonancePresentation === undefined ||
        authoredMaterials === undefined
          ? undefined
          : (recipe.resonanceGlassMaterials ?? []).map((name) => {
              const index = authoredMaterials.findIndex(
                (material) => material.name === name,
              )
              if (index < 0)
                throw new Error(
                  `Resonance exhibit "${target.id}" is missing glass material "${name}".`,
                )
              return index
            })
      if (recipe.resonancePresentation !== undefined)
        nextResonance = createResonancePresentation({
          ...recipe.resonancePresentation,
          reducedMotion,
          surfaceGeometry: geometry,
          intactVisual: nextIntact,
          bounds: nextBounds,
          glassMaterialIndices,
          rewardFactory: options.resonanceRewardFactory,
        })
      nextPieces ??= fractureGeometry(geometry, recipe.fragmentBudget)
      nextPieces.forEach((piece, index) => {
        const mesh = new Mesh(piece.geometry, nextShardMaterial)
        mesh.position.copy(piece.centre)
        mesh.castShadow = true
        const motion = planShatterShardMotion(
          target.id,
          shatterProfile,
          nextBounds,
          piece.centre,
          index,
        )
        nextShardMeshes.push({
          delay: motion.delay,
          mesh,
          origin: piece.centre,
          velocity: motion.velocity,
          spin: motion.spin,
        })
        nextShardGroup.add(mesh)
        if (nextResonance === undefined) {
          const crack = new LineSegments(
            new EdgesGeometry(piece.geometry, 22),
            crackMaterial,
          )
          crack.position.copy(piece.centre)
          nextCracks.push(crack)
          // The visible fracture inherits the exact bounded intact tremor.
          nextIntact.add(crack)
        }
      })
      if (!reducedMotion && nextResonance === undefined)
        nextBurst = createShatterBurst(
          target.id,
          shatterProfile,
          nextBounds,
          recipe.tint,
        )
      return {
        intact: nextIntact,
        bounds: nextBounds,
        shardGroup: nextShardGroup,
        shardMeshes: nextShardMeshes,
        cracks: nextCracks,
        burst: nextBurst,
        resonance: nextResonance,
      }
    } catch (error) {
      nextResonance?.dispose()
      nextBurst?.dispose()
      for (const crack of nextCracks) {
        crack.removeFromParent()
        crack.geometry.dispose()
      }
      const geometries = new Set<BufferGeometry>([
        geometry,
        ...(nextPieces ?? []).map((piece) => piece.geometry),
      ])
      geometries.forEach((owned) => owned.dispose())
      nextIntact.clear()
      nextShardGroup.clear()
      throw error
    }
  }

  function install(
    geometry: BufferGeometry,
    authoredPieces?: FracturePiece[],
    authoredMaterials?: readonly Material[],
    nextIntactMaterial: Material | Material[] = intactMaterial,
    nextShardMaterial: Material | Material[] = shardMaterial,
  ): void {
    const next = stageInstallation(
      geometry,
      authoredPieces,
      authoredMaterials,
      nextIntactMaterial,
      nextShardMaterial,
    )
    const previous = installation
    root.add(next.intact, next.shardGroup)
    if (next.resonance !== undefined) root.add(next.resonance.root)
    if (next.burst !== undefined) root.add(next.burst.root)
    installation = next
    intact = next.intact
    intactLocalBounds = next.bounds
    shardGroup = next.shardGroup
    shardMeshes = next.shardMeshes
    cracks = next.cracks
    burst = next.burst
    resonance = next.resonance
    intactMaterial = nextIntactMaterial
    shardMaterial = nextShardMaterial
    if (previous !== undefined) disposeInstallation(previous)
  }
  const initialGeometry = createVesselGeometry(target.variant)
  if (
    recipe.portraitTexture !== undefined &&
    (recipe.persistentPortrait === undefined || pictureBearingPortrait)
  )
    initialGeometry.groups.forEach((group) => {
      group.materialIndex = (group.materialIndex ?? 0) >= 4 ? 1 : 0
    })
  try {
    install(initialGeometry)
  } catch (error) {
    root.clear()
    persistentPortrait?.geometry.dispose()
    materialLibrary.dispose()
    glass.dispose()
    portraitPlane.dispose()
    portraitSurface.dispose()
    crackMaterial.dispose()
    throw error
  }
  const waveMaterial = new MeshBasicMaterial({
    color: 0xb9fff2,
    transparent: true,
    opacity: 0,
    side: DoubleSide,
    depthWrite: false,
  })
  const wave = new Mesh(new RingGeometry(0.22, 0.245, 64), waveMaterial)
  wave.rotation.x = -Math.PI / 2
  wave.position.y = 0.015
  root.add(wave)
  let latest: BreakableSnapshot | undefined
  let previousNow: number | undefined
  return {
    root,
    materialLibrary,
    addPersistent(object: Group) {
      root.add(object)
    },
    getIntactBounds(box: Box3): Box3 {
      root.updateWorldMatrix(true, false)
      return box.copy(intactLocalBounds).applyMatrix4(root.matrixWorld)
    },
    resonanceSnapshot() {
      return resonance?.snapshot()
    },
    setGeometry(
      geometry: BufferGeometry,
      authoredPieces?: FracturePiece[],
      authoredMaterials?: Material[],
    ) {
      // A late cosmetic download cannot rewind an already presented break.
      if (latest?.brokenAt !== null && latest?.brokenAt !== undefined) {
        const geometries = new Set<BufferGeometry>([
          geometry,
          ...(authoredPieces ?? []).map((piece) => piece.geometry),
        ])
        geometries.forEach((owned) => owned.dispose())
        return
      }
      let nextIntactMaterial = intactMaterial
      let nextShardMaterial = shardMaterial
      if (authoredMaterials) {
        if (recipe.persistentPortrait === undefined) {
          nextIntactMaterial = authoredMaterials
          nextShardMaterial = authoredMaterials
        } else if (pictureBearingPortrait) {
          nextIntactMaterial = authoredMaterials.map((imported) =>
            imported.name === recipe.portraitMaterial ? glass : imported,
          )
          nextShardMaterial = authoredMaterials
        } else {
          nextIntactMaterial = authoredMaterials.map((imported) =>
            imported.name === recipe.portraitMaterial ? glass : imported,
          )
          nextShardMaterial = nextIntactMaterial
        }
      }
      install(
        geometry,
        authoredPieces,
        authoredMaterials,
        nextIntactMaterial,
        nextShardMaterial,
      )
      if (
        authoredMaterials &&
        portraitSurface.map &&
        (recipe.persistentPortrait === undefined || pictureBearingPortrait)
      )
        for (const imported of authoredMaterials) {
          if (imported.name !== recipe.portraitMaterial) continue
          const face = imported as MeshPhysicalMaterial
          face.map = portraitSurface.map
          face.needsUpdate = true
        }
    },
    setPortrait(texture: Texture) {
      // Loaded portraits use the glTF texture convention. The separate artwork
      // is a native PlaneGeometry, whose UVs need the regular vertical upload.
      if (persistentPortrait !== undefined) {
        const planeTexture = pictureBearingPortrait ? texture.clone() : texture
        if (!planeTexture.flipY) {
          planeTexture.flipY = true
          planeTexture.needsUpdate = true
        }
        portraitPlane.map?.dispose()
        portraitPlane.map = planeTexture
        portraitPlane.needsUpdate = true
        portraitReady = true
        persistentPortrait.visible = true
      }
      if (recipe.persistentPortrait !== undefined && !pictureBearingPortrait)
        return
      portraitSurface.map?.dispose()
      portraitSurface.map = texture
      portraitSurface.needsUpdate = true
      for (const imported of materialLibrary.materials) {
        if (imported.name !== recipe.portraitMaterial) continue
        const face = imported as MeshPhysicalMaterial
        face.map = texture
        face.needsUpdate = true
      }
    },
    update(state: BreakableSnapshot, now: number) {
      latest = state
      const reset = previousNow !== undefined && now < previousNow
      const deltaSeconds =
        previousNow === undefined
          ? 0
          : Math.max(0, Math.min(0.1, now - previousNow))
      previousNow = now
      if (reset) resonance?.resetCharge()
      const restored = state.phase === 'complete' && state.brokenAt === null
      const age =
        state.brokenAt === null ? -1 : Math.max(0, now - state.brokenAt)
      const timing = reducedMotion
        ? SHATTER_PRESENTATION_TIMING.reducedMotion
        : SHATTER_PRESENTATION_TIMING.normal
      const delay = timing.anticipationSeconds
      const shattered = age >= delay && age >= 0
      intact.visible = !restored && !shattered
      const stress =
        age < 0
          ? state.charge * state.charge * 0.8
          : age < delay
            ? 1.5
            : Math.max(0, 0.45 - (age - delay) * 3)
      const surfaceStress =
        recipe.resonancePresentation === undefined
          ? stress
          : Math.min(
              RESONANCE_SURFACE_STRESS_TUNING.maximumEmissiveIntensity,
              stress * RESONANCE_SURFACE_STRESS_TUNING.emissiveScale,
            )
      glass.emissiveIntensity = surfaceStress
      for (const imported of materialLibrary.materials) {
        const surface = imported as MeshPhysicalMaterial
        if (!(surface.transmission > 0)) continue
        surface.emissive.setHex(stressEmissive)
        surface.emissiveIntensity = surfaceStress
      }
      const anticipation =
        age < 0 ? 0 : delay <= 0 ? 1 : Math.max(0, Math.min(1, age / delay))
      const crackReveal = Math.max(
        Math.max(0, state.charge - 0.25) / 0.75,
        anticipation,
      )
      crackMaterial.opacity = Math.min(1, crackReveal) * 0.92
      for (const crack of cracks)
        crack.visible = intact.visible && crackReveal > 0
      if (
        resonance === undefined &&
        !reducedMotion &&
        intact.visible &&
        state.charge > 0.6
      ) {
        intact.rotation.z = Math.sin(now * 48) * (state.charge - 0.6) * 0.018
      } else if (resonance === undefined) intact.rotation.z = 0
      const flight = Math.max(0, age - delay)
      shardGroup.visible =
        shattered && !restored && flight < timing.visibleFlightSeconds
      const fade =
        timing.fadeSeconds === 0
          ? 0
          : Math.max(0, flight - timing.fadeStartSeconds) / timing.fadeSeconds
      const microVisible =
        !reducedMotion &&
        shattered &&
        !restored &&
        flight < SHATTER_PRESENTATION_TIMING.normal.visibleFlightSeconds
      burst?.update(flight, fade, microVisible)
      resonance?.update({
        deltaSeconds,
        phase: restored
          ? 'restored'
          : shattered
            ? flight < timing.visibleFlightSeconds
              ? 'releasing'
              : 'completed'
            : state.charge > 0
              ? 'charging'
              : 'idle',
        chargeProgress: shattered ? 1 : state.charge,
        releaseProgress: shattered
          ? Math.min(1, flight / timing.visibleFlightSeconds)
          : 0,
      })
      if (persistentPortrait !== undefined)
        persistentPortrait.visible =
          portraitReady && (!pictureBearingPortrait || !shardGroup.visible)
      if (shardGroup.visible)
        for (const shard of shardMeshes) {
          // Stagger release, not appearance: delayed pieces still fill their
          // original part of the pane until the fracture reaches them.
          const t = Math.max(0, flight - shard.delay) * timing.flightTimeScale
          shard.mesh.position
            .copy(shard.origin)
            .addScaledVector(shard.velocity, t)
          shard.mesh.position.y -= 1.7 * t * t
          shard.mesh.rotation.set(
            shard.spin.x * t,
            shard.spin.y * t,
            shard.spin.z * t,
          )
          shard.mesh.scale.setScalar(Math.max(0.001, 1 - fade))
        }
      wave.visible =
        resonance === undefined && !reducedMotion && shattered && flight < 0.55
      wave.scale.setScalar(1 + flight * 4)
      waveMaterial.opacity = wave.visible ? (1 - flight / 0.55) * 0.65 : 0
    },
    dispose() {
      resonance?.dispose()
      resonance = undefined
      burst?.dispose()
      burst = undefined
      glass.envMap = null
      disposeObject(
        root,
        new Set([
          ...materialLibrary.materials,
          glass,
          portraitPlane,
          portraitSurface,
          crackMaterial,
        ]),
      )
      materialLibrary.dispose()
      glass.dispose()
      portraitPlane.map?.dispose()
      portraitSurface.map?.dispose()
      portraitPlane.dispose()
      portraitSurface.dispose()
      crackMaterial.dispose()
    },
  }
}
