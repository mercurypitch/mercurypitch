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
// are its synced lyrics' lines where it has them, and otherwise where the
// voice comes in after such a breath. The entry's note is the voice's first
// steady stretch: STEADY_SEC of readings within STEADY_CENTS of their
// median, read here by YIN on the vocal stem. It is kept only when the
// song's stored notes (the mixer's, another tracker) name the same note
// there, and when the voice sat within IN_TUNE_CENTS of it: a note two
// trackers disagree on, or one the singer bent, is not a note to judge
// anyone against. Nor is a note far from the song's middle note
// (RANGE_SEMITONES): both trackers can lock onto a harmonic together.
//
// THE BAND STOPS where the voiced run that holds that stretch begins, so a
// breath or a scoop before the note is the singer's way in, not the band's.
// The line the singer sings with you runs to the next line, or LINE_MAX_SEC.
//
// THE BEATS are the last four before the entry, on the band's own grid: its
// tempo from the instrumental's onsets, its phase from the onsets in the
// lead-in. An entry whose lead-in does not show the grid clearly gets none,
// and the room shows only the countdown. The script reads the whole band;
// the phone reads only the lead-ins, and the tempo from them together.
//
// THE WORK COMES IN STEPS. A line's note (a YIN reading every 10 ms) and a
// lead-in's onsets (an FFT every 10 ms) are most of a read, and a phone reads
// on the thread that draws its screen. So both are generators that yield
// after each reading (entrySteps, onsetSteps): the phone lets the screen draw
// between slices of them, and the script runs them straight through
// (findEntry, onsets).
//
// Node runs this file as it is, through its type stripping, from the
// script: so it imports nothing, and its syntax is all erasable (no enums,
// no namespaces, no parameter properties).

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
/** Beats shown before the entry. */
export const BEATS_SHOWN = 4
/** A lead-in shows its grid when beats carry this much more onset than the mean. */
export const GRID_CLEAR = 1.4

/** The rate the YIN frame below is sized for; the script reads at it. */
export const VOCAL_RATE = 16_000
/** The rate the onset frames below are sized for; the script reads at it. */
export const BAND_RATE = 22_050

/** YIN's settings: the voice's range, its frame at VOCAL_RATE, its dip threshold. */
const F_MIN = 70
const F_MAX = 1000
const YIN_FRAME = 1024
const YIN_THRESHOLD = 0.15
/** Pitch readings every, s. */
const READ_STEP_SEC = 0.01
/** The onsets' hop at BAND_RATE, samples: about a hundred a second. */
const ONSET_HOP = 220

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
  const diff = new Float64Array(maxLag + 1)
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < width; i++) {
      const d = samples[start + i] - samples[start + i + lag]
      sum += d * d
    }
    diff[lag] = sum
  }
  const norm = new Float64Array(maxLag + 1)
  norm[0] = 1
  let running = 0
  for (let lag = 1; lag <= maxLag; lag++) {
    running += diff[lag]
    norm[lag] = running > 0 ? (diff[lag] * lag) / running : 1
  }
  let lag = -1
  for (let t = minLag; t < maxLag; t++) {
    if (norm[t] < YIN_THRESHOLD) {
      while (t + 1 < maxLag && norm[t + 1] < norm[t]) t++
      lag = t
      break
    }
  }
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

