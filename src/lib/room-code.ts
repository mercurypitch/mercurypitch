// ── Room code normalization ──────────────────────────────────────────
// What the other device shows, however this device's keyboard typed it.
//
// Shared by jam rooms and device sync: they are the same eight characters
// from the same alphabet, handed between two people who are reading one
// screen and typing into another.
//
// A room id becomes a Durable Object NAME in the jam worker, and those
// are byte-exact. The worker folds case before it names anything, so a
// lowercase code now finds the room it meant. This runs on the client
// for the other half of the problem: showing the code back in the form
// it will actually be sent, and dropping what a paste picked up along
// the way -- spaces, dashes somebody added for readability, a trailing
// newline from a chat message.
//
// The alphabet is 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' -- no 0/O/1/I, so
// the classic misreadings cannot arise. A mistyped character that IS in
// the alphabet still asks for a different room, and there is nothing
// here that can catch that; the sync store's peer-arrival deadline is
// what turns that silence into an error message.

/** The characters a room code can contain. Mirrors newRoomId(). */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Room codes are this long; used to stop a paste from over-filling. */
export const ROOM_CODE_LENGTH = 8

/**
 * Uppercase, strip anything that is not a code character, and cap the
 * length. Safe to run on every keystroke: it only ever removes
 * characters the room code could not have contained.
 */
export function normalizeRoomCode(raw: string): string {
  let out = ''
  for (const char of raw.toUpperCase()) {
    if (ROOM_CODE_ALPHABET.includes(char)) out += char
    if (out.length === ROOM_CODE_LENGTH) break
  }
  return out
}

/** Whether this is a complete code worth trying to join. */
export function isCompleteRoomCode(raw: string): boolean {
  return normalizeRoomCode(raw).length === ROOM_CODE_LENGTH
}
