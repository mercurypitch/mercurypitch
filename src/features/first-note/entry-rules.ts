// ============================================================
// Where a singer comes in: First note's entry rules, for both readers
// ============================================================
//
// First note (docs/plans/ear-rooms.md) plays a song's band up to the moment
// its singer comes in and asks for that first note. Two readers find those
// moments, by these rules and no others:
//
//   - apps/mercurypitch/scripts/generate-first-note-entries.mjs reads the
//     example songs once, on a desktop, and commits what it finds
//     (first-note-entries.json);
//   - the phone reads a song of the singer's own once, after it is split
//     (own-song-read.ts), and keeps what it finds.
//
// AN ENTRY is a line of the song that follows a breath: at least
// ENTRY_GAP_SEC with no voice on the vocal stem before it. A song's lines
// are where its voice comes in after such a breath, and its synced lyrics'
// lines (`songLines`). The lyrics are moved onto this recording first
// (`lyricsShift`): a file synced to another release, or to a mix with a
// longer intro, is commonly a second or two out, and lines half a second
// late already cost most of a song's entries. A line from the lyrics and
// one from the voice within SAME_LINE_SEC are one line, with the lyrics'
// words, and so is a lyric line that would read that voice's note: a line
// synced early sits in the breath before its phrase. The entry's note is
// the voice's first steady note, read by YIN on the vocal stem
// (voice-pitch.ts): a vibrato is the note it swings round. It is
// kept only when the song's stored notes (the mixer's, another tracker)
// name the same note there, and when the voice sat within IN_TUNE_CENTS of
// it: a note two trackers disagree on, or one the singer bent, is not a
// note to judge anyone against. Nor is a note far from the song's middle
// note (RANGE_SEMITONES): both trackers can lock onto a harmonic together.
//
// IN TUNE is in the song's own tuning (`songTuning`): a recording a third
// of a semitone from A440 has every note that far out, and the singer is
// asked for the note as the band plays it. The entry carries that tuning
// (`cents`) so the room judges the singer against the band, not A440.
//
// THE BAND STOPS where the voiced run that holds that stretch begins, so a
// breath or a scoop before the note is the singer's way in, not the band's.
// The line the singer sings with you runs to the next line, or LINE_MAX_SEC,
// and never into the next entry: it would sing that round's note first.
//
// THE BEATS the room counts the singer in on are the band's (band-beats.ts).
//
// THE WORK COMES IN STEPS. A line's note (a YIN reading every 10 ms) is most
// of a read, and a phone reads on the thread that draws its screen. So a
// line is read by a generator that yields after each reading (lineSteps):
// the phone lets the screen draw between lines' slices, and the script runs
// a song's straight through (findEntries).
//
// Node runs this file as it is, through its type stripping, from the
// script: so it names its one import, voice-pitch.ts (YIN and the steady
// note), with its extension, as Node's own loader needs, and its syntax is
// all erasable (no enums, no namespaces, no parameter properties).

// A change here or in voice-pitch.ts that finds different entries raises
// ENTRY_RULES_VERSION (entry-rules-version.ts), so phones read the singer's
// songs again.

import type { RuleSteps, Samples, SteadyNote, VoiceLevel, } from './voice-pitch.ts'
import { firstSteady, median, STEADY_SEC, SWING_SEC } from './voice-pitch.ts'

export {
  STEADY_CENTS,
  STEADY_SEC,
  SWING_SEC,
  VOCAL_RATE,
  yinMidi,
} from './voice-pitch.ts'
export type { RuleSteps, Samples, VoiceLevel } from './voice-pitch.ts'

