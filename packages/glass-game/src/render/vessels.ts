// ============================================================
// Adventure vessels — dimensional glass, an earned stress glow and bounded shatter.
// ============================================================

import type { BufferGeometry, Material, Texture, Vector3 } from 'three'
import { Box3, DoubleSide, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PlaneGeometry, RingGeometry, } from 'three'
import { DEFAULT_EXHIBIT_MOUNT_HEIGHT } from '../content/solid-props'
import type { BreakableDefinition, BreakableSnapshot } from '../contracts'
import { createShatterPlayback, MAXIMUM_SHATTER_FRAME_SECONDS, SHATTER_PRESENTATION_TIMING, } from '../core/shatter-presentation'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import type { PreparedExhibitAssetLease } from './exhibit-geometry-pool'
import type { FracturePiece } from './fracture'
import { fractureGeometry } from './fracture'
import type { MaterialLibrary } from './material-library'
import { createMaterialLibrary } from './material-library'
import type { ResonancePresentation, ResonanceRewardVisualFactory, } from './resonance-release'
import { createResonancePresentation } from './resonance-release'
import type { ResonancePresentationConfig } from './resonance-release-config'
import { RESONANCE_PEARL_PALETTE } from './resonance-release-config'
import type { ShatterBurst } from './shatter-burst'
import { createShatterBurst } from './shatter-burst'
import { fallbackShatterProfile, planShatterShardMotion, } from './shatter-motion'
import { createVesselGeometry } from './vessel-fallback-geometry'

export { createVesselGeometry } from './vessel-fallback-geometry'

export interface VesselPresentationOptions {
  readonly shatterPlaybackSpeed?: number
  /** Encounter tuning layers over the certified recipe defaults. */
  readonly resonancePresentation?: ResonancePresentationConfig
  /** Purely visual replacement for the recipe's default inner reward. */
  readonly resonanceRewardFactory?: ResonanceRewardVisualFactory
  /** Keep intact shadowing while omitting the multiplied cost of flying shards. */
  readonly castShardShadows?: boolean
}

/** Per-frame opt-in for encounters whose earned charge can outlive live input. */
export interface VesselChargePresentation {
  readonly surfaceStressActive: boolean
  readonly tremorActive: boolean
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
  readonly releaseGeometry: () => void
  readonly ownsCrackGeometries: boolean
  readonly intact: Mesh
  readonly bounds: Box3
  readonly shardGroup: Group
  readonly shardMeshes: VesselShardPresentation[]
  readonly cracks: LineSegments[]
  readonly burst?: ShatterBurst
  readonly resonance?: ResonancePresentation
}

export type VesselDefinition = Pick<
  BreakableDefinition,
  'id' | 'position' | 'anchor' | 'mount' | 'presentation' | 'variant'
>

export type VesselAssetLeaseFactory = (
  library: MaterialLibrary,
) => PreparedExhibitAssetLease

export function createVessel(
  target: VesselDefinition,
  reducedMotion: boolean,
  options: VesselPresentationOptions = {},
) {
  return createVesselPresentation(target, reducedMotion, options)
}

/** Builds directly from an authored lease without constructing a discarded fallback. */
export function createAuthoredVessel(
  target: VesselDefinition,
  reducedMotion: boolean,
  acquire: VesselAssetLeaseFactory,
  options: VesselPresentationOptions = {},
) {
  return createVesselPresentation(target, reducedMotion, options, acquire)
}

