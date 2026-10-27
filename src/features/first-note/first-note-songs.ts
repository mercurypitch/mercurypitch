// ============================================================
// First note's songs — the example songs, and where each singer comes in
// ============================================================
//
// The three example songs the app ships (Josh Woodward, CC BY 4.0), and the
// entries read from them once, on a desktop, and committed
// (first-note-entries.json, made by apps/mercurypitch/scripts/
// generate-first-note-entries.mjs): for each, where the band's lead-in
// starts, the moment the singer comes in, their first note, the four beats
// before it, and the end of the line they sing.
//
// A run takes ENTRIES_PER_SONG entries from each song, the songs in a
// random order and each song's entries in the song's own order, so the
// singer moves through a song as it goes. Two entries on one note are one
// task twice, so a song's picks differ in note where they can.
//
// Each round also places the note's line somewhere new on the stage
// (LINE_SHARES): at the levels that hide the line until the singer comes
// in, a line always at one height would show where the note is.

import entriesFile from './first-note-entries.json'
import { ENTRIES_PER_SONG } from './first-note-rules'

/** One place a singer comes in. Seconds on the song's own clock. */
export interface FirstNoteEntry {
  /** The band stops here: the singer comes in. */
  readonly at: number
  /** Their first note, MIDI. */
  readonly midi: number
  /** The band's lead-in starts here. */
  readonly from: number
  /** The line sung with you ends here. */
  readonly until: number
  /** The last four beats before `at`, or none where the grid is unclear. */
  readonly beats: readonly number[]
}

export interface FirstNoteSong {
  readonly slug: string
  readonly title: string
  readonly artist: string
  /** What the licence asks to be shown with it: "Josh Woodward · CC BY 4.0". */
  readonly credit: string
  /** The stems, at the app's own origin. */
  readonly stems: { readonly vocal: string; readonly instrumental: string }
  readonly entries: readonly FirstNoteEntry[]
}

/** One round of a run: an entry of a song, and where its line sits. */
export interface FirstNoteRound {
  /** Its place in the run, from 0. */
  readonly index: number
  readonly song: FirstNoteSong
  readonly entry: FirstNoteEntry
  /** The note's line, a share of the stage's height from its top. */
  readonly lineShare: number
}

/** The heights the note's line may take, a share of the stage's height. */
export const LINE_SHARES = { low: 0.36, high: 0.5 } as const

/** The example songs, as the room plays them. */
export const FIRST_NOTE_SONGS: readonly FirstNoteSong[] = entriesFile.songs.map(
  (song) => ({
    slug: song.slug,
    title: song.title,
    artist: song.artist,
    credit: `${song.artist} · ${song.attribution.license}`,
    stems: song.stems,
    entries: song.entries,
  }),
)

/** `items` in a random order (Fisher-Yates). */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** A song's picks: `count` entries, different notes first, in song order. */
export function pickEntries(
  song: FirstNoteSong,
  count: number,
  random: () => number,
): FirstNoteEntry[] {
  const picks: FirstNoteEntry[] = []
  for (const entry of shuffled(song.entries, random)) {
    if (picks.length === count) break
    if (!picks.some((pick) => pick.midi === entry.midi)) picks.push(entry)
  }
  // A song with fewer notes than picks repeats one rather than come up short.
  for (const entry of shuffled(song.entries, random)) {
    if (picks.length === count) break
    if (!picks.includes(entry)) picks.push(entry)
  }
  return picks.sort((a, b) => a.at - b.at)
}

/** A run: ENTRIES_PER_SONG from each song, the songs in a random order. */
export function planRun(
  songs: readonly FirstNoteSong[],
  random: () => number,
  perSong: number = ENTRIES_PER_SONG,
): FirstNoteRound[] {
  const rounds: FirstNoteRound[] = []
  for (const song of shuffled(songs, random)) {
    for (const entry of pickEntries(song, perSong, random)) {
      rounds.push({
        index: rounds.length,
        song,
        entry,
        lineShare:
          LINE_SHARES.low + random() * (LINE_SHARES.high - LINE_SHARES.low),
      })
    }
  }
  return rounds
}