/** No voice for this long before a line makes it an entry, s. */
export const ENTRY_GAP_SEC = 1.6
/** An entry's note sits within this of the song's middle note, semitones. */
export const RANGE_SEMITONES = 9
/** The voice is "on" above this share of its own loud level (p90 RMS). */
export const VOICE_ON = 0.12
/** A reading is taken above this share of it: quieter is breath and bleed. */
export const VOICE_READ = 0.1
/** The steady note must start within this of the voice coming in, s... */
export const STEADY_WITHIN_SEC = 0.45
/**
 * ...and one found through its vibrato (voice-pitch.ts, `swung`) within
 * this: anything sung for STEADY_SEC before it would be a note of its own,
 * one too short for the medians to tell from this one, and its start is
 * read up to half a swing late. Later, the line is left: it would ask for
 * the note after the singer's first.
 */
export const SWUNG_WITHIN_SEC = STEADY_SEC + SWING_SEC / 2
/** The singer's note sat this close to its equal-tempered note, cents. */
export const IN_TUNE_CENTS = 30
/** The band leads in for this long before the entry, s. */
export const LEAD_SEC = 8
/** The band stops this far ahead of the voice, s. */
export const STOP_LEAD_SEC = 0.05
/** The line sung with you runs at least and at most this long, s. */
export const LINE_MIN_SEC = 2.5
export const LINE_MAX_SEC = 6.5

/** The lyrics are looked for this far either side of their own times, s. */
export const LYRICS_SHIFT_MAX_SEC = 3
/** A lyric line sits on a place the voice comes in within this, s. */
const ONSET_MATCH_SEC = 0.2
/** Quiet before the voice that makes a place it comes in, s. */
const ONSET_QUIET_SEC = 0.25
/** The lyrics are moved only when this share of their lines lands on the voice. */
const LYRICS_MATCH_SHARE = 0.3
/** A line from the lyrics and one from the voice this close are one line, s. */
export const SAME_LINE_SEC = 0.5
/** A line's note is looked for from this long before its start, s... */
const LOOK_BEFORE_SEC = 0.6
/** ...to this long after it. */
const LOOK_AFTER_SEC = 1.2
/** A song is judged in its own tuning once its notes sit this far from A440's, cents. */
export const TUNING_MIN_CENTS = 10
/** ...and once this many of its lines' notes say so. */
const TUNING_LINES_MIN = 5

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** `steps` run straight through: the script's way, and a test's. */
export function runSteps<T>(steps: RuleSteps<T>): T {
  for (;;) {
    const step = steps.next()
    if (step.done === true) return step.value
  }
}