/** The stored note that covers `t`, or null. */
function storedNoteAt(
  notes: readonly StoredNote[],
  t: number,
): StoredNote | null {
  return (
    notes.find(
      (note) => note.startSec - 0.15 <= t && t <= note.endSec + 0.05,
    ) ?? null
  )
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

/**
 * Line `i` of the song as an entry; why it is not one ("the note settles
 * 0.64 s in"); or null for a line with no breath before it. `middle` is the
 * song's middle note (`middleNote`). In steps, a step after each pitch
 * reading, so a reader on a phone can let the screen draw inside a line.
 */
export function* entrySteps(
  reading: EntryReading,
  i: number,
  middle: number,
): RuleSteps<FoundEntry | string | null> {
  const { vocal, level, notes, lines } = reading
  const line = lines[i]
  const start = line.start
  // The first line follows the intro, whatever breath the stem holds.
  const gap = i === 0 ? start : gapBefore(level, start - 0.3) + 0.3
  if (gap < ENTRY_GAP_SEC) return null
  const steady = yield* firstSteady(vocal, level, start - 0.6, start + 1.2)
  if (steady === null) return `${start.toFixed(2)} no steady note`
  const voiceIn = runStart(level, steady.t)
  const midi = Math.round(steady.midi)
  const stored = storedNoteAt(notes, steady.t + 0.1)
  const why =
    steady.t - voiceIn > STEADY_WITHIN_SEC
      ? `the note settles ${(steady.t - voiceIn).toFixed(2)} s in`
      : stored === null || stored.midi !== midi
        ? `YIN ${noteName(midi)}, notes ${stored === null ? 'none' : (stored.noteName ?? noteName(stored.midi))}`
        : Math.abs(steady.midi - midi) * 100 > IN_TUNE_CENTS
          ? `${Math.round((steady.midi - midi) * 100)} cents off ${noteName(midi)}`
          : Math.abs(midi - middle) > RANGE_SEMITONES
            ? `${noteName(midi)} is far from the song's ${noteName(middle)}`
            : null
  if (why !== null) return `${start.toFixed(2)} ${why}`
  const at = Math.max(0, voiceIn - STOP_LEAD_SEC)
  const next = lines[i + 1]?.start ?? at + LINE_MAX_SEC
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
  }
}

/** Line `i` as an entry (`entrySteps`), read straight through. */
export function findEntry(
  reading: EntryReading,
  i: number,
  middle: number,
): FoundEntry | string | null {
  return runSteps(entrySteps(reading, i, middle))
}

/** A song's entries, and why each line that is not one was dropped. */
export function findEntries(reading: EntryReading): {
  entries: FoundEntry[]
  dropped: string[]
} {
  const middle = middleNote(reading.notes)
  const entries: FoundEntry[] = []
  const dropped: string[] = []
  for (let i = 0; i < reading.lines.length; i++) {
    const found = findEntry(reading, i, middle)
    if (typeof found === 'string') dropped.push(found)
    else if (found !== null) entries.push(found)
  }
  return { entries, dropped }
}

// ---- The band's beats ------------------------------------------------------

/** The band's onset strength over a stretch of it, from `start`, s. */
export interface OnsetGrid {
  readonly flux: readonly number[]
  /** Onset readings a second. */
  readonly fps: number
  /** Where the stretch starts on the song's clock, s. */
  readonly start: number
}

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array }>()

/** The rotations one FFT stage of `len` uses: worked out once a size. */
function twiddlesOf(len: number): { cos: Float64Array; sin: Float64Array } {
  const known = twiddles.get(len)
  if (known !== undefined) return known
  const angle = (-2 * Math.PI) / len
  const half = len / 2
  const cos = new Float64Array(half)
  const sin = new Float64Array(half)
  for (let k = 0; k < half; k++) {
    cos[k] = Math.cos(angle * k)
    sin[k] = Math.sin(angle * k)
  }
  const made = { cos, sin }
  twiddles.set(len, made)
  return made
}

/** An in-place radix-2 FFT over `re` and `im`. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const { cos, sin } = twiddlesOf(len)
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cos[k] - im[b] * sin[k]
        const ti = re[b] * sin[k] + im[b] * cos[k]
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

/**
 * The band's onset strength, about a hundred a second: log-spectral flux,
 * its local mean taken off. `start` places the stretch on the song's clock.
 * In steps, a step after each spectrum.
 */
