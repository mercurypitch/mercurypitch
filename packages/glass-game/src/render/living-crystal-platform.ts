// Living-crystal platform renderer — install shared donor geometry with transmissive shell and contained travelling roots.

import type { BufferGeometry, Object3D, PerspectiveCamera } from 'three'
import { Box3, BoxGeometry, Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, } from 'three'
import { LIVING_CRYSTAL_PLATFORM_BUNDLE_ID, LIVING_CRYSTAL_PLATFORM_NODES, LIVING_CRYSTAL_PLATFORM_SUPPORT, LIVING_CRYSTAL_VARIANTS, } from '../content/living-crystal-profile'
import type { BreakableSnapshot, GameSnapshot, LevelDefinition, } from '../contracts'
import { SHATTER_PRESENTATION_TIMING, shatterPresentationSpeed, } from '../core/shatter-presentation'
import { CLOUDWAY_PLATFORM_FOG_CULL_MARGIN, createCloudwayPlatformViewSelector, } from './cloudway-platform-culling'
import { resolveCloudwayFog } from './cloudway-scene'
import { removeKitGeometry } from './kit-instance'
import type { LivingCrystalInteriorAnimation } from './living-crystal-interior'
import { createLivingCrystalInteriorAnimation } from './living-crystal-interior'
import { validateLivingCrystalPlatformDonor } from './living-crystal-platform-contract'
import type { LivingCrystalPlatformPlacement } from './living-crystal-platform-layout'
import { resolveLivingCrystalPlatformPlacements } from './living-crystal-platform-layout'
import type { PearlCurrentInterior } from './pearl-current'
import { createPearlCurrentInterior } from './pearl-current'

interface LivingCrystalPlatformRendererOptions {
  readonly reducedMotion?: () => boolean
}

interface InstalledLivingCrystalPlatform {
  readonly platformId: string
  readonly coveredPlatformIds: readonly string[]
  readonly roomId?: string
  readonly art: Group
  readonly bounds: Box3
  readonly apronTriangles: number
  readonly interior:
    | {
        readonly kind: 'roots'
        readonly animation: LivingCrystalInteriorAnimation
      }
    | {
        readonly kind: 'pearl-current'
        readonly animation: PearlCurrentInterior
        readonly responseExhibitId: string
      }
  selected: boolean
  active: boolean
  roomVisible: boolean
  reducedMotion: boolean
  resetPending: boolean
}

const APRON_HEIGHT = 0.08
const SEAM_HEIGHT = 0.012
const SEAM_WIDTH = 0.018
const DIMENSION_EPSILON = 1e-6

function disposeInterior(
  interior: InstalledLivingCrystalPlatform['interior'],
): void {
  interior.animation.dispose()
}

function pearlCurrentResponse(
  state: BreakableSnapshot | undefined,
  elapsedSeconds: number,
  reducedMotion: boolean,
) {
  if (
    state === undefined ||
    (state.phase === 'complete' && state.brokenAt === null)
  )
    return { response: 'rest' as const, progress: 0, strength: 0 }
  if (state.brokenAt === null)
    return state.charge > 0
      ? {
          response: 'charge' as const,
          progress: state.charge,
          strength: state.charge,
        }
      : { response: 'rest' as const, progress: 0, strength: 0 }
  const timing = reducedMotion
    ? SHATTER_PRESENTATION_TIMING.reducedMotion
    : SHATTER_PRESENTATION_TIMING.normal
  const age =
    Math.max(0, elapsedSeconds - state.brokenAt) *
    shatterPresentationSpeed(state.shatterPlaybackSpeed, reducedMotion)
  if (age < timing.anticipationSeconds)
    return { response: 'charge' as const, progress: 1, strength: 1 }
  const flight = age - timing.anticipationSeconds
  return {
    response: 'release' as const,
    progress: Math.min(1, flight / timing.visibleFlightSeconds),
    strength: 1,
  }
}

function exactRoot(source: Object3D): Object3D {
  const matches: Object3D[] = []
  source.traverse((object) => {
    if (object.name === LIVING_CRYSTAL_PLATFORM_NODES.root) matches.push(object)
  })
  if (matches.length !== 1)
    throw new Error(
      `Living-crystal platform renderer: expected one donor root; found ${matches.length}.`,
    )
  return matches[0]!
}

