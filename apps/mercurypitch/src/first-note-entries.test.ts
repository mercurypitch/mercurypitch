// ============================================================
// First note's entries, as the example songs the bundle carries hold them
// ============================================================
//
// First note (src/features/first-note) plays an example song's band up to
// where its singer comes in. Where that is, and the note, were read from
// the song's stems once (scripts/generate-first-note-entries.mjs) and
// committed. What can drift is the join: a stem whose pin changed, so the
// entries no longer fit the audio the app ships, or a song the manifest
// renamed. Either fails here, and the fix is to run the script again.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import entriesFile from '@/features/first-note/first-note-entries.json'
// @ts-expect-error -- a plain .mjs build script with no types, read as is.
import { KARAOKE_EXAMPLE_PINS, NATIVE_ONLY_DIR, } from '../scripts/fetch-karaoke-examples.mjs'

interface Pin {
  path: string
  sha256: string
}

interface ManifestSong {
  slug: string
  title: string
  artist: string
  attribution: {
    text: string
    url: string
    license: string
    licenseUrl: string
  }
  stems: { vocal: string; instrumental: string }
}

const pins = KARAOKE_EXAMPLE_PINS as readonly Pin[]
const manifest = JSON.parse(
  readFileSync(
    join(NATIVE_ONLY_DIR as string, 'karaoke/examples/manifest.json'),
    'utf8',
  ),
) as { songs: ManifestSong[] }

describe("First note's entries", () => {
  it('were read from the vocal stems the app ships, as pinned now', () => {
    for (const song of entriesFile.songs) {
      const vocal = song.stems.vocal.replace(/^\//u, '')
      const pin = pins.find((candidate) => candidate.path === vocal)
      expect(pin?.sha256, song.slug).toBe(song.vocalSha256)
    }
  })

  it('name each song as the manifest does, its credit included', () => {
    for (const song of entriesFile.songs) {
      const shipped = manifest.songs.find((other) => other.slug === song.slug)
      expect(shipped, song.slug).toBeDefined()
      expect(song.title).toBe(shipped?.title)
      expect(song.artist).toBe(shipped?.artist)
      expect(song.attribution).toEqual(shipped?.attribution)
      expect(song.stems).toEqual(shipped?.stems)
    }
  })

  it('give every song at least two entries, in order, each with its lead-in and line', () => {
    for (const song of entriesFile.songs) {
      expect(song.entries.length, song.slug).toBeGreaterThanOrEqual(2)
      let previous = -1
      for (const entry of song.entries) {
        expect(entry.at, song.slug).toBeGreaterThan(previous)
        expect(entry.from).toBeLessThan(entry.at)
        expect(entry.until).toBeGreaterThan(entry.at)
        // A sung note, in a voice's range.
        expect(entry.midi).toBeGreaterThanOrEqual(40)
        expect(entry.midi).toBeLessThanOrEqual(84)
        // Beats lead in: four, in order, all before the entry, or none.
        expect([0, 4]).toContain(entry.beats.length)
        for (const [i, beat] of entry.beats.entries()) {
          expect(beat).toBeLessThan(entry.at)
          expect(beat).toBeGreaterThanOrEqual(entry.from)
          if (i > 0) expect(beat).toBeGreaterThan(entry.beats[i - 1])
        }
        previous = entry.at
      }
    }
  })
})