export function* onsetSteps(band: Samples, start = 0): RuleSteps<OnsetGrid> {
  const size = band.rate > 32_000 ? 2048 : 1024
  const hop = Math.round((ONSET_HOP * band.rate) / BAND_RATE)
  const window = Float64Array.from(
    { length: size },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)),
  )
  const samples = band.samples
  const flux: number[] = []
  let previous: Float64Array | null = null
  for (let at = 0; at + size <= samples.length; at += hop) {
    const re = new Float64Array(size)
    const im = new Float64Array(size)
    for (let i = 0; i < size; i++) re[i] = samples[at + i] * window[i]
    fft(re, im)
    const mags = new Float64Array(size / 2)
    for (let k = 0; k < size / 2; k++) {
      mags[k] = Math.log1p(10 * Math.hypot(re[k], im[k]))
    }
    let sum = 0
    if (previous !== null) {
      for (let k = 0; k < mags.length; k++) {
        sum += Math.max(0, mags[k] - previous[k])
      }
    }
    flux.push(sum)
    previous = mags
    yield
  }
  const smooth = 50
  const out = flux.map((value, i) => {
    let local = 0
    let count = 0
    for (
      let j = Math.max(0, i - smooth / 2);
      j < Math.min(flux.length, i + smooth / 2);
      j++
    ) {
      local += flux[j]
      count += 1
    }
    return Math.max(0, value - local / count)
  })
  return { flux: out, fps: band.rate / hop, start }
}

/** The band's onset strength (`onsetSteps`), read straight through. */
export function onsets(band: Samples, start = 0): OnsetGrid {
  return runSteps(onsetSteps(band, start))
}

/**
 * The band's tempo, bpm, from stretches of it read at one rate: their
 * autocorrelations together, the best lag and its double. 0 with none.
 */
export function tempoOf(grids: readonly OnsetGrid[]): number {
  if (grids.length === 0) return 0
  const fps = grids[0].fps
  const maxLag = Math.ceil((120 / 60) * fps) + 2
  const ac = new Float64Array(maxLag + 1)
  for (const { flux } of grids) {
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0
      for (let i = 0; i + lag < flux.length; i++) sum += flux[i] * flux[i + lag]
      ac[lag] += sum
    }
  }
  const at = (lag: number): number => {
    const low = Math.floor(lag)
    const share = lag - low
    return ac[low] * (1 - share) + (ac[low + 1] ?? 0) * share
  }
  let best = { bpm: 0, score: -Infinity }
  for (let bpm = 60; bpm <= 190; bpm += 0.5) {
    const lag = (60 / bpm) * fps
    const score = at(lag) + 0.5 * at(2 * lag)
    if (score > best.score) best = { bpm, score }
  }
  return best.bpm
}

/** The last BEATS_SHOWN beats before `at`, s, on the band's grid, or []. */
export function beatsBefore(
  grid: OnsetGrid,
  bpm: number,
  from: number,
  at: number,
): number[] {
  if (!(bpm > 0)) return []
  const period = 60 / bpm
  const strength = (t: number): number =>
    grid.flux[Math.round((t - grid.start) * grid.fps)] ?? 0
  let best = { phase: 0, score: -Infinity }
  for (let phase = 0; phase < period; phase += 0.01) {
    let score = 0
    for (let t = from + phase; t < at; t += period) score += strength(t)
    if (score > best.score) best = { phase, score }
  }
  const beats: number[] = []
  for (let t = from + best.phase; t < at - 0.08; t += period) beats.push(t)
  let mean = 0
  let count = 0
  for (let t = from; t < at; t += 1 / grid.fps) {
    mean += strength(t)
    count += 1
  }
  mean /= Math.max(1, count)
  const onGrid = beats.reduce((sum, t) => sum + strength(t), 0) / beats.length
  if (beats.length < BEATS_SHOWN || mean <= 0 || onGrid / mean < GRID_CLEAR) {
    return []
  }
  return beats.slice(-BEATS_SHOWN).map((t) => Number(t.toFixed(3)))
}
