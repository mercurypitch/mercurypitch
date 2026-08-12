// ── Room code normalization ──────────────────────────────────────────
// What the other device shows, however this device's keyboard typed it.
//
// A room id is a Durable Object NAME (`idFromName(roomId)` in the jam
// worker), so it is case-sensitive in the least forgiving way possible:
// a lowercase code does not fail, it silently opens a DIFFERENT, empty
// room. The two devices then sit waiting for each other in separate
// rooms, which is indistinguishable from the feature not working -- and
// is exactly what a phone keyboard produces when autocapitalize is only
// a hint, or when the code is pasted.
//
// The worker's alphabet is 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' -- no
// 0/O/1/I, so the classic confusions cannot arise. Anything outside it
// (spaces from a copy, dashes somebody added for readability) is
// dropped rather than sent.

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
