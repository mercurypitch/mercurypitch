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
// the voice's first steady stretch: STEADY_SEC of readings within
// STEADY_CENTS of their median, read here by YIN on the vocal stem. It is
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
// script: so it imports nothing, and its syntax is all erasable (no enums,
// no namespaces, no parameter properties).

// A change here that finds different entries raises ENTRY_RULES_VERSION
// (entry-rules-version.ts), so phones read the singer's songs again.

/** No voice for this long before a line makes it an entry, s. */
export const ENTRY_GAP_SEC = 1.6
/** An entry's note sits within this of the song's middle note, semitones. */
export const RANGE_SEMITONES = 9
/** The voice is "on" above this share of its own loud level (p90 RMS). */
export const VOICE_ON = 0.12
/** A reading is taken above this share of it: quieter is breath and bleed. */
export const VOICE_READ = 0.1
/** A steady stretch: this long, s, inside this much of its median, cents. */
export const STEADY_SEC = 0.2
export const STEADY_CENTS = 40
/** The stretch must start within this of the voice coming in, s. */
export const STEADY_WITHIN_SEC = 0.45
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

/** The rate the YIN frame below is sized for; the script reads at it. */
export const VOCAL_RATE = 16_000

/** YIN's settings: the voice's range, its frame at VOCAL_RATE, its dip threshold. */
const F_MIN = 70
const F_MAX = 1000
const YIN_FRAME = 1024
const YIN_THRESHOLD = 0.15
/** Pitch readings every, s. */
const READ_STEP_SEC = 0.01

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Work in steps: each yield is a place a reader may let the screen draw. */
export type RuleSteps<T> = Generator<void, T, undefined>

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

/** Mono samples and their rate. */
export interface Samples {
  readonly samples: Float32Array
  readonly rate: number
}

/** The vocal's loudness, and the levels the voice counts as on and read at. */
export interface VoiceLevel {
  readonly rms: readonly number[]
  readonly hopSec: number
  readonly on: number
  readonly read: number
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

/** YIN's difference at each lag up to `maxLag`, over `width` samples from `start`. */
function differences(
  samples: Float32Array,
  start: number,
  width: number,
  maxLag: number,
): Float64Array {
  const diff = new Float64Array(maxLag + 1)
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < width; i++) {
      const d = samples[start + i] - samples[start + i + lag]
      sum += d * d
    }
    diff[lag] = sum
  }
  return diff
}

/** The differences, each over the running mean of those before it. */
function normalised(diff: Float64Array): Float64Array {
  const norm = new Float64Array(diff.length)
  norm[0] = 1
  let running = 0
  for (let lag = 1; lag < diff.length; lag++) {
    running += diff[lag]
    norm[lag] = running > 0 ? (diff[lag] * lag) / running : 1
  }
  return norm
}

/** The first lag that dips under YIN_THRESHOLD, at the dip's floor; -1 for none. */
function firstDip(norm: Float64Array, minLag: number, maxLag: number): number {
  for (let t = minLag; t < maxLag; t++) {
    if (norm[t] < YIN_THRESHOLD) {
      while (t + 1 < maxLag && norm[t + 1] < norm[t]) t++
      return t
    }
  }
  return -1
}

/**
 * One YIN reading at sample `start`, MIDI, or null where no pitch is
 * clear. The frame spans the same time at any rate as YIN_FRAME does at
 * VOCAL_RATE.
 */
