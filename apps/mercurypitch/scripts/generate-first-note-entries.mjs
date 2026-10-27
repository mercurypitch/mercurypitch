// ============================================================
// First note's entries: where each example song's singer comes in
// ============================================================
//
//   node scripts/generate-first-note-entries.mjs
//
// First note (docs/plans/ear-rooms.md) plays an example song's band up to
// the moment its singer comes in, stops, and asks the singer to sing that
// first note. This finds those moments in the three songs the app ships and
// writes them, with the note and the beats that lead in, to
// src/features/first-note/first-note-entries.json, committed, as the songs'
// notes are (generate-karaoke-example-notes.mjs).
//
// AN ENTRY is a line of the song's timed lyrics that follows a breath: at
// least ENTRY_GAP_SEC with no voice on the vocal stem before it. Its note is
// the voice's first steady stretch: STEADY_SEC of readings within
// STEADY_CENTS of their median, read here by YIN on the vocal stem. It is
// kept only when the mixer's notes (notes.json, another tracker) name the
// same note there, and when the voice sat within IN_TUNE_CENTS of it: a
// note two trackers disagree on, or one the singer bent, is not a note to
// judge anyone against. Nor is a note far from the song's middle note
// (RANGE_SEMITONES): both trackers can lock onto a harmonic together. The
// stored notes alone are not enough: the same chorus line reads as F5, C5
// and D5 in its three choruses.
//
// THE BAND STOPS where the voiced run that holds that stretch begins, so a
// breath or a scoop before the note is the singer's way in, not the band's.
// The line the singer sings with you runs to the next line, or LINE_MAX_SEC.
//
// THE BEATS are the last four before the entry, on the band's own grid: its
// tempo from the instrumental's onsets over the whole song, its phase from
// the onsets in the lead-in. An entry whose lead-in does not show the grid
// clearly gets none, and the room shows only the countdown.
//
// Decoding is ffmpeg's. Needs ffmpeg on the PATH and the stems present (any
// native build fetches them; so does `node scripts/fetch-karaoke-examples.mjs`).
// Each song records the sha256 of the vocal it was read from, and a test
// fails when a stem's pin changes and the entries were not generated again
// (src/first-note-entries.test.ts).

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import { checkKaraokeExamples, KARAOKE_EXAMPLE_PINS, NATIVE_ONLY_DIR, } from './fetch-karaoke-examples.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const REPO = join(here, '../../..')

/** Where the room reads its entries. */
export const ENTRIES_PATH = join(
  REPO,
  'src/features/first-note/first-note-entries.json',
)

/** The vocal's rate for the pitch reading; enough for a voice's notes. */
const VOCAL_RATE = 16_000
/** The instrumental's rate for its onsets. */
const BAND_RATE = 22_050

/** No voice for this long before a line makes it an entry, s. */
const ENTRY_GAP_SEC = 1.6
/** An entry's note sits within this of the song's middle note, semitones. */
const RANGE_SEMITONES = 9
/** The voice is "on" above this share of its own loud level (p90 RMS). */
const VOICE_ON = 0.12
/** A reading is taken above this share of it: quieter is breath and bleed. */
const VOICE_READ = 0.1
/** A steady stretch: this long, s, inside this much of its median, cents. */
const STEADY_SEC = 0.2
const STEADY_CENTS = 40
/** The stretch must start within this of the voice coming in, s. */
const STEADY_WITHIN_SEC = 0.45
/** The singer's note sat this close to its equal-tempered note, cents. */
const IN_TUNE_CENTS = 30
/** The band leads in for this long before the entry, s. */
const LEAD_SEC = 8
/** The band stops this far ahead of the voice, s. */
const STOP_LEAD_SEC = 0.05
/** The line sung with you runs at least and at most this long, s. */
const LINE_MIN_SEC = 2.5
const LINE_MAX_SEC = 6.5
/** Beats shown before the entry. */
const BEATS_SHOWN = 4
/** A lead-in shows its grid when beats carry this much more onset than the mean. */
const GRID_CLEAR = 1.4

/** YIN's settings: the voice's range, and its dip threshold. */
const F_MIN = 70
const F_MAX = 1000
const YIN_FRAME = 1024
const YIN_THRESHOLD = 0.15
/** Pitch readings every, s. */
const READ_STEP_SEC = 0.01

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** A MIDI note's name, "E3". */
function noteName(midi) {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

/** `path` as mono 32-bit floats at `rate`. */
function decodeMono(path, rate) {
  const out = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      path,
      '-ac',
      '1',
      '-ar',
      String(rate),
      '-f',
      'f32le',
      '-',
    ],
    { maxBuffer: 1 << 30 },
  )
  return new Float32Array(
    out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength),
  )
}

/** Each lyric line's start, s, from the manifest's timed lyrics. */
export function lineStarts(lyricsText) {
  const starts = []
  for (const line of lyricsText.split('\n')) {
    const match = /^\[(\d+):(\d+(?:\.\d+)?)\]/u.exec(line)
    if (match !== null) starts.push(Number(match[1]) * 60 + Number(match[2]))
  }
  return starts
}

