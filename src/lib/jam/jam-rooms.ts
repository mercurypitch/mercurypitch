import { createSignal } from 'solid-js'

// ── Rooms you host ───────────────────────────────────────────────────
// The rooms this device created, and the secret that proves it.
//
// The signaling DO issues an ownerToken once, at creation, and persists it
// in its own storage; presenting it on a later join is the ONLY way to be
// host again (jam-room.ts proves host by the token, never by display name,
// which every peer can read and replay). Until now the client held that
// token in a module variable, so it survived a WebSocket reconnect and
// nothing else: leave the room, or reload the page, and the host came back
// as an ordinary peer in the room they had just made.
//
// So it lives in localStorage, per room, and the list of rooms it covers is
// the list of rooms you can walk back into. This is deliberately DEVICE
// local -- there is no registry of rooms anywhere, and no way for anyone
// else to see or enumerate yours.

// Deliberately NOT createPersistedSignal: that funnels every write into the
// settings cloud-sync choke point, and an ownerToken is a device-local
// secret that proves host. Syncing it would put a credential into a general
// settings blob and let a stale cloud copy overwrite the live list.
const LS_KEY = 'pitchperfect_jam_hosted_rooms'
/** Rooms outlive their last peer by five minutes; a day is generous. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const MAX_ROOMS = 8

export interface HostedRoom {
  roomId: string
  /** The name you used, so rejoining does not rename you. */
  displayName: string
  /** Proves host to the DO on rejoin. Never leaves this device. */
  ownerToken: string
  /** Last time this device was in the room. */
  lastSeen: number
}

function read(): HostedRoom[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw === null || raw === '') return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const now = Date.now()
    return parsed.filter(
      (r): r is HostedRoom =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as HostedRoom).roomId === 'string' &&
        typeof (r as HostedRoom).ownerToken === 'string' &&
        typeof (r as HostedRoom).lastSeen === 'number' &&
        now - (r as HostedRoom).lastSeen < MAX_AGE_MS,
    )
  } catch {
    // Malformed or unavailable storage must not break the lobby.
    return []
  }
}

function write(rooms: HostedRoom[]): void {
  const next = rooms.slice(0, MAX_ROOMS)
  // Signal first, so the lobby updates even where storage is unavailable.
  setRooms(next)
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* storage full or unavailable */
  }
}

// Reactive mirror of the stored list. Every writer goes through write(), so
// the lobby re-renders the moment a room is created, rejoined or forgotten
// -- including on leaving a room, which is when you most want to see it.
const [rooms, setRooms] = createSignal<HostedRoom[]>(read())

/**
 * Rooms this device hosts, most recent first.
 *
 * Recency is the STORED ORDER, not a sort on lastSeen: two rooms entered in
 * the same millisecond compare equal, and the list would then reorder itself
 * arbitrarily under the user. Every writer puts the room it touched at the
 * front, so the order is already the answer.
 */
export function hostedRooms(): HostedRoom[] {
  return rooms()
}

/** Re-read from storage — for another tab having changed it. */
export function refreshHostedRooms(): void {
  setRooms(read())
}

/** The secret for one room, or null if this device never hosted it. */
export function ownerTokenFor(roomId: string): string | null {
  return read().find((r) => r.roomId === roomId)?.ownerToken ?? null
}

/** Remember a room this device created (or refresh one it re-entered). */
export function rememberHostedRoom(
  roomId: string,
  displayName: string,
  ownerToken: string,
): void {
  if (roomId === '' || ownerToken === '') return
  const rest = read().filter((r) => r.roomId !== roomId)
  write([{ roomId, displayName, ownerToken, lastSeen: Date.now() }, ...rest])
}

/** Move a room to the top of the list without changing its secret. */
export function touchHostedRoom(roomId: string): void {
  const rooms = read()
  const found = rooms.find((r) => r.roomId === roomId)
  if (found === undefined) return
  write([
    { ...found, lastSeen: Date.now() },
    ...rooms.filter((r) => r.roomId !== roomId),
  ])
}

/** Drop a room — it is gone, or you do not want it listed. */
export function forgetHostedRoom(roomId: string): void {
  write(read().filter((r) => r.roomId !== roomId))
}