export function yinMidi(
  samples: Float32Array,
  start: number,
  rate: number,
): number | null {
  const frame = Math.round((YIN_FRAME * rate) / VOCAL_RATE)
  const maxLag = Math.floor(rate / F_MIN)
  const minLag = Math.floor(rate / F_MAX)
  const width = frame - maxLag
  if (start < 0 || start + frame > samples.length) return null
  const norm = normalised(differences(samples, start, width, maxLag))
  const lag = firstDip(norm, minLag, maxLag)
  if (lag < 1) return null
  const a = norm[lag - 1]
  const b = norm[lag]
  const c = norm[lag + 1]
  const den = a - 2 * b + c
  const shift = den === 0 ? 0 : (0.5 * (a - c)) / den
  return 69 + 12 * Math.log2(rate / (lag + shift) / 440)
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

interface Reading {
  readonly t: number
  readonly midi: number | null
}

/**
 * The voice's first steady stretch from `from` to `to`, s, or null. Read as
 * it goes: a stretch is judged once its last reading is in, so the first
 * that holds is the first a reading of the whole span would find. A step
 * after each reading.
 */
function* firstSteady(
  vocal: Samples,
  level: VoiceLevel,
  from: number,
  to: number,
): RuleSteps<{ t: number; midi: number } | null> {
  const span = Math.round(STEADY_SEC / READ_STEP_SEC)
  const readings: Reading[] = []
  for (let t = from; t < to; t += READ_STEP_SEC) {
    const frame = Math.floor(t / level.hopSec)
    const voiced = (level.rms[frame] ?? 0) >= level.read
    readings.push({
      t,
      midi: voiced
        ? yinMidi(vocal.samples, Math.round(t * vocal.rate), vocal.rate)
        : null,
    })
    yield
    const first = readings.length - span
    if (first < 0) continue
    const midis: number[] = []
    for (let i = first; i < readings.length; i++) {
      const midi = readings[i].midi
      if (midi === null) break
      midis.push(midi)
    }
    if (midis.length < span) continue
    const centre = median(midis)
    const wide = midis.some(
      (midi) => Math.abs(midi - centre) * 100 > STEADY_CENTS,
    )
    if (!wide) return { t: readings[first].t, midi: centre }
  }
  return null
}

/** Is the voice on at `t`, s? */
function voiceOn(level: VoiceLevel, t: number): boolean {
  return (level.rms[Math.floor(t / level.hopSec)] ?? 0) >= level.on
}

/** How long the voice was off before `t`, s, looking back to the song's start. */
function gapBefore(level: VoiceLevel, t: number): number {
  let at = t
  while (at > 0 && !voiceOn(level, at)) at -= level.hopSec
  return t - Math.max(0, at)
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
 * The stored notes under a steady stretch from `t`, s: the other tracker
 * can start the note a moment after this one settles, so a note starting by
 * the stretch's end counts. One that ended before it is the note before.
 */
function storedNotesUnder(
  notes: readonly StoredNote[],
  t: number,
): StoredNote[] {
  const to = t + STEADY_SEC + 0.05
  return notes.filter((note) => note.startSec <= to && note.endSec > t)
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
  steady: { readonly t: number; readonly midi: number },
  voiceIn: number,
  under: readonly StoredNote[],
  middle: number,
  tuning: number,
): number | string {
  const sung = steady.midi - tuning / 100
  const own = Math.round(sung)
  if (steady.t - voiceIn > STEADY_WITHIN_SEC) {
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
  /** The voice's first steady stretch near the line, s and MIDI; null for none. */
  readonly steady: { readonly t: number; readonly midi: number } | null
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
  // The first line follows the intro, whatever breath the stem holds; so
  // does the first line with words, where the voice's lines begin with a
  // blip of bleed in the intro.
  const first = i === 0 || i === lines.findIndex((line) => line.words !== '')
  const gap = first ? start : gapBefore(level, start - 0.3) + 0.3
  if (gap < ENTRY_GAP_SEC) return null
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
    storedNotesUnder(notes, steady.t),
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
  /** The song's tuning the lines were judged in, cents (`songTuning`). */
  readonly tuning: number
}

/**
 * The song's lines judged, from each line's voice (`lineSteps`, null for a
 * line with no breath before it): the song's tuning from them all, then
 * each line in it. Lines that find the same place the voice comes in (a
 * blip of bleed before a phrase is a voice's line too) are one entry: the
 * first's, with the first words any has, sung with you to the line after
 * the last. A line sung with you ends where the next entry begins, if that
 * comes first: it would sing the next round's note.
 */
export function judgeSong(
  reading: EntryReading,
  voices: readonly (LineVoice | null)[],
): SongEntries {
  const tuning = songTuning(voices)
  const middle = middleNote(reading.notes)
  const entries: FoundEntry[] = []
  const dropped: string[] = []
  for (const voice of voices) {
    if (voice === null) continue
    const found = judgeLine(reading, voice, middle, tuning)
    if (typeof found === 'string') {
      dropped.push(found)
      continue
    }
    const same = entries.findIndex(
      (entry) => Math.abs(entry.at - found.at) < 0.05,
    )
    if (same < 0) entries.push(found)
    else {
      const kept = entries[same]
      entries[same] = {
        ...kept,
        words: kept.words === '' ? found.words : kept.words,
        until: Math.max(kept.until, found.until),
      }
    }
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
