// ============================================================
// Floating museum — readable marble floors and ornament below the collision line.
// ============================================================

import type { Material, Object3D } from 'three'
import { BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, TorusGeometry, } from 'three'
import type { GameSnapshot, LevelDefinition, PlatformDefinition, } from '../contracts'
import { getPlatformRenderRecipe } from './catalog'
import { createKitInstance, kitFloorDimensions, removeKitGeometry, } from './kit-instance'
import type { MuseumMaterials } from './materials'
import { createPlatformPlanters } from './platform-details'
import { getMuseumSceneRecipe } from './scene-catalog'

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
  const mesh = new Mesh(new BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
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
  box(group, materials[recipe.body], w, h, d, 0, -h / 2, 0)
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
) {
  const root = new Group()
  const sceneRecipe = getMuseumSceneRecipe(level.id)
  const planters = new Map<string, Group>()
  let cameraMeshCache: Mesh[] | undefined
  let lastEnabled = ''
  const floors = new Map(
    level.platforms.map((platform) => {
      const floor = createFloor(platform, materials)
      if (sceneRecipe.planterPlatforms.includes(platform.id)) {
        const details = createPlatformPlanters(platform, materials)
        planters.set(platform.id, details)
        floor.add(details)
      }
      root.add(floor)
      return [platform.id, floor]
    }),
  )
  const pads = new Map<string, Mesh>()
  for (const target of level.breakables) {
    const pedestal = new Mesh(
      new CylinderGeometry(0.25, 0.29, 0.24, 32),
      materials.marble,
    )
    pedestal.position.copy(target.position)
    pedestal.position.y += 0.12
    pedestal.castShadow = pedestal.receiveShadow = true
    root.add(pedestal)
    ring(
      root,
      materials.gold,
      0.25,
      0.014,
      target.position.x,
      target.position.y + 0.24,
      target.position.z,
    )
    const pad = new Mesh(
      new CircleGeometry(0.23, 48),
      new MeshBasicMaterial({
        color: 0x68d9d3,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    )
    pad.rotation.x = -Math.PI / 2
    pad.position.copy(target.anchor)
    pad.position.y += 0.02
    root.add(pad)
    pads.set(target.id, pad)
    ring(
      root,
      materials.gold,
      0.24,
      0.012,
      target.anchor.x,
      target.anchor.y + 0.018,
      target.anchor.z,
    )
  }
  // Tall dressing is beyond the playable rectangles, leaving orbit and jumps open.
  for (const platform of level.platforms.filter((item) =>
    sceneRecipe.archPlatforms.includes(item.id),
  )) {
    const z = platform.minZ + 0.12
    for (const x of [platform.minX + 0.12, platform.maxX - 0.12])
      column(root, materials, x, platform.top, z)
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
    root.add(arch)
  }
  const exit = level.exit
  const portal = new Group()
  portal.position.set(
    (exit.minX + exit.maxX) / 2,
    exit.top + 0.75,
    (exit.minZ + exit.maxZ) / 2,
  )
  const halo = new Mesh(new TorusGeometry(0.59, 0.035, 8, 64), materials.gold)
  portal.add(halo)
  const inner = new Mesh(
    new TorusGeometry(0.52, 0.014, 6, 64),
    new MeshBasicMaterial({ color: 0xaaffee }),
  )
  portal.add(inner)
  root.add(portal)
  return {
    root,
    cameraOccluders() {
      if (cameraMeshCache) return cameraMeshCache
      const meshes: Mesh[] = []
      root.updateWorldMatrix(true, true)
      for (const child of root.children) {
        if (!child.visible) continue
        child.traverse((object) => {
          const mesh = object as Mesh
          if (!mesh.isMesh || !mesh.visible) return
          const material = Array.isArray(mesh.material)
            ? mesh.material[0]
            : mesh.material
          if (material.depthWrite && !material.transparent) meshes.push(mesh)
        })
      }
      cameraMeshCache = meshes
      return meshes
    },
    setKit(scene: Object3D, bundle: string) {
      cameraMeshCache = undefined
      for (const platform of level.platforms) {
        const recipe = getPlatformRenderRecipe(
          platform.renderId ?? platform.kind,
        )
        if (recipe.bundle !== bundle || recipe.kitNode === undefined) continue
        const source = scene.getObjectByName(recipe.kitNode)
        const floor = floors.get(platform.id)
        if (!source || !floor) continue
        const dimensions = kitFloorDimensions(source)
        const art = createKitInstance(
          source,
          materials,
          recipe.materialOverrides,
        )
        art.scale.set(
          (platform.maxX - platform.minX) / dimensions.x,
          1,
          (platform.maxZ - platform.minZ) / dimensions.z,
        )
        const details = planters.get(platform.id)
        details?.removeFromParent()
        removeKitGeometry(floor)
        floor.add(art)
        if (details !== undefined) floor.add(details)
      }
      for (const decoration of sceneRecipe.kitDecorations) {
        if (decoration.bundle !== bundle) continue
        const source = scene.getObjectByName(decoration.node)
        if (source === undefined) continue
        const art = createKitInstance(source, materials)
        art.position.copy(decoration.position)
        art.scale.setScalar(decoration.scale)
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
    },
    update(snapshot: GameSnapshot) {
      const enabled = snapshot.enabledPlatformIds.join('|')
      if (enabled !== lastEnabled) {
        cameraMeshCache = undefined
        lastEnabled = enabled
      }
      floors.forEach((floor, id) => {
        floor.visible = snapshot.enabledPlatformIds.includes(id)
      })
      pads.forEach((pad, id) => {
        pad.visible = !snapshot.completedBreakableIds.includes(id)
        ;(pad.material as MeshBasicMaterial).opacity =
          snapshot.nearbyBreakableId === id ? 0.55 : 0.18
      })
      inner.visible = exit.requiresCompleted.every((id) =>
        snapshot.completedBreakableIds.includes(id),
      )
    },
  }
}
