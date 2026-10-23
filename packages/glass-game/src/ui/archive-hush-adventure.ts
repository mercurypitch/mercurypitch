// Archive route host — changes protection rooms through physical travel and saves earned door access.
import { createMemo, createSignal, untrack } from 'solid-js'
import { ARCHIVE_HUSH_ROOMS } from '../content/archive-hush-room'
import type { GameSnapshot, GlassGame, LevelDefinition } from '../contracts'
import type { GlassGameHost } from '../host'
import { createArchiveHushAwards } from './archive-hush-awards'
import { createArchiveHushSession } from './archive-hush-session'
import { reportArchiveOutcome } from './archive-outcome-diagnostics'

export function createArchiveHushAdventure(options: {
  host: GlassGameHost
  level: LevelDefinition
  game: GlassGame
  snapshot(): GameSnapshot
  canPlay(): boolean
  beforeCapture(): Promise<void>
  onReleaseVoice(): void
  refresh(): void
}) {
  const roomAt = (snapshot: GameSnapshot) =>
    ARCHIVE_HUSH_ROOMS.find(
      (room) => Math.abs(snapshot.player.position.z - room.centerZ) <= 4.2,
    )
  const initialRoom = roomAt(options.snapshot()) ?? ARCHIVE_HUSH_ROOMS[0]!
  const [room, setRoom] = createSignal(initialRoom)
  const inRoom = createMemo(() => {
    const player = options.snapshot().player.position
    return (
      Math.abs(player.z - room().centerZ) <= 4.2 && Math.abs(player.x) <= 4.2
    )
  })
  const completedRoomIds = createMemo(() => {
    const completed = options.snapshot().completedBreakableIds
    return ARCHIVE_HUSH_ROOMS.filter((candidate) =>
      candidate.vesselIds.every((id) => completed.includes(id)),
    ).map((candidate) => candidate.id)
  })
  const vessels = createMemo(() =>
    room().vesselIds.flatMap((id) => {
      const item = options.level.breakables.find((vessel) => vessel.id === id)
      return item ? [item] : []
    }),
  )
  // A chime can finish while Merc is jumping. Keep that earned result until
  // the game accepts it on this room's floor; never ask for a second hum.
  const awards = createArchiveHushAwards({
    canCommit: options.canPlay,
    accept: (id) => options.game.completeProtectionRoom(id),
    onCommit: (id) => {
      options.host.saveProgress(options.game.saveProgress())
      options.refresh()
      if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true')
        reportArchiveOutcome(options.level.id, id, 'protection')
    },
  })
  const session = createArchiveHushSession({
    host: options.host,
    roomId: initialRoom.id,
    vesselIds: initialRoom.vesselIds,
    curtainVesselIds: initialRoom.curtainVesselIds,
    completed: untrack(() => completedRoomIds().includes(initialRoom.id)),
    canPlay: () =>
      options.canPlay() && inRoom() && !options.snapshot().complete,
    canReach: (id) => {
      const vessel = vessels().find((item) => item.id === id)
      const player = options.game.snapshot().player.position
      return (
        vessel !== undefined &&
        Math.hypot(
          vessel.position.x - player.x,
          vessel.position.z - player.z,
        ) <= 3.2
      )
    },
    beforeCapture: options.beforeCapture,
    onReleaseVoice: options.onReleaseVoice,
    onChange: (next) => setState(next),
    onComplete: (id) => awards.award(id),
  })
  const [state, setState] = createSignal(session.snapshot())
  return {
    session,
    state,
    room,
    vessels,
    inRoom,
    completedRoomIds,
    totalRooms: ARCHIVE_HUSH_ROOMS.length,
    roomNumber: () =>
      ARCHIVE_HUSH_ROOMS.findIndex((candidate) => candidate.id === room().id) +
      1,
    doorOpen: () => completedRoomIds().includes(room().id),
    update() {
      awards.update()
      const next = roomAt(options.game.snapshot())
      if (next && next.id !== room().id) {
        setRoom(next)
        session.configureRoom({
          id: next.id,
          vesselIds: next.vesselIds,
          curtainVesselIds: next.curtainVesselIds,
          completed: completedRoomIds().includes(next.id),
        })
      }
    },
    presentation() {
      const current = state()
      const index = (id: string | null) =>
        id === null ? null : vessels().findIndex((item) => item.id === id)
      return {
        roomId: current.roomId,
        inRoom: inRoom(),
        completedRoomIds: completedRoomIds(),
        curtainClosed: current.room.curtainClosed,
        coveredIndex: index(current.room.coveredId),
        aimedIndex: index(current.room.aimedId),
        protectedIndices: current.room.protectedIds.map((id) => index(id)!),
        phase: current.room.phase,
      }
    },
  }
}
