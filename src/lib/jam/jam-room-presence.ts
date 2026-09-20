// ── Is this tab in a jam room? ───────────────────────────────────────
// The one fact about the jam that code OUTSIDE the jam needs, in a file with
// nothing else in it.
//
// The Jam tab is two screens under one tab: the lobby, where a room is made
// or joined, and the room. The guided tours are picked per tab, so the tour
// store has to know which of the two is up -- and it must not import the jam
// store to find out: that store pulls the whole room (the peer service, the
// pitch detector, the song transfer) into whatever imports it, and the tour
// store is in every page's first paint.
//
// So the question is asked here and answered by whoever owns the answer. The
// jam store hands over its own state signal the moment it loads; until then
// there is no store and therefore no room, which is the right answer too.

/** The jam store's connection state, as the store spells it. */
type JamRoomState = 'idle' | 'connecting' | 'active'

let readRoomState: (() => JamRoomState) | undefined

/**
 * Called once by the jam store, with its state signal.
 *
 * The signal itself and not a function wrapped around it: what is read here
 * is then the store's own signal, and a caller in a tracking scope follows it.
 */
export function provideJamRoomState(read: () => JamRoomState): void {
  readRoomState = read
}

/**
 * Whether this tab is in a room right now.
 *
 * Reads the jam store's own signal, so a caller inside a tracking scope
 * follows the room opening and closing like any other signal.
 */
export function jamRoomIsOpen(): boolean {
  return readRoomState?.() === 'active'
}