function createVesselPresentation(
  target: VesselDefinition,
  reducedMotion: boolean,
  options: VesselPresentationOptions,
  acquireInitialLease?: VesselAssetLeaseFactory,
) {
  const recipe = getBreakableRenderRecipe(target.variant)
  const resonanceSettings =
    recipe.resonancePresentation === undefined
      ? undefined
      : {
          ...recipe.resonancePresentation,
          ...options.resonancePresentation,
          palette: {
            ...recipe.resonancePresentation.palette,
            ...options.resonancePresentation?.palette,
          },
          tremor: {
            ...recipe.resonancePresentation.tremor,
            ...options.resonancePresentation?.tremor,
          },
        }
  const shatterProfile =
    recipe.shatterProfile ?? fallbackShatterProfile(recipe.fallbackShape)
  const pictureBearingPortrait = recipe.portraitFracture === 'picture-bearing'
  const stressEmissive =
    resonanceSettings?.palette?.crackGlow ??
    (resonanceSettings === undefined
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
  const playback = createShatterPlayback(
    options.shatterPlaybackSpeed,
    reducedMotion,
  )
  let disposed = false
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
      if (current.ownsCrackGeometries) crack.geometry.dispose()
    }
    current.releaseGeometry()
    current.intact.removeFromParent()
    current.shardGroup.removeFromParent()
    current.shardGroup.clear()
  }

  function stageInstallation(
    geometry: BufferGeometry,
    authoredPieces?: readonly FracturePiece[],
    authoredCrackGeometries?: readonly BufferGeometry[],
    authoredMaterials?: readonly Material[],
    nextIntactMaterial: Material | Material[] = intactMaterial,
    nextShardMaterial: Material | Material[] = shardMaterial,
    releaseSharedGeometry?: () => void,
  ): VesselInstallation {
    const nextIntact = new Mesh(geometry, nextIntactMaterial)
    nextIntact.name = `vessel-intact-${target.id}`
    nextIntact.castShadow = true
    if (releaseSharedGeometry === undefined || geometry.boundingBox === null)
      geometry.computeBoundingBox()
    const nextBounds = (geometry.boundingBox ?? new Box3()).clone()
    const nextShardGroup = new Group()
    nextShardGroup.name = `vessel-shards-${target.id}`
    nextShardGroup.visible = false
    const nextShardMeshes: VesselShardPresentation[] = []
    const nextCracks: LineSegments[] = []
    let nextPieces = authoredPieces
    let geometryReleased = false
    const releaseGeometry = () => {
      if (geometryReleased) return
      geometryReleased = true
      if (releaseSharedGeometry !== undefined) releaseSharedGeometry()
      else {
        const owned = new Set([
          geometry,
          ...(nextPieces ?? []).map((piece) => piece.geometry),
        ])
        owned.forEach((item) => item.dispose())
      }
    }
    let nextResonance: ResonancePresentation | undefined
    let nextBurst: ShatterBurst | undefined
    try {
      const glassMaterialIndices =
        resonanceSettings === undefined || authoredMaterials === undefined
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
      if (resonanceSettings !== undefined)
        nextResonance = createResonancePresentation({
          ...resonanceSettings,
          reducedMotion,
          surfaceGeometry: geometry,
          intactVisual: nextIntact,
          bounds: nextBounds,
          glassMaterialIndices,
          rewardFactory: options.resonanceRewardFactory,
        })
      nextPieces ??= fractureGeometry(geometry, recipe.fragmentBudget)
      if (
        nextResonance === undefined &&
        authoredCrackGeometries !== undefined &&
        authoredCrackGeometries.length !== nextPieces.length
      )
        throw new Error(
          `Exhibit "${target.id}" has ${authoredCrackGeometries.length} crack outlines for ${nextPieces.length} fracture pieces.`,
        )
      nextPieces.forEach((piece, index) => {
        const mesh = new Mesh(piece.geometry, nextShardMaterial)
        mesh.position.copy(piece.centre)
        mesh.castShadow = options.castShardShadows !== false
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
            authoredCrackGeometries?.[index] ??
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
        releaseGeometry,
        ownsCrackGeometries: authoredCrackGeometries === undefined,
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
        if (authoredCrackGeometries === undefined) crack.geometry.dispose()
      }
      releaseGeometry()
      nextIntact.clear()
      nextShardGroup.clear()
      throw error
    }
  }

  function install(
    geometry: BufferGeometry,
    authoredPieces?: readonly FracturePiece[],
    authoredCrackGeometries?: readonly BufferGeometry[],
    authoredMaterials?: readonly Material[],
    nextIntactMaterial: Material | Material[] = intactMaterial,
    nextShardMaterial: Material | Material[] = shardMaterial,
    releaseSharedGeometry?: () => void,
  ): void {
    let released = false
    const releaseLease =
      releaseSharedGeometry === undefined
        ? undefined
        : () => {
            if (released) return
            released = true
            releaseSharedGeometry()
          }
    let next: VesselInstallation
    try {
      next = stageInstallation(
        geometry,
        authoredPieces,
        authoredCrackGeometries,
        authoredMaterials,
        nextIntactMaterial,
        nextShardMaterial,
        releaseLease,
      )
    } catch (error) {
      // The lease also covers failures before stageInstallation enters its
      // presentation transaction, such as invalid incoming geometry bounds.
      releaseLease?.()
      throw error
    }
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

  function authoredMaterialSelection(authoredMaterials: Material[]): {
    intact: Material | Material[]
    shards: Material | Material[]
  } {
    if (recipe.persistentPortrait === undefined)
      return { intact: authoredMaterials, shards: authoredMaterials }
    const withoutPortrait = authoredMaterials.map((imported) =>
      imported.name === recipe.portraitMaterial ? glass : imported,
    )
    return {
      intact: withoutPortrait,
      shards: pictureBearingPortrait ? authoredMaterials : withoutPortrait,
    }
  }

  try {
    if (acquireInitialLease === undefined) {
      const initialGeometry = createVesselGeometry(target.variant)
      if (
        recipe.portraitTexture !== undefined &&
        (recipe.persistentPortrait === undefined || pictureBearingPortrait)
      )
        initialGeometry.groups.forEach((group) => {
          group.materialIndex = (group.materialIndex ?? 0) >= 4 ? 1 : 0
        })
      install(initialGeometry)
    } else {
      const lease = acquireInitialLease(materialLibrary)
      const materials = authoredMaterialSelection(lease.materials)
      install(
        lease.geometry,
        lease.pieces,
        lease.crackGeometries,
        lease.materials,
        materials.intact,
        materials.shards,
        lease.release,
      )
    }
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
  let resetPending = false

  function setGeometry(
    geometry: BufferGeometry,
    authoredPieces?: readonly FracturePiece[],
    authoredCrackGeometries?: readonly BufferGeometry[],
    authoredMaterials?: Material[],
    releaseSharedGeometry?: () => void,
  ): void {
    // A late cosmetic download cannot rewind an already presented break.
    if (
      disposed ||
      (latest?.brokenAt !== null && latest?.brokenAt !== undefined)
    ) {
      if (releaseSharedGeometry !== undefined) releaseSharedGeometry()
      else {
        const geometries = new Set([
          geometry,
          ...(authoredPieces ?? []).map((piece) => piece.geometry),
        ])
        geometries.forEach((owned) => owned.dispose())
      }
      return
    }
    let nextIntactMaterial = intactMaterial
    let nextShardMaterial = shardMaterial
    if (authoredMaterials) {
      const materials = authoredMaterialSelection(authoredMaterials)
      nextIntactMaterial = materials.intact
      nextShardMaterial = materials.shards
    }
    install(
      geometry,
      authoredPieces,
      authoredCrackGeometries,
      authoredMaterials,
      nextIntactMaterial,
      nextShardMaterial,
      releaseSharedGeometry,
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
  }
  return {
    root,
    materialLibrary,
    setShatterPlaybackSpeed: playback.setSpeed,
    shatterAge: playback.age,
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
      authoredPieces?: readonly FracturePiece[],
      authoredMaterials?: Material[],
    ) {
      setGeometry(geometry, authoredPieces, undefined, authoredMaterials)
    },
    /** Consumes the lease even when replacement fails or the vessel is already broken. */
    setGeometryLease(lease: PreparedExhibitAssetLease) {
      setGeometry(
        lease.geometry,
        lease.pieces,
        lease.crackGeometries,
        lease.materials,
        lease.release,
      )
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
    /** Hidden vessels ingest lifecycle state without animating their presentation. */
    update(
      state: BreakableSnapshot,
      now: number,
      presentationVisible = true,
      chargePresentation?: VesselChargePresentation,
    ) {
      if (disposed) return
      latest = state
      const age = playback.age(state.brokenAt, now, state.shatterPlaybackSpeed)
      resetPending ||= previousNow !== undefined && now < previousNow
      const deltaSeconds =
        previousNow === undefined
          ? 0
          : Math.max(
              0,
              Math.min(MAXIMUM_SHATTER_FRAME_SECONDS, now - previousNow),
            )
      previousNow = now
      if (!presentationVisible) return
      if (resetPending) {
        resonance?.resetCharge()
        resetPending = false
      }
      const restored = state.phase === 'complete' && state.brokenAt === null
      const timing = reducedMotion
        ? SHATTER_PRESENTATION_TIMING.reducedMotion
        : SHATTER_PRESENTATION_TIMING.normal
      const delay = timing.anticipationSeconds
      const shattered = age >= delay && age >= 0
      intact.visible = !restored && !shattered
      const surfaceStressActive =
        chargePresentation?.surfaceStressActive !== false
      const tremorActive = chargePresentation?.tremorActive !== false
      const stress =
        age < 0
          ? surfaceStressActive
            ? state.charge * state.charge * 0.8
            : 0
          : age < delay
            ? 1.5
            : Math.max(0, 0.45 - (age - delay) * 3)
      const surfaceStress =
        resonanceSettings === undefined
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
        tremorActive &&
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
        deltaSeconds: deltaSeconds * (age < 0 ? 1 : playback.speed()),
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
      if (disposed) return
      disposed = true
      if (installation !== undefined) disposeInstallation(installation)
      installation = undefined
      resonance = undefined
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