function copyTransform(source: Object3D, target: Object3D): void {
  target.position.copy(source.position)
  target.quaternion.copy(source.quaternion)
  target.scale.copy(source.scale)
}

function geometryBytes(geometries: readonly BufferGeometry[]): number {
  return geometries.reduce((total, geometry) => {
    const attributes = Object.values(geometry.attributes).reduce(
      (sum, attribute) => sum + attribute.array.byteLength,
      0,
    )
    return total + attributes + (geometry.getIndex()?.array.byteLength ?? 0)
  }, 0)
}

function geometryTriangles(geometry: BufferGeometry): number {
  return (
    (geometry.getIndex()?.count ??
      geometry.getAttribute('position')?.count ??
      0) / 3
  )
}

function visibleMeshPrimitives(root: Object3D): number {
  let count = 0
  root.traverseVisible((object) => {
    if ((object as Mesh).isMesh) count++
  })
  return count
}

function defaultReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function addSupportApron(
  art: Group,
  placement: LivingCrystalPlatformPlacement,
  marble: MeshStandardMaterial,
  gold: MeshStandardMaterial,
  geometries: BufferGeometry[],
): number {
  const contactWidth =
    placement.turns % 2 === 0 ? placement.contactWidth : placement.contactDepth
  const contactDepth =
    placement.turns % 2 === 0 ? placement.contactDepth : placement.contactWidth
  const marginX = (contactWidth - LIVING_CRYSTAL_PLATFORM_SUPPORT.width) / 2
  const marginZ = (contactDepth - LIVING_CRYSTAL_PLATFORM_SUPPORT.depth) / 2
  if (marginX <= DIMENSION_EPSILON && marginZ <= DIMENSION_EPSILON) return 0
  const firstGeometry = geometries.length

  function strip(
    name: string,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: MeshStandardMaterial,
  ): void {
    const geometry = new BoxGeometry(width, height, depth)
    geometries.push(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(x, y, z)
    mesh.userData.excludeFromCameraCollision = true
    mesh.castShadow = false
    mesh.receiveShadow = true
    art.add(mesh)
  }

  if (marginX > DIMENSION_EPSILON)
    for (const side of [-1, 1] as const)
      strip(
        `LivingCrystalV2_Apron_X_${side}`,
        marginX,
        APRON_HEIGHT,
        contactDepth,
        side * (LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2 + marginX / 2),
        -APRON_HEIGHT / 2,
        0,
        marble,
      )
  if (marginZ > DIMENSION_EPSILON)
    for (const side of [-1, 1] as const)
      strip(
        `LivingCrystalV2_Apron_Z_${side}`,
        LIVING_CRYSTAL_PLATFORM_SUPPORT.width,
        APRON_HEIGHT,
        marginZ,
        0,
        -APRON_HEIGHT / 2,
        side * (LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2 + marginZ / 2),
        marble,
      )
  if (marginX > DIMENSION_EPSILON)
    for (const side of [-1, 1] as const)
      strip(
        `LivingCrystalV2_Seam_X_${side}`,
        SEAM_WIDTH,
        SEAM_HEIGHT,
        LIVING_CRYSTAL_PLATFORM_SUPPORT.depth,
        side * (LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2 + SEAM_WIDTH / 2),
        SEAM_HEIGHT / 2,
        0,
        gold,
      )
  if (marginZ > DIMENSION_EPSILON)
    for (const side of [-1, 1] as const)
      strip(
        `LivingCrystalV2_Seam_Z_${side}`,
        LIVING_CRYSTAL_PLATFORM_SUPPORT.width,
        SEAM_HEIGHT,
        SEAM_WIDTH,
        0,
        SEAM_HEIGHT / 2,
        side * (LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2 + SEAM_WIDTH / 2),
        gold,
      )
  return geometries
    .slice(firstGeometry)
    .reduce((total, geometry) => total + geometryTriangles(geometry), 0)
}

export function createLivingCrystalPlatformRenderer(
  level: LevelDefinition,
  sceneRoot: Group,
  floors: ReadonlyMap<string, Group>,
  options: LivingCrystalPlatformRendererOptions = {},
) {
  const placements = resolveLivingCrystalPlatformPlacements(level)
  const covered = new Set(
    placements.flatMap((placement) => placement.coveredPlatformIds),
  )
  const root = new Group()
  root.name = 'living-crystal-platform-art'
  const viewSelector = createCloudwayPlatformViewSelector({
    maxDistance:
      resolveCloudwayFog(level).farMeters + CLOUDWAY_PLATFORM_FOG_CULL_MARGIN,
    shadowDirection: { x: 0, y: -1, z: 0 },
    shadowReceiverMinimumY: 0,
  })
  const readReducedMotion = options.reducedMotion ?? defaultReducedMotion
  let installed: InstalledLivingCrystalPlatform[] | undefined
  let geometries: BufferGeometry[] = []
  let hardwareMaterial: MeshStandardMaterial | undefined
  let apronMaterial: MeshStandardMaterial | undefined
  let shellMaterials: MeshPhysicalMaterial[] = []
  let apronGeometries: BufferGeometry[] = []
  let previousSeconds: number | undefined
  let latestSnapshot: GameSnapshot | undefined
  let disposed = false

  function updateVisibility(item: InstalledLivingCrystalPlatform): boolean {
    const visible = item.active && item.selected && item.roomVisible
    if (item.art.visible === visible) return false
    item.art.visible = visible
    return true
  }

  function updatePearlCurrent(
    item: InstalledLivingCrystalPlatform,
    snapshot: GameSnapshot,
    deltaSeconds: number,
    motionDisabled: boolean,
  ): void {
    if (item.interior.kind !== 'pearl-current') return
    if (item.reducedMotion !== motionDisabled) {
      item.interior.animation.configure({ reducedMotion: motionDisabled })
      item.reducedMotion = motionDisabled
    }
    if (item.resetPending) {
      item.interior.animation.reset()
      item.resetPending = false
    }
    const responseExhibitId = item.interior.responseExhibitId
    const exhibit = snapshot.breakables.find(
      (state) => state.id === responseExhibitId,
    )
    const response = pearlCurrentResponse(
      exhibit,
      snapshot.elapsedSeconds,
      motionDisabled,
    )
    item.interior.animation.update({
      deltaSeconds:
        deltaSeconds *
        (response.response === 'release' && response.progress < 1
          ? shatterPresentationSpeed(
              exhibit?.shatterPlaybackSpeed,
              motionDisabled,
            )
          : 1),
      paused: snapshot.paused,
      ...response,
    })
  }

  return {
    install(sourceScene: Object3D, bundle: string): ReadonlySet<string> {
      if (
        disposed ||
        placements.length === 0 ||
        bundle !== LIVING_CRYSTAL_PLATFORM_BUNDLE_ID ||
        installed !== undefined
      )
        return new Set()
      for (const id of covered)
        if (!floors.has(id))
          throw new Error(
            `Living-crystal platform renderer: platform "${id}" has no fallback floor.`,
          )
      const source = exactRoot(sourceScene)
      const donor = validateLivingCrystalPlatformDonor(source)
      source.updateWorldMatrix(true, true)
      const stagedGeometries = [
        donor.shell.geometry.clone(),
        donor.hardware.geometry.clone(),
        ...(placements.some(
          (placement) => placement.interior.effect !== 'pearl-current',
        )
          ? [donor.interior.geometry.clone()]
          : []),
      ]
      const stagedHardwareMaterial = new MeshStandardMaterial({
        name: 'LivingCrystalV2_RuntimeGold',
        color: 0xf1c46c,
        metalness: 0.82,
        roughness: 0.16,
        emissive: 0x3a1600,
        emissiveIntensity: 0.18,
      })
      const stagedApronMaterial = new MeshStandardMaterial({
        name: 'LivingCrystalV2_RuntimePearlMarble',
        color: 0xf3e9e3,
        metalness: 0.03,
        roughness: 0.32,
      })
      const stagedApronGeometries: BufferGeometry[] = []
      const stagedShellMaterials: MeshPhysicalMaterial[] = []
      const staged: InstalledLivingCrystalPlatform[] = []
      try {
        for (const placement of placements) {
          const tuning = LIVING_CRYSTAL_VARIANTS[placement.interior.variant]
          const shellMaterial = new MeshPhysicalMaterial({
            name: `LivingCrystalV2_RuntimeShell_${placement.interior.variant}`,
            color: tuning.shellTint,
            roughness: 0,
            metalness: 0,
            transmission: 0.985,
            thickness: 0.08,
            ior: 1.05,
            attenuationColor: new Color(tuning.attenuationTint),
            attenuationDistance: 0.65,
            clearcoat: 0.55,
            clearcoatRoughness: 0.025,
            specularIntensity: 0.92,
            transparent: false,
            opacity: 1,
            depthWrite: true,
          })
          stagedShellMaterials.push(shellMaterial)
          const reducedMotion = readReducedMotion()
          const interior =
            placement.interior.effect === 'pearl-current'
              ? {
                  kind: 'pearl-current' as const,
                  animation: createPearlCurrentInterior({
                    seed: placement.interior.seed,
                    quality: placement.interior.quality,
                    speed: placement.interior.speed,
                    intensity: placement.interior.intensity,
                    fullness: placement.interior.fullness,
                    reducedMotion,
                    palette:
                      placement.interior.palette === undefined
                        ? undefined
                        : {
                            streams: [
                              placement.interior.palette.primary,
                              placement.interior.palette.secondary,
                              placement.interior.palette.accent,
                            ],
                          },
                  }),
                  responseExhibitId: placement.interior.responseExhibitId!,
                }
              : {
                  kind: 'roots' as const,
                  animation: createLivingCrystalInteriorAnimation({
                    ...placement.interior,
                    reducedMotion,
                  }),
                }
          const art = new Group()
          art.name = `living-crystal-${placement.platformId}`
          art.position.set(
            placement.position.x,
            placement.position.y,
            placement.position.z,
          )
          art.rotation.y = placement.rotationY
          const shell = new Mesh(stagedGeometries[0]!, shellMaterial)
          const hardware = new Mesh(
            stagedGeometries[1]!,
            stagedHardwareMaterial,
          )
          const interiorObject =
            interior.kind === 'pearl-current'
              ? interior.animation.group
              : new Mesh(stagedGeometries[2]!, interior.animation.material)
          copyTransform(donor.shell, shell)
          copyTransform(donor.hardware, hardware)
          if (interior.kind === 'roots')
            copyTransform(donor.interior, interiorObject)
          shell.name = LIVING_CRYSTAL_PLATFORM_NODES.shell
          hardware.name = LIVING_CRYSTAL_PLATFORM_NODES.hardware
          interiorObject.name =
            interior.kind === 'pearl-current'
              ? `${LIVING_CRYSTAL_PLATFORM_NODES.interior}_PearlCurrent`
              : LIVING_CRYSTAL_PLATFORM_NODES.interior
          for (const mesh of [shell, hardware]) {
            mesh.userData.excludeFromCameraCollision = true
            mesh.castShadow = false
            mesh.receiveShadow = true
          }
          interiorObject.traverse((object) => {
            const mesh = object as Mesh
            if (!mesh.isMesh) return
            mesh.userData.excludeFromCameraCollision = true
            mesh.castShadow = false
            mesh.receiveShadow = false
          })
          art.add(shell, hardware, interiorObject)
          const apronTriangles = addSupportApron(
            art,
            placement,
            stagedApronMaterial,
            stagedHardwareMaterial,
            stagedApronGeometries,
          )
          // Program precompile runs before the first museum snapshot update.
          // Keep the authored subtree traversable until that update applies
          // authoritative platform activity and camera selection.
          art.visible = true
          root.add(art)
          art.updateWorldMatrix(true, true)
          staged.push({
            platformId: placement.platformId,
            coveredPlatformIds: placement.coveredPlatformIds,
            roomId: placement.roomId,
            art,
            bounds: new Box3().setFromObject(art, true),
            apronTriangles,
            interior,
            selected: true,
            active: false,
            roomVisible: true,
            reducedMotion,
            resetPending: false,
          })
        }
      } catch (error) {
        staged.forEach((item) => disposeInterior(item.interior))
        stagedShellMaterials.forEach((material) => material.dispose())
        stagedHardwareMaterial.dispose()
        stagedApronMaterial.dispose()
        stagedGeometries.forEach((geometry) => geometry.dispose())
        stagedApronGeometries.forEach((geometry) => geometry.dispose())
        root.clear()
        throw error
      }
      for (const id of covered) removeKitGeometry(floors.get(id)!)
      sceneRoot.add(root)
      geometries = stagedGeometries
      hardwareMaterial = stagedHardwareMaterial
      apronMaterial = stagedApronMaterial
      shellMaterials = stagedShellMaterials
      apronGeometries = stagedApronGeometries
      installed = staged
      return covered
    },
    update(snapshot: GameSnapshot): void {
      if (disposed || installed === undefined) return
      latestSnapshot = snapshot
      const reset =
        previousSeconds !== undefined &&
        snapshot.elapsedSeconds < previousSeconds
      const deltaSeconds =
        previousSeconds === undefined
          ? 0
          : Math.max(
              0,
              Math.min(0.1, snapshot.elapsedSeconds - previousSeconds),
            )
      previousSeconds = snapshot.elapsedSeconds
      const active = new Set(snapshot.enabledPlatformIds)
      const motionDisabled = readReducedMotion()
      for (const item of installed) {
        item.active = item.coveredPlatformIds.every((id) => active.has(id))
        if (item.interior.kind === 'roots') {
          if (item.reducedMotion !== motionDisabled) {
            item.reducedMotion = motionDisabled
            item.interior.animation.configure({
              reducedMotion: motionDisabled,
            })
          }
          if (reset) item.interior.animation.reset()
          item.interior.animation.update({
            deltaSeconds,
            paused: snapshot.paused,
          })
          updateVisibility(item)
          continue
        }
        if (reset) item.resetPending = true
        updateVisibility(item)
        if (!item.art.visible) continue
        updatePearlCurrent(item, snapshot, deltaSeconds, motionDisabled)
      }
    },
    cullForView(camera: PerspectiveCamera | undefined): boolean {
      if (disposed || installed === undefined) return false
      viewSelector.update(camera, [])
      let changed = false
      for (const item of installed) {
        const itemSelected = viewSelector.includes(item.bounds)
        if (item.selected !== itemSelected) {
          item.selected = itemSelected
          changed = true
        }
        const visibilityChanged = updateVisibility(item)
        changed = visibilityChanged || changed
        if (
          visibilityChanged &&
          item.art.visible &&
          item.interior.kind === 'pearl-current' &&
          latestSnapshot !== undefined
        )
          updatePearlCurrent(item, latestSnapshot, 0, readReducedMotion())
      }
      return changed
    },
    setVisibleRooms(visibleRoomIds: ReadonlySet<string>): boolean {
      if (disposed || installed === undefined) return false
      let changed = false
      for (const item of installed) {
        const roomVisible =
          item.roomId === undefined || visibleRoomIds.has(item.roomId)
        if (item.roomVisible !== roomVisible) {
          item.roomVisible = roomVisible
          changed = true
        }
        const visibilityChanged = updateVisibility(item)
        changed = visibilityChanged || changed
        if (
          visibilityChanged &&
          item.art.visible &&
          item.interior.kind === 'pearl-current' &&
          latestSnapshot !== undefined
        )
          updatePearlCurrent(item, latestSnapshot, 0, readReducedMotion())
      }
      return changed
    },
    snapshot() {
      const visibleItems = installed?.filter((item) => item.art.visible) ?? []
      const visible = visibleItems.length
      const shellAndHardwareTriangles =
        geometries.length < 2
          ? 0
          : geometryTriangles(geometries[0]!) +
            geometryTriangles(geometries[1]!)
      return {
        installed: installed?.length ?? 0,
        visible,
        // Primitive inventory; transmission can add renderer passes.
        visibleMeshPrimitives: visibleItems.reduce(
          (sum, item) => sum + visibleMeshPrimitives(item.art),
          0,
        ),
        visibleGeometryTriangles: visibleItems.reduce(
          (sum, item) =>
            sum +
            shellAndHardwareTriangles +
            item.apronTriangles +
            (item.interior.kind === 'pearl-current'
              ? item.interior.animation.snapshot().renderedTriangles
              : geometryTriangles(geometries[2]!)),
          0,
        ),
        sharedGeometryBytes: geometryBytes([...geometries, ...apronGeometries]),
        textures: 0,
        interiors:
          installed?.map((item) => item.interior.animation.snapshot()) ?? [],
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      installed?.forEach((item) => disposeInterior(item.interior))
      shellMaterials.forEach((material) => material.dispose())
      hardwareMaterial?.dispose()
      apronMaterial?.dispose()
      geometries.forEach((geometry) => geometry.dispose())
      apronGeometries.forEach((geometry) => geometry.dispose())
      root.clear()
      root.removeFromParent()
      installed = undefined
      shellMaterials = []
      geometries = []
      apronGeometries = []
      latestSnapshot = undefined
    },
  }
}

export type LivingCrystalPlatformRenderer = ReturnType<
  typeof createLivingCrystalPlatformRenderer
>
