// Room visibility — conservatively skip authored rooms outside the live view and its connected threshold.

import type { PerspectiveCamera } from 'three'
import { Box3, Frustum, Matrix4, Vector3 } from 'three'
import type { RoomPresentationDefinition, Vec3 } from '../contracts'

const ACTIVE_ROOM_MARGIN = 0.4
const VIEW_PREWARM_MARGIN = 2.5
const CONNECTED_PORT_EPSILON = 0.02
const OPPOSITE_PORT_DOT = -0.99

interface PreparedRoom {
  definition: RoomPresentationDefinition
  activeBounds: Box3
  cameraBounds: Box3
  viewBounds: Box3
  runtimePrefix?: string
}

export interface RoomVisibilitySelection {
  /** Empty only when the level has no authored room presentation. */
  visibleRoomIds: ReadonlySet<string>
  /** Outside/fall/legacy states deliberately preserve the whole scene. */
  fallbackAllVisible: boolean
}

function boxFromBounds(bounds: RoomPresentationDefinition['bounds']): Box3 {
  return new Box3(
    new Vector3(bounds.minX, bounds.minY, bounds.minZ),
    new Vector3(bounds.maxX, bounds.maxY, bounds.maxZ),
  )
}

function runtimePrefix(roomId: string): string | undefined {
  const marker = roomId.lastIndexOf('/room/')
  return marker < 0 ? undefined : roomId.slice(0, marker)
}

function portsConnect(
  left: NonNullable<RoomPresentationDefinition['ports']>[number],
  right: NonNullable<RoomPresentationDefinition['ports']>[number],
): boolean {
  const distance = Math.hypot(
    left.position.x - right.position.x,
    left.position.y - right.position.y,
    left.position.z - right.position.z,
  )
  if (distance > CONNECTED_PORT_EPSILON) return false
  const leftX = -Math.sin(left.facingYaw)
  const leftZ = -Math.cos(left.facingYaw)
  const rightX = -Math.sin(right.facingYaw)
  const rightZ = -Math.cos(right.facingYaw)
  return leftX * rightX + leftZ * rightZ < OPPOSITE_PORT_DOT
}

export function createRoomVisibilityController(
  rooms: readonly RoomPresentationDefinition[],
) {
  const prepared: PreparedRoom[] = rooms.map((definition) => {
    const bounds = boxFromBounds(definition.bounds)
    const cameraBounds = boxFromBounds(
      definition.cameraBounds ?? definition.bounds,
    ).expandByScalar(ACTIVE_ROOM_MARGIN)
    return {
      definition,
      activeBounds: bounds.clone().expandByScalar(ACTIVE_ROOM_MARGIN),
      cameraBounds,
      viewBounds: bounds.clone().expandByScalar(VIEW_PREWARM_MARGIN),
      runtimePrefix: runtimePrefix(definition.id),
    }
  })
  const preparedById = new Map(
    prepared.map((room) => [room.definition.id, room]),
  )
  const allRoomIds = new Set(prepared.map(({ definition }) => definition.id))
  const adjacency = new Map<string, Set<string>>(
    prepared.map(({ definition }) => [definition.id, new Set<string>()]),
  )
  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex++)
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < prepared.length;
      rightIndex++
    ) {
      const left = prepared[leftIndex]!
      const right = prepared[rightIndex]!
      const connected = (left.definition.ports ?? []).some((leftPort) =>
        (right.definition.ports ?? []).some((rightPort) =>
          portsConnect(leftPort, rightPort),
        ),
      )
      if (!connected) continue
      adjacency.get(left.definition.id)!.add(right.definition.id)
      adjacency.get(right.definition.id)!.add(left.definition.id)
    }

  const projection = new Matrix4()
  const frustum = new Frustum()
  const playerPoint = new Vector3()

  return {
    roomIds: allRoomIds,
    includeRenderBounds(roomId: string, bounds: Box3): void {
      if (bounds.isEmpty()) return
      const room = preparedById.get(roomId)
      room?.viewBounds.union(bounds.clone().expandByScalar(VIEW_PREWARM_MARGIN))
    },
    roomIdForRuntimeId(id: string): string | undefined {
      if (allRoomIds.has(id)) return id
      let best: PreparedRoom | undefined
      for (const room of prepared) {
        if (
          room.runtimePrefix !== undefined &&
          id.startsWith(`${room.runtimePrefix}/`) &&
          (best?.runtimePrefix?.length ?? -1) < room.runtimePrefix.length
        )
          best = room
      }
      return best?.definition.id
    },
    select(player: Vec3, camera: PerspectiveCamera): RoomVisibilitySelection {
      if (prepared.length === 0)
        return { visibleRoomIds: allRoomIds, fallbackAllVisible: true }

      camera.updateMatrixWorld()
      const cameraPoint = camera.position
      playerPoint.set(player.x, player.y, player.z)
      const active = prepared.filter(
        (room) =>
          room.cameraBounds.containsPoint(cameraPoint) ||
          room.activeBounds.containsPoint(playerPoint),
      )
      if (active.length === 0)
        return { visibleRoomIds: allRoomIds, fallbackAllVisible: true }

      projection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      )
      frustum.setFromProjectionMatrix(projection)
      const visible = new Set<string>()
      for (const room of active) {
        visible.add(room.definition.id)
        adjacency
          .get(room.definition.id)
          ?.forEach((neighbor) => visible.add(neighbor))
      }
      for (const room of prepared)
        if (frustum.intersectsBox(room.viewBounds))
          visible.add(room.definition.id)
      return { visibleRoomIds: visible, fallbackAllVisible: false }
    },
  }
}
