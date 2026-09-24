// Room visibility regression — hidden turns cull conservatively without clipping long portal views.

import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { expect, it } from 'vitest'
import type { RoomPresentationDefinition } from '../contracts'
import { createRoomVisibilityController } from './room-visibility'

function room(
  id: string,
  centreX: number,
  centreZ: number,
  ports: RoomPresentationDefinition['ports'] = [],
): RoomPresentationDefinition {
  return {
    id: `museum/journey/${id}/room/gallery`,
    bounds: {
      minX: centreX - 2,
      maxX: centreX + 2,
      minY: -0.5,
      maxY: 3.6,
      minZ: centreZ - 2,
      maxZ: centreZ + 2,
    },
    cameraBounds: {
      minX: centreX - 1.7,
      maxX: centreX + 1.7,
      minY: 0,
      maxY: 3.4,
      minZ: centreZ - 1.7,
      maxZ: centreZ + 1.7,
    },
    ports,
  }
}

function port(
  id: string,
  x: number,
  z: number,
  facingYaw: number,
): NonNullable<RoomPresentationDefinition['ports']>[number] {
  return {
    id,
    position: { x, y: 0, z },
    facingYaw,
    width: 2.4,
    height: 3,
  }
}

function cameraAt(x: number, z: number, lookX: number, lookZ: number) {
  const camera = new PerspectiveCamera(50, 1, 0.05, 100)
  camera.position.set(x, 1.5, z)
  camera.lookAt(lookX, 1.5, lookZ)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return camera
}

it('keeps directly connected thresholds while culling a distant room around a turn', () => {
  const first = room('first', 0, 0, [port('first-north', 0, -2, 0)])
  const threshold = room('threshold', 0, -4, [
    port('threshold-south', 0, -2, Math.PI),
    port('threshold-east', 2, -4, -Math.PI / 2),
  ])
  const turn = room('turn', 4, -4, [port('turn-west', 2, -4, Math.PI / 2)])
  const hiddenRoom = room('hidden-room', 12, -4)
  const controller = createRoomVisibilityController([
    first,
    threshold,
    turn,
    hiddenRoom,
  ])

  const selection = controller.select(
    { x: 0, y: 0, z: 0 },
    cameraAt(0, 1, 0, -12),
  )

  expect(selection.fallbackAllVisible).toBe(false)
  expect([...selection.visibleRoomIds]).toEqual(
    expect.arrayContaining([first.id, threshold.id]),
  )
  expect(selection.visibleRoomIds.has(hiddenRoom.id)).toBe(false)
})

it('keeps every distant room intersecting an aligned doorway sightline', () => {
  const near = room('near', 0, 0, [port('near-north', 0, -2, 0)])
  const middle = room('middle', 0, -4, [
    port('middle-south', 0, -2, Math.PI),
    port('middle-north', 0, -6, 0),
  ])
  const distant = room('distant', 0, -16, [
    port('distant-south', 0, -14, Math.PI),
  ])
  const controller = createRoomVisibilityController([near, middle, distant])

  const selection = controller.select(
    { x: 0, y: 0, z: 0 },
    cameraAt(0, 1, 0, -24),
  )

  expect(selection.visibleRoomIds.has(distant.id)).toBe(true)
})

it('expands authored view bounds to include installed art extents', () => {
  const current = room('current', 0, 0)
  const decorated = room('decorated', 12, -4)
  const controller = createRoomVisibilityController([current, decorated])
  const camera = cameraAt(0, 1, 0, -12)

  expect(
    controller
      .select({ x: 0, y: 0, z: 0 }, camera)
      .visibleRoomIds.has(decorated.id),
  ).toBe(false)

  controller.includeRenderBounds(
    decorated.id,
    new Box3(new Vector3(-0.2, 0, -8), new Vector3(12, 7, 0)),
  )
  expect(
    controller
      .select({ x: 0, y: 0, z: 0 }, camera)
      .visibleRoomIds.has(decorated.id),
  ).toBe(true)
})

it('falls back to the full scene outside authored rooms and for legacy levels', () => {
  const first = room('first', 0, 0)
  const second = room('second', 20, 0)
  const controller = createRoomVisibilityController([first, second])

  const outside = controller.select(
    { x: 100, y: -10, z: 100 },
    cameraAt(100, 100, 101, 100),
  )
  expect(outside.fallbackAllVisible).toBe(true)
  expect(outside.visibleRoomIds).toEqual(new Set([first.id, second.id]))

  const legacy = createRoomVisibilityController([]).select(
    { x: 0, y: 0, z: 0 },
    cameraAt(0, 1, 0, -1),
  )
  expect(legacy.fallbackAllVisible).toBe(true)
  expect(legacy.visibleRoomIds.size).toBe(0)
})

it('maps compiled room-owned IDs without claiming connection gates', () => {
  const first = room('first', 0, 0)
  const second = room('second', 5, 0)
  const controller = createRoomVisibilityController([first, second])

  expect(
    controller.roomIdForRuntimeId('museum/journey/first/platform/floor'),
  ).toBe(first.id)
  expect(
    controller.roomIdForRuntimeId('museum/journey/second/visual/window'),
  ).toBe(second.id)
  expect(
    controller.roomIdForRuntimeId('museum/journey/connection/gate/north'),
  ).toBeUndefined()
})
