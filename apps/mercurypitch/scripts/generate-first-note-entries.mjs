// ============================================================
// First note's entries: where each example song's singer comes in
// ============================================================
//
//   node scripts/generate-first-note-entries.mjs
//
// First note (docs/plans/ear-rooms.md) plays an example song's band up to
// the moment its singer comes in, stops, and asks the singer to sing that
// first note. This finds those moments in the three songs the app ships and
// writes them, with the note, the beats that lead in and the line's words,
// to src/features/first-note/first-note-entries.json, committed, as the
// songs' notes are (generate-karaoke-example-notes.mjs).
//
// THE RULES are not here: they are src/features/first-note/entry-rules.ts,
// and the beats band-beats.ts beside it, which the phone also reads a
// singer's own songs by, so the two cannot drift. Node runs those files as
// they are (its type stripping). This script decodes the stems (ffmpeg's),
// hands them over, and writes what comes back.
// The stored notes the rules check against are the mixer's (notes.json): the
// stored notes alone are not enough, as the same chorus line reads as F5, C5
// and D5 in its three choruses.
//
// Needs ffmpeg on the PATH and the stems present (any native build fetches
// them; so does `node scripts/fetch-karaoke-examples.mjs`). Each song
// records the sha256 of the vocal it was read from, and a test fails when a
// stem's pin changes and the entries were not generated again
// (src/first-note-entries.test.ts).

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import { BAND_RATE, beatsBefore, onsets, tempoOf, } from '../../../src/features/first-note/band-beats.ts'
import { findEntries, loudness, lyricLines, noteName, songLines, VOCAL_RATE, } from '../../../src/features/first-note/entry-rules.ts'
import { checkKaraokeExamples, KARAOKE_EXAMPLE_PINS, NATIVE_ONLY_DIR, } from './fetch-karaoke-examples.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const REPO = join(here, '../../..')

/** Where the room reads its entries. */
export const ENTRIES_PATH = join(
  REPO,
  'src/features/first-note/first-note-entries.json',
)

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

/** A song's entries, from its stems, its notes and its lyrics. */
function entriesOf(song, vocal, band, notes) {
  const grid = onsets({ samples: band, rate: BAND_RATE })
  const bpm = tempoOf([grid])
  const level = loudness(vocal, VOCAL_RATE)
  const { lines, shift } = songLines(level, lyricLines(song.lyricsText))
  const { entries, dropped, tuning } = findEntries({
    vocal: { samples: vocal, rate: VOCAL_RATE },
    level,
    notes,
    lines,
  })
  return {
    bpm,
    shift,
    tuning,
    // The words last: a hint the room shows only when the singer asks for
    // it (owner, 28 Oct 2026).
    entries: entries.map((entry) => ({
      at: entry.at,
      midi: entry.midi,
      from: entry.from,
      until: entry.until,
      beats: beatsBefore(grid, bpm, entry.from, entry.at),
      words: entry.words,
      ...(entry.cents === undefined ? {} : { cents: entry.cents }),
    })),
    dropped,
  }
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
    const { bpm, shift, tuning, entries, dropped } = entriesOf(
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
      `[first-note] ${song.slug}: ${bpm} bpm, lyrics moved ${shift} s, tuning ${tuning} cents, ${entries.length} entries: ${entries
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
