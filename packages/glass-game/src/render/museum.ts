// ============================================================
// Floating museum — readable marble floors and ornament below the collision line.
// ============================================================

import type { Material, Object3D, PerspectiveCamera, Scene, Texture, WebGLRenderer, } from 'three'
import { Box3, BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, } from 'three'
import { EXHIBIT_PLINTH } from '../content/solid-props'
import type { GameSnapshot, LevelDefinition, PlatformDefinition, SolidMaterialRole, Vec3, } from '../contracts'
import { getActiveSolidIds } from '../core/solid-activation'
import { getPlatformRenderRecipe } from './catalog'
import { createCloudwayPlatformRenderer } from './cloudway-platforms'
import { createExhibitApproachPads } from './exhibit-approach-pads'
import { createPlatformFloorArt, removeEmbeddedFloorInlay } from './floor-art'
import { createKitInstance, kitFloorDimensions, removeKitGeometry, } from './kit-instance'
import { createMaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'
import { createPlanarReflectionController } from './planar-reflections'
import { createPlatformPlanters } from './platform-details'
import { createPlatformDressing } from './platform-dressing'
import { createRoomDecorations } from './room-decorations'
import { createRoomVisibilityController } from './room-visibility'
import { getMuseumSceneRecipe, getMuseumVisualRecipe } from './scene-catalog'
import { stretchSurfaceUv } from './surface-uv'

function box(
  parent: Group,
  material: Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const source = new BoxGeometry(w, h, d)
  const geometry = stretchSurfaceUv(source, new Vector3(w, h, d))
  source.dispose()
  const mesh = new Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function proxyMaterial(
  role: SolidMaterialRole | undefined,
  materials: MuseumMaterials,
  fallback: Material,
): Material {
  if (role === 'brass') return materials.gold
  if (role === 'glass') return materials.glass
  if (role === 'stone') return materials.marble
  return fallback
}

function ring(
  parent: Group,
  material: Material,
  radius: number,
  tube: number,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new Mesh(new TorusGeometry(radius, tube, 5, 48), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function createFloor(platform: PlatformDefinition, materials: MuseumMaterials) {
  const recipe = getPlatformRenderRecipe(platform.renderId ?? platform.kind)
  const group = new Group()
  group.name = `floor-${platform.id}`
  const w = platform.maxX - platform.minX
  const d = platform.maxZ - platform.minZ
  const h = platform.thickness
  const cx = (platform.minX + platform.maxX) / 2
  const cz = (platform.minZ + platform.maxZ) / 2
  group.position.set(cx, platform.top, cz)
  box(
    group,
    proxyMaterial(
      platform.presentation?.material,
      materials,
      materials[recipe.body],
    ),
    w,
    h,
    d,
    0,
    -h / 2,
    0,
  )
  if (!recipe.outline) return group
  // The whole rectangle remains an honest floor. Inlays have no protruding rails.
  for (const sign of [-1, 1]) {
    box(group, materials.gold, w, 0.014, 0.025, 0, 0.006, sign * (d / 2 - 0.04))
    box(group, materials.gold, 0.025, 0.014, d, sign * (w / 2 - 0.04), 0.006, 0)
  }
  if (platform.kind === 'bridge') {
    const horizontal = w > d
    box(
      group,
      materials.teal,
      horizontal ? w : w * 0.65,
      0.008,
      horizontal ? d * 0.65 : d,
      0,
      0.003,
      0,
    )
    const steps = Math.ceil(Math.max(w, d) / 0.3)
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps - 0.5
      box(
        group,
        materials.gold,
        horizontal ? 0.016 : w * 0.72,
        0.012,
        horizontal ? d * 0.72 : 0.016,
        horizontal ? t * w : 0,
        0.006,
        horizontal ? 0 : t * d,
      )
    }
  } else if (recipe.suspendedHull && w > 1.7 && d > 1.7) {
    const r = Math.min(w, d) * 0.35
    ring(group, materials.gold, r, 0.012, 0, 0.012, 0)
    ring(group, materials.teal, r - 0.07, 0.024, 0, 0.007, 0)
    const underside = new Mesh(
      new ConeGeometry(Math.min(w, d) * 0.48, 1.1, 7),
      materials.rock,
    )
    underside.rotation.z = Math.PI
    underside.position.y = -h - 0.52
    underside.scale.x = Math.max(1, w / d)
    underside.scale.z = Math.max(1, d / w)
    underside.castShadow = true
    group.add(underside)
    box(group, materials.teal, w * 0.84, h * 0.55, d * 0.84, 0, -h * 0.8, 0)
    box(group, materials.gold, w * 0.86, 0.035, d * 0.86, 0, -h * 1.07, 0)
  }
  return group
}

function column(
  parent: Group,
  materials: MuseumMaterials,
  x: number,
  y: number,
  z: number,
  height = 1.8,
) {
  const shaft = new Mesh(
    new CylinderGeometry(0.065, 0.09, height, 12),
    materials.marble,
  )
  shaft.position.set(x, y + height / 2, z)
  shaft.castShadow = true
  parent.add(shaft)
  for (const offset of [0.05, height - 0.05])
    ring(parent, materials.gold, 0.095, 0.023, x, y + offset, z)
  const tip = new Mesh(new SphereGeometry(0.085, 12, 8), materials.gold)
  tip.position.set(x, y + height + 0.08, z)
  parent.add(tip)
}

export function createMuseum(
  level: LevelDefinition,
  materials: MuseumMaterials,
  onReflectionError: (error: unknown) => void = () => undefined,
) {
  const root = new Group()
  const materialLibrary = createMaterialLibrary()
  const sceneRecipe = getMuseumSceneRecipe(level)
  const roomVisibility = createRoomVisibilityController(
    level.presentation?.rooms ?? [],
  )
  const roomGroups = new Map(
    [...roomVisibility.roomIds].map((id) => {
      const group = new Group()
      group.name = `room-${id}`
      // Room children are compiled in world coordinates; keep this owner at identity.
      root.add(group)
      return [id, group]
    }),
  )
  const roomGroupSet = new Set(roomGroups.values())
  const renderParent = (runtimeId: string) => {
    const roomId = roomVisibility.roomIdForRuntimeId(runtimeId)
    return (roomId === undefined ? undefined : roomGroups.get(roomId)) ?? root
  }
  let roomRenderBoundsDirty = true
  const decorations = createRoomDecorations(level, materials, materialLibrary)
  const planarReflections = createPlanarReflectionController(
    () => decorations.planarMirrors,
    onReflectionError,
  )
  for (const instance of decorations.instances) {
    const room = roomGroups.get(instance.roomId)
    if (room === undefined)
      throw new Error(
        `Room decoration could not find authored room "${instance.roomId}".`,
      )
    room.add(instance.root)
  }
  const planters = new Map<string, Group>()
  const coveredSolids = new Set<string>()
  const installedVisuals: {
    art: Group
    coveredSolidIds: readonly string[]
  }[] = []
  const visualTemplates = new Map<string, Group>()
  const solidProxies = (level.solids ?? []).flatMap((solid) => {
    if (!solid.fallback && !solid.presentation) return []
    const material = proxyMaterial(
      solid.presentation?.material,
      materials,
      materials.marble,
    )
    const mesh =
      solid.shape === 'box'
        ? box(
            renderParent(solid.id),
            material,
            solid.maxX - solid.minX,
            solid.thickness,
            solid.maxZ - solid.minZ,
            (solid.minX + solid.maxX) / 2,
            solid.top - solid.thickness / 2,
            (solid.minZ + solid.maxZ) / 2,
          )
        : new Mesh(
            new CylinderGeometry(
              solid.radiusTop,
              solid.radiusBottom,
              solid.thickness,
              32,
            ),
            material,
          )
    mesh.name = `solid-${solid.id}`
    if (solid.shape === 'cylinder') {
      mesh.position.set(solid.x, solid.top - solid.thickness / 2, solid.z)
      mesh.castShadow = mesh.receiveShadow = true
      renderParent(solid.id).add(mesh)
    }
    return [{ solid, mesh }]
  })
  const dressing = createPlatformDressing(
    level,
    sceneRecipe,
    materials,
    materialLibrary,
  )
  root.add(dressing.root)
  let cameraMeshCache: Mesh[] | undefined
  let lastActive: string | undefined
  let activeSolids = new Set(getActiveSolidIds(level, new Set<string>()))
  const floorArt = createPlatformFloorArt(level, materials)
  const floors = new Map(
    level.platforms.map((platform) => {
      const floor = createFloor(platform, materials)
      const inlay = floorArt.get(platform.id)
      if (inlay !== undefined) floor.add(inlay)
      if (
        sceneRecipe.planterPlatforms.includes(platform.id) &&
        !solidProxies.some(
          ({ solid }) =>
            solid.platformId === platform.id &&
            solid.fallback?.replacedByBundle === 'museum-garden-v2',
        )
      ) {
        const details = createPlatformPlanters(platform, materials)
        planters.set(platform.id, details)
        floor.add(details)
      }
      renderParent(platform.id).add(floor)
      return [platform.id, floor]
    }),
  )
  const cloudwayPlatforms = createCloudwayPlatformRenderer(
    level,
    root,
    floors,
    materials,
    materialLibrary,
  )
  const pads = createExhibitApproachPads(level, renderParent, materials.gold)
  for (const target of level.breakables) {
    const parent = renderParent(target.id)
    if (target.mount === undefined) {
      const pedestal = new Mesh(
        new CylinderGeometry(
          EXHIBIT_PLINTH.radiusTop,
          EXHIBIT_PLINTH.radiusBottom,
          EXHIBIT_PLINTH.height,
          32,
        ),
        materials.marble,
      )
      pedestal.name = `legacy-plinth-${target.id}`
      pedestal.position.copy(target.position)
      pedestal.position.y += EXHIBIT_PLINTH.height / 2
      pedestal.castShadow = pedestal.receiveShadow = true
      parent.add(pedestal)
      ring(
        parent,
        materials.gold,
        EXHIBIT_PLINTH.radiusTop,
        0.014,
        target.position.x,
        target.position.y + EXHIBIT_PLINTH.height,
        target.position.z,
      )
    }
  }
  // Tall dressing is beyond the playable rectangles, leaving orbit and jumps open.
  for (const platform of level.platforms.filter((item) =>
    sceneRecipe.archPlatforms.includes(item.id),
  )) {
    const parent = renderParent(platform.id)
    const z = platform.minZ + 0.12
    for (const x of [platform.minX + 0.12, platform.maxX - 0.12])
      column(parent, materials, x, platform.top, z)
    const arch = new Mesh(
      new TorusGeometry(
        (platform.maxX - platform.minX - 0.24) / 2,
        0.055,
        6,
        32,
        Math.PI,
      ),
      materials.gold,
    )
    arch.position.set(
      (platform.minX + platform.maxX) / 2,
      platform.top + 1.8,
      z,
    )
    parent.add(arch)
  }
  const setVisibleRooms = (visibleRoomIds: ReadonlySet<string>) => {
    let changed = false
    roomGroups.forEach((group, id) => {
      const visible = visibleRoomIds.has(id)
      if (group.visible !== visible) changed = true
      group.visible = visible
    })
    return changed
  }
  return {
    root,
    materialLibrary,
    cameraOccluders() {
      if (cameraMeshCache) return cameraMeshCache
      const meshes: Mesh[] = []
      root.updateWorldMatrix(true, true)
      const collectVisibleMeshes = (object: Object3D) => {
        if (!object.visible) return
        object.traverseVisible((candidate) => {
          const mesh = candidate as Mesh
          if (!mesh.isMesh || !mesh.visible) return
          const material = Array.isArray(mesh.material)
            ? mesh.material[0]
            : mesh.material
          if (material.depthWrite && !material.transparent) meshes.push(mesh)
        })
      }
      for (const child of root.children) {
        // Render culling must never remove a wall from camera collision before
        // the next selection. Ignore only the room owner's visibility flag;
        // activated gates and covered proxies still use child visibility.
        if (roomGroupSet.has(child as Group))
          child.children.forEach(collectVisibleMeshes)
        else collectVisibleMeshes(child)
      }
      cameraMeshCache = meshes
      return meshes
    },
    setKit(scene: Object3D, bundle: string) {
      cameraMeshCache = undefined
      const cloudwayPlatformIds = cloudwayPlatforms.install(scene, bundle)
      for (const { solid, mesh } of solidProxies)
        if (
          solid.fallback?.replacedByBundle === bundle &&
          scene.getObjectByName(solid.fallback.replacedByNode)
        ) {
          coveredSolids.add(solid.id)
          mesh.visible = false
        }
      for (const id of decorations.installBundle(scene, bundle)) {
        coveredSolids.add(id)
        const proxy = solidProxies.find(({ solid }) => solid.id === id)
        if (proxy !== undefined) proxy.mesh.visible = false
      }
      dressing.install(scene, bundle, (id) => {
        const previous = planters.get(id)
        if (previous) {
          removeKitGeometry(previous)
          previous.removeFromParent()
          planters.delete(id)
        }
      })
      for (const platform of level.platforms) {
        if (cloudwayPlatformIds.has(platform.id)) continue
        const recipe = getPlatformRenderRecipe(
          platform.renderId ?? platform.kind,
        )
        if (recipe.bundle !== bundle || recipe.kitNode === undefined) continue
        const source = scene.getObjectByName(recipe.kitNode)
        const floor = floors.get(platform.id)
        if (source === undefined)
          throw new Error(
            `Museum platform "${platform.id}" could not find node "${recipe.kitNode}" in bundle "${bundle}".`,
          )
        if (floor === undefined)
          throw new Error(
            `Museum platform "${platform.id}" has no render floor for bundle "${bundle}".`,
          )
        const dimensions = kitFloorDimensions(source)
        const inlay = floorArt.get(platform.id)
        const art = createKitInstance(
          source,
          materials,
          recipe.materialOverrides,
          materialLibrary,
        )
        if (inlay !== undefined) removeEmbeddedFloorInlay(art, dimensions)
        art.scale.set(
          (platform.maxX - platform.minX) / dimensions.x,
          1,
          (platform.maxZ - platform.minZ) / dimensions.z,
        )
        art.traverse((object) => {
          const mesh = object as Mesh
          if (!mesh.isMesh) return
          const previous = mesh.geometry
          mesh.geometry = stretchSurfaceUv(previous, art.scale)
          previous.dispose()
        })
        const details = planters.get(platform.id)
        details?.removeFromParent()
        inlay?.removeFromParent()
        removeKitGeometry(floor)
        floor.add(art)
        if (inlay !== undefined) floor.add(inlay)
        if (details !== undefined) floor.add(details)
      }
      for (const decoration of sceneRecipe.kitDecorations) {
        if (decoration.bundle !== bundle) continue
        const source = scene.getObjectByName(decoration.node)
        if (source === undefined)
          throw new Error(
            `Museum decoration could not find node "${decoration.node}" in bundle "${bundle}".`,
          )
        const art = createKitInstance(source, materials, {}, materialLibrary)
        art.position.copy(decoration.position)
        art.scale.setScalar(decoration.scale)
        art.rotation.y = decoration.yaw ?? 0
        root.add(art)
        if (decoration.pedestalRadius !== undefined) {
          const radius = decoration.pedestalRadius
          const pedestal = new Mesh(
            new CylinderGeometry(radius, radius * 0.68, 0.6, 16),
            materials.marble,
          )
          pedestal.position.copy(decoration.position)
          pedestal.position.y -= 0.3
          root.add(pedestal)
        }
      }
      for (const visual of level.presentation?.visuals ?? []) {
        const recipe = getMuseumVisualRecipe(visual.recipeId)
        if (recipe.bundle !== bundle) continue
        let template = visualTemplates.get(visual.recipeId)
        if (template === undefined) {
          const source = scene.getObjectByName(recipe.node)
          if (source === undefined)
            throw new Error(
              `Museum visual recipe "${visual.recipeId}" could not find node "${recipe.node}" in bundle "${bundle}".`,
            )
          template = createKitInstance(source, materials, {}, materialLibrary)
          template.scale.setScalar(recipe.scale)
          visualTemplates.set(visual.recipeId, template)
        }
        const art = template.clone(true)
        art.name = `visual-${visual.id}`
        art.position.copy(visual.position)
        art.rotation.y = visual.yaw
        const coveredSolidIds = visual.coveredSolidIds ?? []
        art.visible =
          coveredSolidIds.length === 0 ||
          coveredSolidIds.some((id) => activeSolids.has(id))
        renderParent(visual.id).add(art)
        installedVisuals.push({ art, coveredSolidIds })
        for (const id of coveredSolidIds) {
          coveredSolids.add(id)
          const proxy = solidProxies.find(({ solid }) => solid.id === id)
          if (proxy !== undefined) proxy.mesh.visible = false
        }
      }
      cloudwayPlatforms.refreshShadowReceivers()
      roomRenderBoundsDirty = true
    },
    update(snapshot: GameSnapshot) {
      const activeSolidIds =
        snapshot.activeSolidIds ??
        getActiveSolidIds(level, new Set(snapshot.completedBreakableIds))
      const active = new Set(activeSolidIds)
      activeSolids = active
      decorations.update(active)
      dressing.update(snapshot.enabledPlatformIds)
      for (const { solid, mesh } of solidProxies) {
        const solidActive = active.has(solid.id)
        mesh.visible = !coveredSolids.has(solid.id) && solidActive
      }
      for (const { art, coveredSolidIds } of installedVisuals)
        art.visible =
          coveredSolidIds.length === 0 ||
          coveredSolidIds.some((id) => active.has(id))
      const enabled = activeSolidIds.join('|')
      const shadowVisibilityChanged = enabled !== lastActive
      if (shadowVisibilityChanged) {
        cameraMeshCache = undefined
        lastActive = enabled
      }
      floors.forEach((floor, id) => {
        floor.visible = active.has(id)
      })
      cloudwayPlatforms.update(snapshot)
      pads.update(snapshot)
      return shadowVisibilityChanged
    },
    cullCloudwayPlatforms(camera: PerspectiveCamera | undefined) {
      return cloudwayPlatforms.cullForView(camera)
    },
    roomIdForRuntimeId: roomVisibility.roomIdForRuntimeId,
    setDecorationTexture(assetId: string, texture: Texture) {
      decorations.installTexture(assetId, texture)
    },
    updateRoomVisibility(player: Vec3, camera: PerspectiveCamera) {
      if (roomRenderBoundsDirty) {
        roomGroups.forEach((group, id) => {
          const bounds = new Box3().setFromObject(group)
          roomVisibility.includeRenderBounds(id, bounds)
        })
        roomRenderBoundsDirty = false
      }
      const selection = roomVisibility.select(player, camera)
      return {
        ...selection,
        shadowVisibilityChanged: setVisibleRooms(selection.visibleRoomIds),
      }
    },
    planarReflectionMetrics: planarReflections.metrics,
    updatePlanarReflection(
      renderer: WebGLRenderer,
      scene: Scene,
      camera: PerspectiveCamera,
      width: number,
      height: number,
      withAdditionalVisible: (capture: () => void) => void,
    ) {
      return planarReflections.update(
        renderer,
        scene,
        camera,
        width,
        height,
        (capture) => {
          const roomVisibility = new Map(
            [...roomGroups].map(([id, group]) => [id, group.visible]),
          )
          try {
            roomGroups.forEach((group) => {
              group.visible = true
            })
            withAdditionalVisible(capture)
          } finally {
            roomGroups.forEach((group, id) => {
              group.visible = roomVisibility.get(id) ?? true
            })
          }
        },
      )
    },
    setVisibleRooms,
    dispose() {
      cloudwayPlatforms.dispose()
      decorations.dispose()
    },
  }
}
