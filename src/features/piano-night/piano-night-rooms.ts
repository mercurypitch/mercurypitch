// ============================================================
// Piano Night free rooms — route-local public artwork identities
// ============================================================
//
// These rooms deliberately stay outside the supporter-background catalog.
// Slice 3 changes only a public visual plate; entitlement and persisted room
// preferences remain reserved for the later typed Piano background surface.

export type PianoNightFreeRoomId = 'afterglow-studio' | 'morning-conservatory'

export type PianoNightRoomTreatment = 'dark' | 'light'

export interface PianoNightFreeRoom {
  readonly id: PianoNightFreeRoomId
  readonly label: string
  readonly landscapeUrl: string
  readonly portraitUrl: string
  readonly treatment: PianoNightRoomTreatment
}

export const PIANO_NIGHT_FREE_ROOMS = [
  {
    id: 'afterglow-studio',
    label: 'Afterglow Studio',
    landscapeUrl: '/piano-night/afterglow-studio-landscape.webp',
    portraitUrl: '/piano-night/afterglow-studio-portrait.webp',
    treatment: 'dark',
  },
  {
    id: 'morning-conservatory',
    label: 'Morning Conservatory',
    landscapeUrl: '/piano-night/morning-conservatory-landscape.webp',
    portraitUrl: '/piano-night/morning-conservatory-portrait.webp',
    treatment: 'light',
  },
] as const satisfies readonly PianoNightFreeRoom[]

export const DEFAULT_PIANO_NIGHT_FREE_ROOM_ID: PianoNightFreeRoomId =
  'afterglow-studio'

export function getPianoNightFreeRoom(
  id: PianoNightFreeRoomId,
): PianoNightFreeRoom {
  const room = PIANO_NIGHT_FREE_ROOMS.find((candidate) => candidate.id === id)
  if (room === undefined) throw new Error(`Unknown Piano Night room: ${id}`)
  return room
}
