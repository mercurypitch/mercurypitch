// Living-crystal platform renderer — install shared donor geometry with transmissive shell and contained travelling roots.

import type { BufferGeometry, Object3D, PerspectiveCamera } from 'three'
import { Box3, Color, Group, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3, } from 'three'
import { LIVING_CRYSTAL_PLATFORM_BUNDLE_ID, LIVING_CRYSTAL_PLATFORM_NODES, LIVING_CRYSTAL_PLATFORM_RUNTIME, LIVING_CRYSTAL_VARIANTS, } from '../content/living-crystal-profile'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { createCloudwayPlatformViewSelector } from './cloudway-platform-culling'
import { removeKitGeometry } from './kit-instance'
import type { LivingCrystalInteriorAnimation } from './living-crystal-interior'
import { createLivingCrystalInteriorAnimation } from './living-crystal-interior'
import { validateLivingCrystalPlatformDonor } from './living-crystal-platform-contract'
import { resolveLivingCrystalPlatformPlacements } from './living-crystal-platform-layout'

interface LivingCrystalPlatformRendererOptions {
  readonly reducedMotion?: () => boolean
}

interface InstalledLivingCrystalPlatform {
  readonly platformId: string
  readonly art: Group
  readonly bounds: Box3
  readonly interior: LivingCrystalInteriorAnimation
  selected: boolean
  active: boolean
  reducedMotion: boolean
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

function defaultReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function createLivingCrystalPlatformRenderer(
  level: LevelDefinition,
  sceneRoot: Group,
  floors: ReadonlyMap<string, Group>,
  options: LivingCrystalPlatformRendererOptions = {},
) {
  const placements = resolveLivingCrystalPlatformPlacements(level)
  const covered = new Set(placements.map((placement) => placement.platformId))
  const root = new Group()
  root.name = 'living-crystal-platform-art'
  const viewSelector = createCloudwayPlatformViewSelector({
    shadowDirection: { x: 0, y: -1, z: 0 },
    shadowReceiverMinimumY: 0,
  })
  const readReducedMotion = options.reducedMotion ?? defaultReducedMotion
  let installed: InstalledLivingCrystalPlatform[] | undefined
  let geometries: BufferGeometry[] = []
  let hardwareMaterial: MeshStandardMaterial | undefined
  let shellMaterials: MeshPhysicalMaterial[] = []
  let previousSeconds: number | undefined
  let disposed = false

  function updateVisibility(item: InstalledLivingCrystalPlatform): boolean {
    const visible = item.active && item.selected
    if (item.art.visible === visible) return false
    item.art.visible = visible
    return true
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
      const localBounds = new Box3().setFromObject(source, true)
      const stagedGeometries = [
        donor.shell.geometry.clone(),
        donor.hardware.geometry.clone(),
        donor.interior.geometry.clone(),
      ]
      const stagedHardwareMaterial = new MeshStandardMaterial({
        name: 'LivingCrystalV2_RuntimeGold',
        color: 0xf1c46c,
        metalness: 0.82,
        roughness: 0.16,
        emissive: 0x3a1600,
        emissiveIntensity: 0.18,
      })
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
          const animation = createLivingCrystalInteriorAnimation({
            ...placement.interior,
            reducedMotion: readReducedMotion(),
          })
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
          const interior = new Mesh(stagedGeometries[2]!, animation.material)
          copyTransform(donor.shell, shell)
          copyTransform(donor.hardware, hardware)
          copyTransform(donor.interior, interior)
          shell.name = LIVING_CRYSTAL_PLATFORM_NODES.shell
          hardware.name = LIVING_CRYSTAL_PLATFORM_NODES.hardware
          interior.name = LIVING_CRYSTAL_PLATFORM_NODES.interior
          for (const mesh of [shell, hardware, interior]) {
            mesh.userData.excludeFromCameraCollision = true
            mesh.castShadow = false
            mesh.receiveShadow = mesh !== interior
          }
          art.add(shell, hardware, interior)
          art.visible = false
          root.add(art)
          art.updateWorldMatrix(true, true)
          const matrix = new Matrix4()
            .makeRotationY(placement.rotationY)
            .setPosition(
              new Vector3(
                placement.position.x,
                placement.position.y,
                placement.position.z,
              ),
            )
          staged.push({
            platformId: placement.platformId,
            art,
            bounds: localBounds.clone().applyMatrix4(matrix),
            interior: animation,
            selected: true,
            active: false,
            reducedMotion: readReducedMotion(),
          })
        }
      } catch (error) {
        staged.forEach((item) => item.interior.dispose())
        stagedShellMaterials.forEach((material) => material.dispose())
        stagedHardwareMaterial.dispose()
        stagedGeometries.forEach((geometry) => geometry.dispose())
        root.clear()
        throw error
      }
      for (const id of covered) removeKitGeometry(floors.get(id)!)
      sceneRoot.add(root)
      geometries = stagedGeometries
      hardwareMaterial = stagedHardwareMaterial
      shellMaterials = stagedShellMaterials
      installed = staged
      return covered
    },
    update(snapshot: GameSnapshot): void {
      if (disposed || installed === undefined) return
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
        item.active = active.has(item.platformId)
        if (item.reducedMotion !== motionDisabled) {
          item.reducedMotion = motionDisabled
          item.interior.configure({ reducedMotion: motionDisabled })
        }
        if (reset) item.interior.reset()
        item.interior.update({ deltaSeconds, paused: snapshot.paused })
        updateVisibility(item)
      }
    },
    cullForView(camera: PerspectiveCamera | undefined): boolean {
      if (disposed || installed === undefined) return false
      viewSelector.update(camera, [])
      let changed = false
      for (const item of installed) {
        const selected = viewSelector.includes(item.bounds)
        if (item.selected !== selected) {
          item.selected = selected
          changed = true
        }
        changed = updateVisibility(item) || changed
      }
      return changed
    },
    snapshot() {
      const visible = installed?.filter((item) => item.art.visible).length ?? 0
      return {
        installed: installed?.length ?? 0,
        visible,
        // Primitive inventory; transmission can add renderer passes.
        visibleMeshPrimitives:
          visible * LIVING_CRYSTAL_PLATFORM_RUNTIME.meshDrawsPerPass,
        visibleGeometryTriangles:
          visible * LIVING_CRYSTAL_PLATFORM_RUNTIME.triangles,
        sharedGeometryBytes: geometryBytes(geometries),
        textures: 0,
        interiors: installed?.map((item) => item.interior.snapshot()) ?? [],
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      installed?.forEach((item) => item.interior.dispose())
      shellMaterials.forEach((material) => material.dispose())
      hardwareMaterial?.dispose()
      geometries.forEach((geometry) => geometry.dispose())
      root.clear()
      root.removeFromParent()
      installed = undefined
      shellMaterials = []
      geometries = []
    },
  }
}

export type LivingCrystalPlatformRenderer = ReturnType<
  typeof createLivingCrystalPlatformRenderer
>
