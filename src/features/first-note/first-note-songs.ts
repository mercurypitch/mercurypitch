// ============================================================
// First note's songs — the example songs, and where each singer comes in
// ============================================================
//
// The three example songs the app ships (Josh Woodward, CC BY 4.0), and the
// entries read from them once, on a desktop, and committed
// (first-note-entries.json, made by apps/mercurypitch/scripts/
// generate-first-note-entries.mjs): for each, where the band's lead-in
// starts, the moment the singer comes in, their first note, the four beats
// before it, the end of the line they sing, and its words. A song of the
// singer's own is read the same way on the phone (own-song-read.ts) and
// takes the same shape here.
//
// A run is up to FIRST_NOTE_ROUNDS entries, shared out over its songs in a
// random order: two from each of the three examples, one or more from each
// of a singer's own. A song gives no more entries than it has, so songs of
// the singer's own with fewer between them make a shorter run, which the
// history keeps and no best counts (first-note-run.ts). Each song's entries
// come in the song's own order, so the singer moves through a song as it
// goes. Two entries on one note are one task twice, so a song's picks
// differ in note where they can.
//
// Each round also places the note's line somewhere new on the stage
// (LINE_SHARES): at the levels that hide the line until the singer comes
// in, a line always at one height would show where the note is.

import { demoSessionId } from '@/lib/example-session'
import entriesFile from './first-note-entries.json'
import { FIRST_NOTE_ROUNDS } from './first-note-rules'

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
  /**
   * The words of the line the singer comes in on, for the hint that shows
   * them; '' or absent where the song has no synced lyrics.
   */
  readonly words?: string
  /**
   * The song's tuning, cents from A440's notes: the band plays `midi` this
   * far out, and the singer is judged against the band. Absent for a song
   * in tune with A440 (entry-rules.ts, songTuning).
   */
  readonly cents?: number
}

/** The pitch the singer is asked for, MIDI: the note as the band plays it. */
export function entryPitch(entry: FirstNoteEntry): number {
  return entry.midi + (entry.cents ?? 0) / 100
}

export interface FirstNoteSong {
  /** The song's own name in the room: an example's slug, or a session id. */
  readonly slug: string
  /** The song's session, where the Karaoke room plays it whole. */
  readonly sessionId: string
  /** An example the app ships, or a song of the singer's own. */
  readonly kind: 'example' | 'yours'
  readonly title: string
  readonly artist: string
  /**
   * What the licence asks to be shown with it: "Josh Woodward · CC BY 4.0".
   * '' for a song of the singer's own.
   */
  readonly credit: string
  /** The stems: at the app's own origin, or minted from the phone's store. */
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
    sessionId: demoSessionId(song.slug),
    kind: 'example' as const,
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

/**
 * How many of a run's `rounds` each song gives, in the run's order: one
 * each in turn, while a song has entries left, until the run is full. Three
 * songs give two each; four give two, two, one and one; seven give one each
 * to the first six. Songs with fewer entries between them than `rounds`
 * give all they have: the run is shorter.
 */
export function shareRun(
  songs: readonly FirstNoteSong[],
  rounds: number,
): number[] {
  const shares = songs.map(() => 0)
  let left = rounds
  let gave = true
  while (left > 0 && gave) {
    gave = false
    for (const [i, song] of songs.entries()) {
      if (left === 0) break
      if (shares[i] >= song.entries.length) continue
      shares[i] += 1
      left -= 1
      gave = true
    }
  }
  return shares
}

/** A run: `rounds` entries shared out over the songs, in a random order. */
export function planRun(
  songs: readonly FirstNoteSong[],
  random: () => number,
  rounds: number = FIRST_NOTE_ROUNDS,
): FirstNoteRound[] {
  const planned: FirstNoteRound[] = []
  const order = shuffled(songs, random)
  const shares = shareRun(order, rounds)
  for (const [i, song] of order.entries()) {
    if (shares[i] === 0) continue
    for (const entry of pickEntries(song, shares[i], random)) {
      planned.push({
        index: planned.length,
        song,
        entry,
        lineShare:
          LINE_SHARES.low + random() * (LINE_SHARES.high - LINE_SHARES.low),
      })
    }
  }
  return planned
}

/**
 * "Sing on in Karaoke" (the owner's request, 28 Oct 2026) starts the whole
 * song this far ahead of an entry whose lead-in has no beats to count, s.
 */
export const SING_ON_LEAD_SEC = 3

/**
 * Where the Karaoke room starts a song the singer sings on with: a breath
 * before the entry, on the first of the four beats the room counted where
 * the song has them, so they come in on the note again with the rest of
 * the song after it. Seconds on the song's clock.
 */
export function singOnFrom(entry: FirstNoteEntry): number {
  const from =
    entry.beats.length > 0 ? entry.beats[0] : entry.at - SING_ON_LEAD_SEC
  return Math.max(0, Number(from.toFixed(2)))
}

/** The songs of a run, each once, in the order the run first plays them. */
export function songsOfRun(rounds: readonly FirstNoteRound[]): FirstNoteSong[] {
  const songs: FirstNoteSong[] = []
  for (const round of rounds) {
    if (!songs.includes(round.song)) songs.push(round.song)
  }
  return songs
}