/** A MIDI note's name, "E3". */
export function noteName(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

/** One of the song's notes as the mixer stored them. */
export interface StoredNote {
  readonly midi: number
  readonly startSec: number
  readonly endSec: number
  readonly noteName?: string
}

/** A line of the song: where it starts, s, and its words ('' for none). */
export interface SongLine {
  readonly start: number
  readonly words: string
}

/** Where a singer comes in, before its beats. Seconds on the song's clock. */
export interface FoundEntry {
  /** The band stops here: the singer comes in. */
  readonly at: number
  /** Their first note, MIDI. */
  readonly midi: number
  /** The band's lead-in starts here. */
  readonly from: number
  /** The line sung with you ends here. */
  readonly until: number
  /** The line's words, '' where the song has no synced lyrics. */
  readonly words: string
  /**
   * The song's tuning, cents from A440's notes (`songTuning`): the band
   * plays the note this far out. Absent for a song in tune with A440.
   */
  readonly cents?: number
}

const TIME_TAG = /\[(\d+):(\d+(?:\.\d+)?)\]/gu
const WORD_TAG = /<\d+:\d+(?:\.\d+)?>/gu

/**
 * Each synced line of `lyricsText`: its start, s, and its words with the
 * word timings taken out. A line without a leading time is not a line here
 * (a title, a note to the mixer, `[x-mp-timing:...]`).
 */
export function lyricLines(lyricsText: string): SongLine[] {
  const lines: SongLine[] = []
  for (const line of lyricsText.split('\n')) {
    const match = /^\[(\d+):(\d+(?:\.\d+)?)\]/u.exec(line)
    if (match === null) continue
    const words = line
      .replace(TIME_TAG, ' ')
      .replace(WORD_TAG, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
    lines.push({ start: Number(match[1]) * 60 + Number(match[2]), words })
  }
  return lines
}

/** Each synced line's start, s. */
export function lineStarts(lyricsText: string): number[] {
  return lyricLines(lyricsText).map((line) => line.start)
}

/** RMS every 20 ms over 40 ms, and the levels the voice counts as on and read at. */
export function loudness(samples: Float32Array, rate: number): VoiceLevel {
  const hop = Math.round(0.02 * rate)
  const size = Math.round(0.04 * rate)
  const rms: number[] = []
  for (let at = 0; at + size <= samples.length; at += hop) {
    let sum = 0
    for (let i = at; i < at + size; i++) sum += samples[i] * samples[i]
    rms.push(Math.sqrt(sum / size))
  }
  const sorted = rms.filter((value) => value > 0).sort((a, b) => a - b)
  const loud = sorted[Math.floor(sorted.length * 0.9)] ?? 0
  return {
    rms,
    hopSec: hop / rate,
    on: loud * VOICE_ON,
    read: loud * VOICE_READ,
  }
}

/** Is the voice on at `t`, s? */
function voiceOn(level: VoiceLevel, t: number): boolean {
  return (level.rms[Math.floor(t / level.hopSec)] ?? 0) >= level.on
}

/**
 * How much of the song the voice is on (`voiceOn`'s level), 0 to 1, and
 * how long the song is, s: a vocal stem that is voice nearly all through
 * holds no breath to come in after (bleed, backing vocals, a long echo).
 */
export function voicedShare(level: VoiceLevel): {
  share: number
  seconds: number
} {
  const on = level.rms.filter((rms) => rms >= level.on).length
  return {
    share: level.rms.length === 0 ? 0 : on / level.rms.length,
    seconds: level.rms.length * level.hopSec,
  }
}

/** How long the voice was off before `t`, s, looking back to the song's start. */
function gapBefore(level: VoiceLevel, t: number): number {
  let at = t
  while (at > 0 && !voiceOn(level, at)) at -= level.hopSec
  return t - Math.max(0, at)
}

/**
 * The breath before line `i`, s: how long the voice was off before it. The
 * first line follows the intro, whatever breath the stem holds; so does the
 * first line with words, where the voice's lines begin with a blip of bleed
 * in the intro.
 */
export function breathBefore(reading: EntryReading, i: number): number {
  const { level, lines } = reading
  const start = lines[i].start
  const first = i === 0 || i === lines.findIndex((line) => line.words !== '')
  return first ? start : gapBefore(level, start - 0.3) + 0.3
}

/** Where the voiced run holding `t` began, s. */
function runStart(level: VoiceLevel, t: number): number {
  let at = t
  while (at - level.hopSec > 0 && voiceOn(level, at - level.hopSec)) {
    at -= level.hopSec
  }
  return at
}

/** The song's middle note: the median of its stored notes, by duration. */
export function middleNote(notes: readonly StoredNote[]): number {
  const weighted = notes
    .map((note) => ({ midi: note.midi, seconds: note.endSec - note.startSec }))
    .sort((a, b) => a.midi - b.midi)
  const total = weighted.reduce((sum, note) => sum + note.seconds, 0)
  let seen = 0
  for (const note of weighted) {
    seen += note.seconds
    if (seen >= total / 2) return note.midi
  }
  return weighted[weighted.length - 1]?.midi ?? 60
}

/**
 * The stored notes under a steady note: the other tracker can start the
 * note a moment after this one settles, so a note starting by the steady
 * note's end counts. One that ended before it is the note before.
 */
function storedNotesUnder(
  notes: readonly StoredNote[],
  steady: SteadyNote,
): StoredNote[] {
  const to = steady.until + 0.05
  return notes.filter((note) => note.startSec <= to && note.endSec > steady.t)
}

/**
 * A song's lines where it has no synced lyrics: each place the voice comes
 * in after at least ENTRY_GAP_SEC without it, and its first.
 */
export function breathLines(level: VoiceLevel): SongLine[] {
  const lines: SongLine[] = []
  let offSince = 0
  let on = false
  for (let frame = 0; frame < level.rms.length; frame++) {
    const t = frame * level.hopSec
    const now = level.rms[frame] >= level.on
    if (now && !on && (lines.length === 0 || t - offSince >= ENTRY_GAP_SEC)) {
      lines.push({ start: t, words: '' })
    }
    if (!now && on) offSince = t
    on = now
  }
  return lines
}

/** Where the voice comes in after ONSET_QUIET_SEC of quiet, s: each phrase. */
function voiceOnsets(level: VoiceLevel): number[] {
  const onsets: number[] = []
  let quietSince = 0
  let on = false
  for (let frame = 0; frame < level.rms.length; frame++) {
    const t = frame * level.hopSec
    const now = level.rms[frame] >= level.on
    if (now && !on && t - quietSince >= ONSET_QUIET_SEC) onsets.push(t)
    if (!now && on) quietSince = t
    on = now
  }
  return onsets
}

/** How far `t` is from the nearest of `sorted`, s. */
function nearest(sorted: readonly number[], t: number): number {
  let low = 0
  let high = sorted.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (sorted[mid] < t) low = mid + 1
    else high = mid
  }
  const after = Math.abs(sorted[low] - t)
  return low > 0 ? Math.min(after, Math.abs(t - sorted[low - 1])) : after
}

/**
 * How far the synced lyrics are from this recording, s: the shift, within
 * LYRICS_SHIFT_MAX_SEC, that lands their lines nearest the places the voice
 * comes in. Null when no shift lands LYRICS_MATCH_SHARE of them within
 * ONSET_MATCH_SEC of one, over the lines any shift lands by chance (the
 * median shift's): lyrics for another recording, or none in time. A song
 * sung in many short phrases lands lyrics somewhere at almost any shift.
 */
export function lyricsShift(
  level: VoiceLevel,
  lyrics: readonly SongLine[],
): number | null {
  const onsets = voiceOnsets(level)
  if (lyrics.length === 0 || onsets.length === 0) return null
  const step = 0.02
  const reach = Math.round(LYRICS_SHIFT_MAX_SEC / step)
  let best = { shift: 0, score: -1, landed: 0 }
  const landings: number[] = []
  for (let k = 0; k <= 2 * reach; k++) {
    // Out from no shift, so a tie keeps the smaller.
    const shift = (k % 2 === 0 ? k / 2 : -(k + 1) / 2) * step
    let score = 0
    let landed = 0
    for (const line of lyrics) {
      const off = nearest(onsets, line.start + shift)
      if (off > ONSET_MATCH_SEC) continue
      landed += 1
      score += 1 - off / ONSET_MATCH_SEC
    }
    landings.push(landed)
    if (score > best.score) best = { shift, score, landed }
  }
  const enough = Math.max(2, Math.ceil(lyrics.length * LYRICS_MATCH_SHARE))
  const chance = median(landings)
  return best.landed - chance >= enough ? Number(best.shift.toFixed(2)) : null
}

/**
 * A song's lines: where its voice comes in after a breath, and its synced
 * lyrics' lines moved onto this recording (`lyricsShift`), in order. A
 * voice's line and the lyric line nearest it within SAME_LINE_SEC are one
 * line, starting where the voice comes in, with the lyric's words. A lyric
 * line left over that would read a voice's line's note (one starting from
 * LOOK_BEFORE_SEC before it to LOOK_AFTER_SEC after) is that line too, and
 * lends it its words if it has none. Lyrics no shift fits give no lines:
 * the voice's own stand. `shift` is how far the lyrics moved, or null.
 */
export function songLines(
  level: VoiceLevel,
  lyrics: readonly SongLine[],
): { lines: SongLine[]; shift: number | null } {
  const breaths = breathLines(level)
  const shift = lyricsShift(level, lyrics)
  if (shift === null) return { lines: breaths, shift: null }
  const moved: SongLine[] = lyrics.map((line) => ({
    start: Math.max(0, line.start + shift),
    words: line.words,
  }))
  const taken = new Set<number>()
  const lines = breaths.map((breath) => {
    let at = -1
    for (const [i, line] of moved.entries()) {
      const off = Math.abs(line.start - breath.start)
      if (
        off <= SAME_LINE_SEC &&
        (at < 0 || off < Math.abs(moved[at].start - breath.start))
      ) {
        at = i
      }
    }
    if (at < 0) return breath
    taken.add(at)
    return { start: breath.start, words: moved[at].words }
  })
  const own: SongLine[] = []
  for (const [i, line] of moved.entries()) {
    if (taken.has(i)) continue
    const led = lines.findIndex(
      (breath) =>
        breath.start >= line.start - LOOK_BEFORE_SEC &&
        breath.start <= line.start + LOOK_AFTER_SEC,
    )
    if (led < 0) own.push(line)
    else if (lines[led].words === '') {
      lines[led] = { start: lines[led].start, words: line.words }
    }
  }
  return { lines: [...lines, ...own].sort((a, b) => a.start - b.start), shift }
}

export interface EntryReading {
  /** The vocal stem, mono. */
  readonly vocal: Samples
  /** Its loudness (`loudness(vocal)`). */
  readonly level: VoiceLevel
  /** The song's stored notes. */
  readonly notes: readonly StoredNote[]
  /** The song's lines, in order. */
  readonly lines: readonly SongLine[]
}

/** `cents` folded into one semitone's span, -50 to 50. */
function foldCents(cents: number): number {
  return ((((cents + 50) % 100) + 100) % 100) - 50
}

/**
 * Of `own` and each octave of it the stored notes `under` name, the one
 * nearest the song's `middle`; null when they name none.
 */
function octaveNearest(
  own: number,
  under: readonly StoredNote[],
  middle: number,
): number | null {
  const octaves = under.filter(
    (note) => (((note.midi - own) % 12) + 12) % 12 === 0,
  )
  if (octaves.length === 0) return null
  return octaves.reduce(
    (best, note) =>
      Math.abs(note.midi - middle) < Math.abs(best - middle) ? note.midi : best,
    own,
  )
}

/**
 * The note the voice's first steady stretch is, MIDI; or why it is not a
 * note to judge anyone against: it settles too late after the voice comes
 * in at `voiceIn`, the stored notes `under` it name another, it was sung
 * out of tune in the song's `tuning`, or it is far from the song's
 * `middle` note. The stored notes may name it an octave away (two trackers
 * can lock an octave apart, and the room hears a note in any octave): the
 * note is then the octave nearest the song's middle, of the voice's and
 * those the stored notes name.
 */
function noteOf(
  steady: SteadyNote,
  voiceIn: number,
  under: readonly StoredNote[],
  middle: number,
  tuning: number,
): number | string {
  const sung = steady.midi - tuning / 100
  const own = Math.round(sung)
  const within = steady.swung ? SWUNG_WITHIN_SEC : STEADY_WITHIN_SEC
  if (steady.t - voiceIn > within) {
    return `the note settles ${(steady.t - voiceIn).toFixed(2)} s in`
  }
  // The stored notes are A440's: in a tuning near half a semitone out they
  // may round either way.
  const raw = Math.round(steady.midi)
  let midi: number | null = under.some(
    (note) => note.midi === own || note.midi === raw,
  )
    ? own
    : null
  midi ??= octaveNearest(own, under, middle)
  if (midi === null) {
    const named =
      under.length === 0
        ? 'none'
        : under.map((note) => note.noteName ?? noteName(note.midi)).join(' ')
    return `YIN ${noteName(own)}, notes ${named}`
  }
  if (Math.abs(sung - own) * 100 > IN_TUNE_CENTS) {
    return `${Math.round((sung - own) * 100)} cents off ${noteName(own)}`
  }
  if (Math.abs(midi - middle) > RANGE_SEMITONES) {
    return `${noteName(midi)} is far from the song's ${noteName(middle)}`
  }
  return midi
}

/** What a line's voice gave: its first steady stretch, and where it came in. */
export interface LineVoice {
  /** The line's place in the song's lines. */
  readonly line: number
  /** The voice's first steady note near the line (voice-pitch.ts); null for none. */
  readonly steady: SteadyNote | null
  /** Where the voiced run holding the stretch began, s. */
  readonly voiceIn: number
}

/**
 * Line `i`'s voice, or null for a line with no breath before it: the
 * reading, the most of a song's read. In steps, a step after each pitch
 * reading, so a reader on a phone can let the screen draw inside a line.
 */
export function* lineSteps(
  reading: EntryReading,
  i: number,
): RuleSteps<LineVoice | null> {
  const { vocal, level, lines } = reading
  const start = lines[i].start
  if (breathBefore(reading, i) < ENTRY_GAP_SEC) return null
  const steady = yield* firstSteady(
    vocal,
    level,
    start - LOOK_BEFORE_SEC,
    start + LOOK_AFTER_SEC,
  )
  return {
    line: i,
    steady,
    voiceIn: steady === null ? start : runStart(level, steady.t),
  }
}

/**
 * The song's tuning, cents from A440's notes: where its lines' notes sit
 * between two of them, the one offset nearest all of them round the
 * semitone. 0 with fewer than TUNING_LINES_MIN notes, or within
 * TUNING_MIN_CENTS of A440, where a singer's own drift would be all it read.
 */
export function songTuning(voices: readonly (LineVoice | null)[]): number {
  const offsets: number[] = []
  for (const voice of voices) {
    const steady = voice?.steady
    if (steady === null || steady === undefined) continue
    offsets.push(foldCents((steady.midi - Math.round(steady.midi)) * 100))
  }
  if (offsets.length < TUNING_LINES_MIN) return 0
  let best = { cents: 0, cost: Infinity }
  // Out from A440, so a tie keeps the nearer.
  for (let k = 0; k < 100; k++) {
    const cents = k % 2 === 0 ? k / 2 : -(k + 1) / 2
    const cost = offsets.reduce(
      (sum, offset) => sum + Math.abs(foldCents(offset - cents)),
      0,
    )
    if (cost < best.cost) best = { cents, cost }
  }
  return Math.abs(best.cents) < TUNING_MIN_CENTS ? 0 : best.cents
}

/**
 * Line `voice.line` as an entry, or why it is not one ("the note settles
 * 0.64 s in"), in the song's `tuning` (`songTuning`). `middle` is the
 * song's middle note (`middleNote`).
 */
export function judgeLine(
  reading: EntryReading,
  voice: LineVoice,
  middle: number,
  tuning: number,
): FoundEntry | string {
  const { notes, lines } = reading
  const line = lines[voice.line]
  const { steady, voiceIn } = voice
  if (steady === null) return `${line.start.toFixed(2)} no steady note`
  const midi = noteOf(
    steady,
    voiceIn,
    storedNotesUnder(notes, steady),
    middle,
    tuning,
  )
  if (typeof midi === 'string') return `${line.start.toFixed(2)} ${midi}`
  const at = Math.max(0, voiceIn - STOP_LEAD_SEC)
  const next = lines[voice.line + 1]?.start ?? at + LINE_MAX_SEC
  const until = Math.min(
    at + LINE_MAX_SEC,
    Math.max(at + LINE_MIN_SEC, next - 0.05),
  )
  const from = Math.max(0, at - LEAD_SEC)
  return {
    at: Number(at.toFixed(3)),
    midi,
    from: Number(from.toFixed(3)),
    until: Number(until.toFixed(3)),
    words: line.words,
    ...(tuning === 0 ? {} : { cents: tuning }),
  }
}

/** What a song's read found. */
export interface SongEntries {
  readonly entries: FoundEntry[]
  /** Each line with a breath before it that is not an entry, and why. */
  readonly dropped: string[]
  /**
   * What became of every line, in order, for a reader's log: "12.30 entry
   * G4", "15.02 no steady note", "16.40 no breath before it (0.6 s)".
   */
  readonly told: string[]
  /** How many lines had no breath before them: never a way in. */
  readonly breathless: number
  /** The song's tuning the lines were judged in, cents (`songTuning`). */
  readonly tuning: number
}

/**
 * `found` among `entries`: an entry of its own, or another line of one
 * already there (true).
 */
function addEntry(entries: FoundEntry[], found: FoundEntry): boolean {
  const same = entries.findIndex(
    (entry) => Math.abs(entry.at - found.at) < 0.05,
  )
  if (same < 0) {
    entries.push(found)
    return false
  }
  const kept = entries[same]
  entries[same] = {
    ...kept,
    words: kept.words === '' ? found.words : kept.words,
    until: Math.max(kept.until, found.until),
  }
  return true
}

/**
 * The song's lines judged, from each line's voice (`lineSteps`, null for a
 * line with no breath before it), one voice a line and in their order:
 * `voices[i]` is line i's. The song's tuning from them all, then each line
 * in it. Lines that find the same place the voice comes in (a blip of bleed
 * before a phrase is a voice's line too) are one entry: the first's, with
 * the first words any has, sung with you to the line after the last. A line
 * sung with you ends where the next entry begins, if that comes first: it
 * would sing the next round's note.
 */
export function judgeSong(
  reading: EntryReading,
  voices: readonly (LineVoice | null)[],
): SongEntries {
  const tuning = songTuning(voices)
  const middle = middleNote(reading.notes)
  const entries: FoundEntry[] = []
  const dropped: string[] = []
  const told: string[] = []
  for (const [i, voice] of voices.entries()) {
    if (voice === null) {
      const start = reading.lines[i].start.toFixed(2)
      const breath = breathBefore(reading, i).toFixed(1)
      told.push(`${start} no breath before it (${breath} s)`)
      continue
    }
    const found = judgeLine(reading, voice, middle, tuning)
    if (typeof found === 'string') {
      dropped.push(found)
      told.push(found)
      continue
    }
    const start = reading.lines[voice.line].start.toFixed(2)
    const note = noteName(found.midi)
    told.push(
      addEntry(entries, found)
        ? `${start} entry ${note}, the one an earlier line found`
        : `${start} entry ${note}`,
    )
  }
  entries.sort((a, b) => a.at - b.at)
  return {
    entries: entries.map((entry, i) => {
      const next = entries[i + 1]
      return next === undefined || entry.until <= next.at
        ? entry
        : { ...entry, until: next.at }
    }),
    dropped,
    told,
    breathless: voices.filter((voice) => voice === null).length,
    tuning,
  }
}

/**
 * A song's entries: every line's voice read first (`lineSteps`), then the
 * song judged (`judgeSong`). In steps.
 */
export function* songSteps(reading: EntryReading): RuleSteps<SongEntries> {
  const voices: (LineVoice | null)[] = []
  for (let i = 0; i < reading.lines.length; i++) {
    voices.push(yield* lineSteps(reading, i))
  }
  return judgeSong(reading, voices)
}

/** A song's entries (`songSteps`), read straight through. */
export function findEntries(reading: EntryReading): SongEntries {
  return runSteps(songSteps(reading))
}
