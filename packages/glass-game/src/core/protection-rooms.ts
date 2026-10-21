// Protection rooms — validate intact target membership and accept whole, ordered room results.
import type { LevelDefinition, PlayerState } from '../contracts'

export function protectionRoomDefinitionError(
  level: LevelDefinition,
): string | undefined {
  const roomIds = new Set<string>()
  const vesselIds = new Set<string>()
  const targets = new Map(level.breakables.map((target) => [target.id, target]))
  for (const room of level.protectionRooms ?? []) {
    if (!room.id || roomIds.has(room.id))
      return 'Room IDs must be unique and nonempty.'
    roomIds.add(room.id)
    const { minX, maxX, minZ, maxZ } = room.bounds
    if (
      ![minX, maxX, minZ, maxZ, room.top].every(Number.isFinite) ||
      minX >= maxX ||
      minZ >= maxZ
    )
      return `Room "${room.id}" needs finite, nonempty bounds.`
    if (room.vesselIds.length === 0)
      return `Room "${room.id}" needs intact vessels.`
    if (new Set(room.vesselIds).size !== room.vesselIds.length)
      return `Room "${room.id}" repeats a protection vessel.`
    for (const id of room.vesselIds) {
      const target = targets.get(id)
      if (vesselIds.has(id))
        return `Vessel "${id}" belongs to more than one protection slot.`
      if (
        target === undefined ||
        target.optional ||
        target.completion !== 'awaken'
      )
        return `Vessel "${id}" must be an existing required awakening exhibit.`
      if (
        (target.requiresCompleted ?? []).some(
          (required) => !vesselIds.has(required),
        )
      )
        return `Vessel "${id}" may depend only on earlier protection rooms.`
    }
    for (const id of room.vesselIds) vesselIds.add(id)
  }
  return undefined
}

/** A malformed or interrupted save cannot open half a room or skip a locked room. */
export function retainProtectionProgress(
  level: LevelDefinition,
  requested: Set<string>,
): void {
  let priorRoomsComplete = true
  for (const room of level.protectionRooms ?? []) {
    priorRoomsComplete =
      priorRoomsComplete && room.vesselIds.every((id) => requested.has(id))
    if (!priorRoomsComplete)
      for (const id of room.vesselIds) requested.delete(id)
  }
}

/** The host owns judging; the game owns membership, grounded location and route ordering. */
export function completeProtectionRoom(
  level: LevelDefinition,
  roomId: string,
  player: PlayerState,
  completed: Set<string>,
): boolean {
  const rooms = level.protectionRooms ?? []
  const index = rooms.findIndex((room) => room.id === roomId)
  const room = rooms[index]
  if (
    room === undefined ||
    !player.grounded ||
    Math.abs(player.position.y - room.top) >= 0.05
  )
    return false
  if (
    rooms
      .slice(0, index)
      .some((prior) => prior.vesselIds.some((id) => !completed.has(id)))
  )
    return false
  if (room.vesselIds.some((id) => completed.has(id))) return false
  const { x, z } = player.position
  const { minX, maxX, minZ, maxZ } = room.bounds
  if (x < minX || x > maxX || z < minZ || z > maxZ) return false
  for (const id of room.vesselIds) completed.add(id)
  return true
}
