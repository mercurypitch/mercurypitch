// The room registry.
//
// One data file, mirroring `src/seo/entry-pages.ts` — which is deliberate:
// that file is how a room already becomes an indexable URL, and this is how
// the same room becomes a mountable module. Keeping them the same shape makes
// the pair readable side by side.
//
// Like `contract.ts` this is a LEAF: no `src/stores/**`, no `src/App.tsx`, no
// `src/index.tsx`, no `window`. The only import is a type, which is erased at
// compile time and so costs a hosted room nothing at runtime.
//
// `load()` fetches JavaScript and CONSTRUCTS NOTHING. That is the first of the
// two rules in plan section 4.3: load, create and activate are three separate
// steps, so that preloading a room on a tab hover cannot take a microphone.

import type { ActiveTab } from '@/features/tabs/constants'
import type { RoomId, RoomModule } from './contract'

export interface RoomRegistryEntry {
  /** Dynamic import. Fetches the module; does not build a session. */
  load: () => Promise<RoomModule>
  /** Which shell tab hosts it, when the shell hosts it. */
  tab?: ActiveTab
  /** The indexable slug, when the room has a standalone page. */
  entrySlug?: string
  /** Whether a standalone host must be able to mount it. */
  standalone: boolean
}

/**
 * What each room is, independent of whether it has been converted yet.
 *
 * This is static description, safe to read from anywhere — a picker can show
 * six rooms and mark five of them unavailable without any of them being
 * loadable. `ROOMS` below is the separate question of which ones a host can
 * actually mount today.
 */
export const ROOM_CATALOGUE: Record<
  RoomId,
  {
    readonly label: string
    readonly entrySlug?: string
    readonly standalone: boolean
  }
> = {
  sing: { label: 'Sing', standalone: false },
  guitar: { label: 'Guitar', entrySlug: 'guitar-night', standalone: true },
  piano: { label: 'Piano', entrySlug: 'piano-night', standalone: true },
  drums: { label: 'Drums', entrySlug: 'drum-night', standalone: true },
  karaoke: { label: 'Karaoke', entrySlug: 'karaoke-night', standalone: true },
  'ear-lab': { label: 'Ear Lab', entrySlug: 'ear-lab', standalone: true },
}

/**
 * The rooms a host can mount right now.
 *
 * Intentionally partial and intentionally EMPTY at this commit. A room
 * appears here only once it genuinely satisfies `RoomModule` — it has stopped
 * owning history, stopped calling `new AudioContext()`, and takes its
 * microphone through `RoomEnv`. Listing a room before that is true would give
 * the host a module it cannot safely park.
 *
 * Filled by:
 *   - task R4: `sing`, the only room V1-1 enters.
 *   - task R8: `piano`, mounted through `StandaloneRoomHost` as the proof that
 *     the contract satisfies the standalone half as well. Piano is the right
 *     first subject because it owns no history and imports no app stores,
 *     unlike Drum Night, which runs its own router.
 */
export const ROOMS: Partial<Record<RoomId, RoomRegistryEntry>> = {}

/** Whether a host can mount this room today. */
export function isHostable(id: RoomId): boolean {
  return ROOMS[id] !== undefined
}

/** The rooms a picker may let a singer actually enter. */
export function hostableRooms(): RoomId[] {
  return (Object.keys(ROOMS) as RoomId[]).filter(isHostable)
}
