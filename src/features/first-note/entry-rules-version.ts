// ============================================================
// The version of First note's entry rules (entry-rules.ts)
// ============================================================
//
// A file of its own, importing nothing, so the room can tell a kept read
// from an old one (first-note-own-songs.ts) without loading the rules: they
// load only with the read itself (own-song-read.ts), when a song is read.

/**
 * The rules' version: raised whenever a change to entry-rules.ts finds
 * different entries, so a phone reads a song of the singer's own again
 * rather than keep a read the rules have moved on from. 2: lines from the
 * voice, the lyrics moved onto them, and the song's own tuning. 3: a
 * vibrato is the note it swings round (voice-pitch.ts).
 */
export const ENTRY_RULES_VERSION = 3