/** RMS every 20 ms over 40 ms, and the levels the voice counts as on and read at. */
function loudness(samples, rate) {
  const hop = Math.round(0.02 * rate)
  const size = Math.round(0.04 * rate)
  const rms = []
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

/** One YIN reading at `start`, MIDI, or null where no pitch is clear. */
function yinMidi(samples, start, rate) {
  const maxLag = Math.floor(rate / F_MIN)
  const minLag = Math.floor(rate / F_MAX)
  const width = YIN_FRAME - maxLag
  if (start < 0 || start + YIN_FRAME > samples.length) return null
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

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/** The voice's first steady stretch from `from` to `to`, s, or null. */
function firstSteady(vocal, level, from, to) {
  const readings = []
  for (let t = from; t < to; t += READ_STEP_SEC) {
    const frame = Math.floor(t / level.hopSec)
    const voiced = (level.rms[frame] ?? 0) >= level.read
    readings.push({
      t,
      midi: voiced
        ? yinMidi(vocal, Math.round(t * VOCAL_RATE), VOCAL_RATE)
        : null,
    })
  }
  const span = Math.round(STEADY_SEC / READ_STEP_SEC)
  for (let i = 0; i + span <= readings.length; i++) {
    const stretch = readings.slice(i, i + span)
    if (stretch.some((reading) => reading.midi === null)) continue
    const centre = median(stretch.map((reading) => reading.midi))
    const wide = stretch.some(
      (reading) => Math.abs(reading.midi - centre) * 100 > STEADY_CENTS,
    )
    if (!wide) return { t: stretch[0].t, midi: centre }
  }
  return null
}

/** Is the voice on at `t`, s? */
function voiceOn(level, t) {
  return (level.rms[Math.floor(t / level.hopSec)] ?? 0) >= level.on
}

/** How long the voice was off before `t`, s, looking back to the song's start. */
function gapBefore(level, t) {
  let at = t
  while (at > 0 && !voiceOn(level, at)) at -= level.hopSec
  return t - Math.max(0, at)
}

/** Where the voiced run holding `t` began, s. */
function runStart(level, t) {
  let at = t
  while (at - level.hopSec > 0 && voiceOn(level, at - level.hopSec)) {
    at -= level.hopSec
  }
  return at
}

/** The song's middle note: the median of its stored notes, by duration. */
function middleNote(notes) {
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

/** The mixer's note that covers `t`, from notes.json, or null. */
function storedNoteAt(notes, t) {
  return (
    notes.find(
      (note) => note.startSec - 0.15 <= t && t <= note.endSec + 0.05,
    ) ?? null
  )
}

// ---- The band's beats ------------------------------------------------------

/** An in-place radix-2 FFT over `re` and `im`. */
function fft(re, im) {
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
    const angle = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const cos = Math.cos(angle * k)
        const sin = Math.sin(angle * k)
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cos - im[b] * sin
        const ti = re[b] * sin + im[b] * cos
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

/** The band's onset strength, ~100 a second: log-spectral flux, local mean off. */
function onsets(band) {
  const size = 1024
  const hop = 220
  const window = Float64Array.from(
    { length: size },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)),
  )
  const flux = []
  let previous = null
  for (let at = 0; at + size <= band.length; at += hop) {
    const re = new Float64Array(size)
    const im = new Float64Array(size)
    for (let i = 0; i < size; i++) re[i] = band[at + i] * window[i]
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
  return { flux: out, fps: BAND_RATE / hop }
}

/** The song's tempo, bpm: the autocorrelation's best lag, and its double. */
function tempoOf({ flux, fps }) {
  const maxLag = Math.ceil((120 / 60) * fps) + 2
  const ac = new Float64Array(maxLag + 1)
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i + lag < flux.length; i++) sum += flux[i] * flux[i + lag]
    ac[lag] = sum
  }
  const at = (lag) => {
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
function beatsBefore({ flux, fps }, bpm, from, at) {
  const period = 60 / bpm
  const strength = (t) => flux[Math.round(t * fps)] ?? 0
  let best = { phase: 0, score: -Infinity }
  for (let phase = 0; phase < period; phase += 0.01) {
    let score = 0
    for (let t = from + phase; t < at; t += period) score += strength(t)
    if (score > best.score) best = { phase, score }
  }
  const grid = []
  for (let t = from + best.phase; t < at - 0.08; t += period) grid.push(t)
  let mean = 0
  let count = 0
  for (let t = from; t < at; t += 1 / fps) {
    mean += strength(t)
    count += 1
  }
  mean /= Math.max(1, count)
  const onGrid = grid.reduce((sum, t) => sum + strength(t), 0) / grid.length
  if (grid.length < BEATS_SHOWN || mean <= 0 || onGrid / mean < GRID_CLEAR) {
    return []
  }
  return grid.slice(-BEATS_SHOWN).map((t) => Number(t.toFixed(3)))
}

// ---- One song --------------------------------------------------------------

/** A song's entries, from its stems, its notes and its lyrics. */
function entriesOf(song, vocal, band, notes) {
  const level = loudness(vocal, VOCAL_RATE)
  const grid = onsets(band)
  const bpm = tempoOf(grid)
  const starts = lineStarts(song.lyricsText)
  const middle = middleNote(notes)
  const entries = []
  const dropped = []
  for (const [i, start] of starts.entries()) {
    // The first line follows the intro, whatever breath the stem holds.
    const gap = i === 0 ? start : gapBefore(level, start - 0.3) + 0.3
    if (gap < ENTRY_GAP_SEC) continue
    const steady = firstSteady(vocal, level, start - 0.6, start + 1.2)
    if (steady === null) {
      dropped.push(`${start.toFixed(2)} no steady note`)
      continue
    }
    const voiceIn = runStart(level, steady.t)
    const midi = Math.round(steady.midi)
    const stored = storedNoteAt(notes, steady.t + 0.1)
    const why =
      steady.t - voiceIn > STEADY_WITHIN_SEC
        ? `the note settles ${(steady.t - voiceIn).toFixed(2)} s in`
        : stored === null || stored.midi !== midi
          ? `YIN ${noteName(midi)}, notes ${stored?.noteName ?? 'none'}`
          : Math.abs(steady.midi - midi) * 100 > IN_TUNE_CENTS
            ? `${Math.round((steady.midi - midi) * 100)} cents off ${noteName(midi)}`
            : Math.abs(midi - middle) > RANGE_SEMITONES
              ? `${noteName(midi)} is far from the song's ${noteName(middle)}`
              : null
    if (why !== null) {
      dropped.push(`${start.toFixed(2)} ${why}`)
      continue
    }
    const at = Math.max(0, voiceIn - STOP_LEAD_SEC)
    const next = starts[i + 1] ?? at + LINE_MAX_SEC
    const until = Math.min(
      at + LINE_MAX_SEC,
      Math.max(at + LINE_MIN_SEC, next - 0.05),
    )
    const from = Math.max(0, at - LEAD_SEC)
    entries.push({
      at: Number(at.toFixed(3)),
      midi,
      from: Number(from.toFixed(3)),
      until: Number(until.toFixed(3)),
      beats: beatsBefore(grid, bpm, from, at),
    })
  }
  return { bpm, entries, dropped }
}

async function main() {
  const missing = checkKaraokeExamples()
  if (missing.length > 0) {
    throw new Error(
      `[first-note] the stems are not all here: ${missing.join(', ')}. Run node scripts/fetch-karaoke-examples.mjs first.`,
    )
  }
  const manifest = JSON.parse(
    readFileSync(
      join(NATIVE_ONLY_DIR, 'karaoke/examples/manifest.json'),
      'utf8',
    ),
  )
  const songs = []
  for (const song of manifest.songs) {
    const vocalPath = song.stems.vocal.replace(/^\//u, '')
    const pin = KARAOKE_EXAMPLE_PINS.find(
      (candidate) => candidate.path === vocalPath,
    )
    if (pin === undefined)
      throw new Error(`[first-note] no pin for ${vocalPath}`)
    const notesFile = JSON.parse(
      readFileSync(
        join(NATIVE_ONLY_DIR, song.notes.replace(/^\//u, '')),
        'utf8',
      ),
    )
    const vocal = decodeMono(join(NATIVE_ONLY_DIR, vocalPath), VOCAL_RATE)
    const band = decodeMono(
      join(NATIVE_ONLY_DIR, song.stems.instrumental.replace(/^\//u, '')),
      BAND_RATE,
    )
    const { bpm, entries, dropped } = entriesOf(
      song,
      vocal,
      band,
      notesFile.segmentedNotes,
    )
    songs.push({
      slug: song.slug,
      title: song.title,
      artist: song.artist,
      attribution: song.attribution,
      stems: song.stems,
      vocalSha256: pin.sha256,
      bpm,
      entries,
    })
    console.log(
      `[first-note] ${song.slug}: ${bpm} bpm, ${entries.length} entries: ${entries
        .map(
          (entry) =>
            `${entry.at.toFixed(2)} ${noteName(entry.midi)}${entry.beats.length > 0 ? '' : ' (no beats)'}`,
        )
        .join(', ')}`,
    )
    for (const line of dropped) console.log(`[first-note]   dropped ${line}`)
  }
  // As the repo's formatter writes it, so a run that changes nothing leaves no diff.
  const text = await prettier.format(JSON.stringify({ version: 1, songs }), {
    ...(await prettier.resolveConfig(ENTRIES_PATH)),
    filepath: ENTRIES_PATH,
  })
  writeFileSync(ENTRIES_PATH, text)
  console.log(
    `[first-note] -> ${ENTRIES_PATH} (${Buffer.byteLength(text)} bytes)`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
