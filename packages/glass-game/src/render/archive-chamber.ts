// Archive chamber dressing — room-owned cabinets, shared intact shelf vessels, protective glass and note plaques.

import type { BufferGeometry, Material, Object3D } from 'three'
import { Box3, BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector2, Vector3, } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { LevelDefinition } from '../contracts'
import { createArchiveCurtain } from './archive-curtain'
import type { ArchiveChamberDefinition, ArchiveShelfResources, } from './archive-layout'
import type { GlassRendererPresentation } from './glass-renderer-contracts'

const SHELF_VASES = [
  {
    node: 'vase_amphora_intact',
    slots: [
      [-2.85, 1.34, 4.12],
      [2.85, 1.34, 4.12],
    ],
  },
  {
    node: 'vase_fluted_intact',
    slots: [
      [4.02, 0.88, -2.65],
      [-4.02, 0.88, 2.65],
    ],
  },
  {
    node: 'vase_rounded_intact',
    slots: [
      [-2.85, 2.14, 4.12],
      [2.85, 2.14, 4.12],
      [-4.02, 1.72, 2.65],
      [4.02, 1.72, 2.65],
    ],
  },
] as const

function labelTexture(title: string, label: string): CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const context = canvas.getContext('2d')
  if (context === null) return undefined
  context.fillStyle = '#11282c'
  context.fillRect(0, 0, 512, 160)
  context.strokeStyle = '#bda36b'
  context.lineWidth = 3
  context.strokeRect(10, 10, 492, 140)
  context.fillStyle = '#f3e7be'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '30px Georgia, serif'
  context.fillText(title, 256, 51, 460)
  context.font = '48px Georgia, serif'
  context.fillText(label, 256, 112, 460)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function createArchiveChamber(
  level: LevelDefinition,
  museumRoot: Group,
  definition: ArchiveChamberDefinition,
  shelfResources: ArchiveShelfResources,
) {
  const parent = museumRoot.getObjectByName(`room-${definition.sceneRoomId}`)
  if (parent === undefined) return undefined
  const centerZ = definition.centerZ
  const root = new Group()
  root.name = `archive-dark-room-${definition.id}`
  root.position.z = centerZ
  parent.add(root)
  const geometry = new Set<BufferGeometry>()
  const ownedMaterials = new Set<Material>()
  const shelfMaterials = shelfResources.materials
  const ownGeometry = <T extends BufferGeometry>(value: T): T => {
    geometry.add(value)
    return value
  }
  const ownMaterial = <T extends Material>(value: T): T => {
    ownedMaterials.add(value)
    return value
  }
  const brass = ownMaterial(
    new MeshStandardMaterial({
      color: 0xc8a66a,
      metalness: 0.88,
      roughness: 0.32,
    }),
  )
  const cabinet = ownMaterial(
    new MeshStandardMaterial({
      color: 0x10292b,
      metalness: 0.12,
      roughness: 0.5,
    }),
  )
  const velvet = ownMaterial(
    new MeshStandardMaterial({ color: 0x07171f, roughness: 0.94 }),
  )
  const glow = ownMaterial(new MeshBasicMaterial({ color: 0xe9bf75 }))
  const batches = new Map<Material, BufferGeometry[]>()
  const batch = (
    shape: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    rotationY = 0,
  ) => {
    shape.rotateY(rotationY)
    shape.translate(x, y, z)
    const items = batches.get(material) ?? []
    items.push(shape)
    batches.set(material, items)
  }
  const box = (
    material: Material,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ) => batch(new BoxGeometry(w, h, d), material, x, y, z)

  // Cabinet backs sit inside the authored wall envelope; content owns their solid footprint.
  for (const side of [-1, 1]) {
    box(velvet, 0.08, 3.3, 8.6, side * 4.42, 1.65, 0)
    for (const centerZ of [-2.65, 2.65]) {
      box(cabinet, 0.68, 0.16, 2.2, side * 4.1, 0.17, centerZ)
      box(cabinet, 0.6, 2.55, 0.08, side * 4.1, 1.45, centerZ - 1.04)
      box(cabinet, 0.6, 2.55, 0.08, side * 4.1, 1.45, centerZ + 1.04)
      for (const y of [0.84, 1.68]) {
        box(cabinet, 0.63, 0.08, 2.14, side * 4.1, y, centerZ)
        box(brass, 0.022, 0.035, 2.16, side * 3.77, y + 0.01, centerZ)
        box(glow, 0.025, 0.012, 1.8, side * 3.81, y - 0.05, centerZ)
      }
      for (const offset of [-1.03, 1.03])
        box(brass, 0.03, 2.35, 0.03, side * 3.76, 1.5, centerZ + offset)
      batch(
        new TorusGeometry(1.03, 0.018, 5, 36, Math.PI),
        brass,
        side * 3.76,
        2.65,
        centerZ,
        Math.PI / 2,
      )
    }
  }
  // Opaque night panels close the window bays without changing collision or the authored doorway.
  for (const side of [-1, 1])
    for (const x of [-2.85, 2.85])
      box(velvet, 2.75, 3.3, 0.06, x, 1.65, side * 4.42)
  // The two window recesses become shallow display cabinets. They sit outside
  // the walking route and make the intact collection visible from the entrance.
  for (const x of [-2.85, 2.85]) {
    for (const y of [0.48, 1.3, 2.1]) {
      box(cabinet, 2.18, 0.075, 0.44, x, y, 4.18)
      box(brass, 2.18, 0.025, 0.025, x, y + 0.015, 3.95)
      box(glow, 1.92, 0.008, 0.018, x, y - 0.04, 3.98)
    }
    for (const offset of [-1.05, 1.05])
      box(brass, 0.025, 2.7, 0.025, x + offset, 1.65, 3.95)
    batch(new TorusGeometry(1.05, 0.014, 5, 36, Math.PI), brass, x, 2.78, 3.95)
  }
  box(velvet, 8.88, 0.08, 8.88, 0, 3.78, 0)
  for (const radius of [1.25, 1.31]) {
    const ring = new TorusGeometry(radius, 0.009, 4, 64)
    ring.rotateX(Math.PI / 2)
    batch(ring, brass, 0, 0.018, 0.8)
  }
  for (const [material, shapes] of batches) {
    const combined = mergeGeometries(shapes, false)
    shapes.forEach((shape) => shape.dispose())
    if (combined === null)
      throw new Error('Archive cabinet geometry could not be combined.')
    const mesh = new Mesh(ownGeometry(combined), material)
    mesh.name = `archive-dressing-${material === brass ? 'brass' : material === glow ? 'light-lines' : material === cabinet ? 'cabinet' : 'night-panels'}`
    mesh.receiveShadow = material !== glow
    mesh.userData.excludeFromCameraCollision = true
    root.add(mesh)
  }

  const coverRoot = new Group()
  coverRoot.name = 'archive-protective-cloche'
  coverRoot.visible = false
  const dome = ownGeometry(
    new LatheGeometry(
      [
        new Vector2(0.57, 0),
        new Vector2(0.57, 0.1),
        new Vector2(0.55, 0.68),
        new Vector2(0.49, 0.9),
        new Vector2(0.35, 1.07),
        new Vector2(0.13, 1.16),
        new Vector2(0, 1.17),
      ],
      40,
    ),
  )
  const coverGlass = ownMaterial(
    new MeshPhysicalMaterial({
      color: 0xc4eee5,
      metalness: 0,
      roughness: 0.08,
      transparent: true,
      opacity: 0.22,
      transmission: 0.15,
      thickness: 0.015,
      clearcoat: 1,
      depthWrite: false,
    }),
  )
  coverRoot.add(new Mesh(dome, coverGlass))
  const coverRim = new Mesh(
    ownGeometry(new TorusGeometry(0.57, 0.018, 6, 40)),
    brass,
  )
  coverRim.rotation.x = Math.PI / 2
  coverRoot.add(coverRim)
  const handle = new Mesh(ownGeometry(new SphereGeometry(0.055, 12, 8)), brass)
  handle.position.y = 1.22
  coverRoot.add(handle)
  const hushDisplays = definition.hush
    ? definition.vesselIds.flatMap((id) => {
        const target = level.breakables.find((item) => item.id === id)
        return target === undefined ? [] : [target]
      })
    : []
  const parkedX = (hushDisplays[0]?.position.x ?? 1.35) + 1.05
  coverRoot.position.set(parkedX, 0.3, 0.8)
  const rail = new Mesh(ownGeometry(new BoxGeometry(4.45, 0.025, 0.025)), brass)
  rail.name = 'archive-cloche-rail'
  rail.visible = false
  rail.position.set(0, 0.31, 1.4)
  root.add(coverRoot, rail)
  const patinatedBrass = ownMaterial(
    new MeshStandardMaterial({
      color: 0x24433f,
      metalness: 0.45,
      roughness: 0.4,
    }),
  )
  const coverDishes = hushDisplays.map(({ position: { x, z } }) => {
    const dish = new Mesh(
      ownGeometry(new CylinderGeometry(0.59, 0.58, 0.014, 40)),
      patinatedBrass,
    )
    dish.name = `archive-cloche-dish-${x}`
    dish.position.set(x, 0.303, z - centerZ)
    dish.visible = false
    const lip = new Mesh(
      ownGeometry(new TorusGeometry(0.588, 0.006, 4, 40)),
      brass,
    )
    lip.rotation.x = Math.PI / 2
    lip.position.y = 0.008
    dish.add(lip)
    root.add(dish)
    return dish
  })
  const protectionMaterial = ownMaterial(
    new MeshBasicMaterial({
      color: 0x91c5aa,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  )
  const aimMaterial = ownMaterial(
    new MeshBasicMaterial({
      color: 0xc4aa73,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  )
  const protectors = hushDisplays.map(({ position: { x, z } }) => {
    const ring = new Mesh(
      ownGeometry(new TorusGeometry(0.47, 0.006, 4, 36)),
      protectionMaterial,
    )
    ring.rotation.x = Math.PI / 2
    ring.position.set(x, 0.318, z - centerZ)
    ring.visible = false
    root.add(ring)
    return ring
  })
  const curtain = createArchiveCurtain(
    level.breakables.filter((item) =>
      definition.curtainVesselIds.includes(item.id),
    ),
    centerZ,
  )
  if (curtain !== undefined) root.add(curtain.root)
  const plaques = new Map<
    string,
    { mesh: Mesh<PlaneGeometry, MeshBasicMaterial>; label: string }
  >()
  const clonedMaterials = new Map<Material, Material>()
  const restoredMaterials = new Map<Mesh, Material | Material[]>()
  const hiddenProxies = new Map<Object3D, boolean>()
  const shelfInstances: InstancedMesh[] = []
  let installedShelf = false
  let disposed = false

  return {
    root,
    /** Called after required models load, so only this room receives owned material variants. */
    finishInstallation() {
      parent.traverse((object) => {
        if (
          hushDisplays.length > 0 &&
          object.name.startsWith('approach-pad-')
        ) {
          hiddenProxies.set(object, object.visible)
          object.visible = false
          return
        }
        const mesh = object as Mesh
        if (!mesh.isMesh || mesh.getObjectById(root.id) !== undefined) return
        let owner: Object3D | null = mesh
        while (owner !== null && owner !== root) owner = owner.parent
        if (owner === root) return
        if (/\/solid\/archive-(north-)?(west|east)-cabinet$/.test(mesh.name)) {
          hiddenProxies.set(mesh, mesh.visible)
          mesh.visible = false
          return
        }
        restoredMaterials.set(mesh, mesh.material)
        const tint = (original: Material): Material => {
          const existing = clonedMaterials.get(original)
          if (existing !== undefined) return existing
          const copy = original.clone() as MeshStandardMaterial
          if (
            copy.isMeshStandardMaterial &&
            copy.metalness < 0.6 &&
            !copy.transparent
          ) {
            copy.color.multiply(new Color(0x375a5c))
            copy.roughness = Math.max(copy.roughness, 0.36)
          }
          clonedMaterials.set(original, copy)
          return copy
        }
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(tint)
          : tint(mesh.material)
      })
    },
    installBundle(source: Object3D, bundle: string) {
      if (disposed || installedShelf || bundle !== 'vessels') return
      installedShelf = true
      for (const entry of SHELF_VASES) {
        const node = source.getObjectByName(entry.node)
        if (node === undefined)
          throw new Error(`Archive shelf is missing ${entry.node}.`)
        node.updateWorldMatrix(true, true)
        const bounds = new Box3().setFromObject(node, true)
        const size = bounds.getSize(new Vector3())
        const center = bounds.getCenter(new Vector3())
        const scale = Math.min(0.55 / size.y, 0.44 / Math.max(size.x, size.z))
        node.traverse((object) => {
          const sourceMesh = object as Mesh
          if (!sourceMesh.isMesh) return
          let shaped = shelfResources.geometry.get(sourceMesh)
          if (shaped === undefined) {
            shaped = sourceMesh.geometry
              .clone()
              .applyMatrix4(sourceMesh.matrixWorld)
            shaped.translate(-center.x, -bounds.min.y, -center.z)
            shaped.scale(scale, scale, scale)
            shelfResources.geometry.set(sourceMesh, shaped)
          }
          const instances = new InstancedMesh(
            shaped,
            Array.isArray(sourceMesh.material)
              ? sourceMesh.material.map((material) =>
                  shelfMaterials.clone(material, undefined, scale),
                )
              : shelfMaterials.clone(sourceMesh.material, undefined, scale),
            entry.slots.length,
          )
          instances.name = `archive-shelf-${entry.node}`
          entry.slots.forEach(([x, y, z], index) =>
            instances.setMatrixAt(
              index,
              new Matrix4().makeTranslation(x, y, z),
            ),
          )
          instances.computeBoundingSphere()
          shelfInstances.push(instances)
          root.add(instances)
        })
      }
    },
    update(
      presentation: GlassRendererPresentation | undefined,
      dt: number,
      completed = false,
    ) {
      hiddenProxies.forEach((_visible, object) => {
        object.visible = false
      })
      const activeHush = presentation?.archiveHush
      const hush = activeHush?.roomId === definition.id ? activeHush : undefined
      curtain?.update(completed || (hush?.curtainClosed ?? false), dt)
      coverRoot.visible = rail.visible = definition.hush
      coverDishes.forEach((dish) => {
        dish.visible = definition.hush
      })
      if (hush !== undefined) {
        const targetX =
          hush.coveredIndex === null
            ? parkedX
            : (hushDisplays[hush.coveredIndex]?.position.x ?? parkedX)
        coverRoot.position.x +=
          (targetX - coverRoot.position.x) * Math.min(1, dt * 8)
        const targetZ =
          hush.coveredIndex === null
            ? 0.8
            : (hushDisplays[hush.coveredIndex]?.position.z ?? centerZ + 0.8) -
              centerZ
        coverRoot.position.z +=
          (targetZ - coverRoot.position.z) * Math.min(1, dt * 8)
      }
      protectors.forEach((ring, index) => {
        const protectedGlass =
          completed || (hush?.protectedIndices.includes(index) ?? false)
        ring.visible = protectedGlass || hush?.aimedIndex === index
        ring.material = protectedGlass ? protectionMaterial : aimMaterial
      })
      for (const note of presentation?.archiveNotes ?? []) {
        const target = level.breakables.find((item) => item.id === note.id)
        if (target === undefined || !definition.noteVesselIds.includes(note.id))
          continue
        let plaque = plaques.get(note.id)
        if (plaque === undefined) {
          const material = ownMaterial(
            new MeshBasicMaterial({ color: 0xffffff }),
          )
          const mesh = new Mesh(
            ownGeometry(new PlaneGeometry(0.74, 0.24)),
            material,
          )
          mesh.name = `archive-note-${note.id}`
          mesh.position.set(target.position.x, 0.27, target.position.z - 0.65)
          mesh.rotation.y = Math.PI
          const noteRoom = level.presentation?.rooms?.find(
            (room) =>
              target.position.x >= room.bounds.minX &&
              target.position.x <= room.bounds.maxX &&
              target.position.z >= room.bounds.minZ &&
              target.position.z <= room.bounds.maxZ,
          )
          const noteParent =
            noteRoom === undefined
              ? root
              : (museumRoot.getObjectByName(`room-${noteRoom.id}`) ?? root)
          noteParent.add(mesh)
          plaque = { mesh, label: '' }
          plaques.set(note.id, plaque)
        }
        if (plaque.label === note.label) continue
        plaque.mesh.material.map?.dispose()
        plaque.mesh.material.map =
          labelTexture(target.label, note.label) ?? null
        plaque.mesh.material.needsUpdate = true
        plaque.label = note.label
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      restoredMaterials.forEach((material, mesh) => {
        mesh.material = material
      })
      hiddenProxies.forEach((visible, mesh) => {
        mesh.visible = visible
      })
      clonedMaterials.forEach((material) => material.dispose())
      plaques.forEach(({ mesh }) => {
        mesh.material.map?.dispose()
        mesh.removeFromParent()
      })
      shelfInstances.forEach((instances) => instances.dispose())
      geometry.forEach((item) => item.dispose())
      ownedMaterials.forEach((material) => material.dispose())
      curtain?.dispose()
      root.removeFromParent()
    },
  }
}
