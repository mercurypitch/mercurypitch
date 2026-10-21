// Archive overview framing — the Hush display row stays in the viewport area beside its protection console.

import type { PerspectiveCamera } from 'three'
import { Vector3 } from 'three'
import type { LevelDefinition } from '../contracts'
import { archiveChambers } from './archive-layout'
import { EXPLORATION_FOV_DEGREES } from './camera-policy'

export function archiveOverviewViewport(width: number, height: number) {
  return height <= 500
    ? { left: 20, right: width - 314, top: 86, bottom: height - 66 }
    : {
        left: 20,
        right: width - 20,
        top: 112,
        bottom: height - (width <= 600 ? 518 : 398),
      }
}

/** This is an entry composition. Once framed, orbit/movement keeps its chosen
 * projection until a viewport resize, rather than zooming on every footstep. */
export function createArchiveOverviewFraming(level: LevelDefinition) {
  if (level.id !== 'glassworks-unbroken-archive/archive-hush') return undefined
  const rooms = archiveChambers(level)
  const roomCorners = new Map(
    rooms.map((room) => [
      room.id,
      level.breakables
        .filter(({ id }) => room.vesselIds.includes(id))
        .flatMap(({ position }) =>
          [-0.64, 0.64].flatMap((x) =>
            [0.13, room.curtainVesselIds.length > 0 ? 2.05 : 1.68].flatMap(
              (y) =>
                [-0.65, 0.65].map(
                  (z) => new Vector3(position.x + x, y, position.z + z),
                ),
            ),
          ),
        ),
    ]),
  )
  let previousSize = ''
  let applied = false
  let projection: { fov: number; offsetX: number; offsetY: number } | undefined
  return {
    clear(camera: PerspectiveCamera) {
      if (!applied) return
      applied = false
      previousSize = ''
      projection = undefined
      camera.clearViewOffset()
      camera.fov = EXPLORATION_FOV_DEGREES
      camera.updateProjectionMatrix()
    },
    apply(
      camera: PerspectiveCamera,
      width: number,
      height: number,
      roomId = rooms[0]?.id,
    ) {
      if (width <= 0 || height <= 0) return
      const corners = roomId === undefined ? undefined : roomCorners.get(roomId)
      if (corners === undefined || corners.length === 0) return
      const size = `${roomId}:${width}:${height}`
      if (previousSize !== size) {
        camera.updateMatrixWorld(true)
        const points = corners.map((point) =>
          point.clone().applyMatrix4(camera.matrixWorldInverse),
        )
        const rect = archiveOverviewViewport(width, height)
        if (points.some((point) => point.z >= -0.05)) {
          // Keep the chosen orbit when the row is behind the player, but
          // replace the previous orientation's view offset and dimensions.
          projection = {
            fov: Math.min(
              104,
              Math.max(
                EXPLORATION_FOV_DEGREES,
                (Math.atan(Math.tan((55 * Math.PI) / 360) / (width / height)) *
                  360) /
                  Math.PI,
              ),
            ),
            offsetX: (width - rect.left - rect.right) / 2,
            offsetY: (height - rect.top - rect.bottom) / 2,
          }
        } else {
          const ratiosX = points.map((point) => point.x / -point.z)
          const ratiosY = points.map((point) => point.y / -point.z)
          const minX = Math.min(...ratiosX)
          const maxX = Math.max(...ratiosX)
          const minY = Math.min(...ratiosY)
          const maxY = Math.max(...ratiosY)
          const freeWidth = Math.max(width * 0.4, rect.right - rect.left)
          const freeHeight = Math.max(height * 0.2, rect.bottom - rect.top)
          const tan = Math.max(
            Math.tan((EXPLORATION_FOV_DEGREES * Math.PI) / 360),
            (maxX - minX) / ((width / height) * 2 * (freeWidth / width)),
            (maxY - minY) / (2 * (freeHeight / height)),
          )
          const fov = Math.min(104, (Math.atan(tan * 1.03) * 360) / Math.PI)
          const actualTan = Math.tan((fov * Math.PI) / 360)
          const desiredX = (rect.left + rect.right) / width - 1
          const desiredY = 1 - (rect.top + rect.bottom) / height
          projection = {
            fov,
            offsetX:
              (((minX + maxX) / (2 * (width / height) * actualTan) - desiredX) *
                width) /
              2,
            offsetY:
              ((desiredY - (minY + maxY) / (2 * actualTan)) * height) / 2,
          }
        }
        previousSize = size
      }
      if (projection === undefined) return
      applied = true
      camera.fov = projection.fov
      camera.setViewOffset(
        width,
        height,
        projection.offsetX,
        projection.offsetY,
        width,
        height,
      )
    },
  }
}
