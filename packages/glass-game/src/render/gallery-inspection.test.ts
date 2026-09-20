// Gallery inspection contracts — hit real insets, respect room visibility and opaque walls.
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, } from 'three'
import { expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createGalleryInspection } from './gallery-inspection'

function fixture() {
  const scene = new Group()
  const room = new Group()
  scene.add(room)
  const art = new Group()
  art.name = 'decoration-study'
  room.add(art)
  const material = new MeshBasicMaterial()
  material.name = 'decor_surface'
  const painting = new Mesh(new PlaneGeometry(2, 3), material)
  art.add(painting)
  const wall = new Mesh(new BoxGeometry(4, 4, 0.2), new MeshBasicMaterial())
  wall.position.z = -0.2
  scene.add(wall)
  const camera = new PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)
  const level = {
    ...GLASSWORKS,
    presentation: {
      lightBounds: { minX: -5, maxX: 5, minY: -5, maxY: 5, minZ: -5, maxZ: 5 },
      worldBounds: { minX: -5, maxX: 5, minY: -5, maxY: 5, minZ: -5, maxZ: 5 },
      rooms: [],
      audioRegions: [],
      visuals: [],
      assetRecipeIds: [],
      decorations: [
        {
          id: 'study',
          roomId: 'room',
          recipeId: 'garden-painting-v5',
          position: { x: 0, y: 0, z: 0 },
          yaw: 0,
          scale: 1,
        },
      ],
    },
  }
  const inspection = createGalleryInspection(
    scene,
    camera,
    {
      getBoundingClientRect: () =>
        ({
          left: 0,
          top: 0,
          right: 600,
          bottom: 600,
          width: 600,
          height: 600,
        }) as DOMRect,
    },
    level,
    () => [wall, painting],
  )
  return { inspection, room, art, wall, camera }
}

it('picks the actual inset, never the surrounding empty canvas or hidden room', () => {
  const { inspection, room } = fixture()
  expect(inspection.pick(300, 300)).toBe('garden-painting-v5')
  expect(inspection.pick(5, 5)).toBeNull()
  expect(inspection.pick(-1, 300)).toBeNull()
  room.visible = false
  expect(inspection.pick(300, 300)).toBeNull()
  expect(inspection.nearby({ x: 0, y: 0, z: 3 })).toBeNull()
})

it('offers nearby art without aiming at it, but rejects walls, its back and distant rooms', () => {
  const { inspection, wall, camera } = fixture()
  camera.lookAt(5, 0, 5)
  expect(inspection.nearby({ x: 0, y: 0, z: 3 })).toBe('garden-painting-v5')
  expect(inspection.nearby({ x: 0, y: 0, z: 10 })).toBeNull()
  expect(inspection.nearby({ x: 0, y: 0, z: -3 })).toBeNull()
  wall.position.z = 2
  expect(inspection.nearby({ x: 0, y: 0, z: 3 })).toBeNull()
  camera.lookAt(0, 0, 0)
  expect(inspection.pick(300, 300)).toBeNull()
})
