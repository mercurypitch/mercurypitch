// ── Song source tests ─────────────────────────────────────────────────
// Only songs every peer can FETCH belong in a room. These pin the LRC
// conversion and the refusal to build a song with nothing to sing over.

import { describe, expect, it } from 'vitest'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { lineAt } from '@/lib/jam/jam-song'
import { demoSongToJamSong, lrcToSongLines } from '@/lib/jam/jam-song-sources'

const manifest = (over: Partial<DemoSongManifest> = {}) =>
  ({
    title: 'Demo Song',
    artist: 'Someone',
    attribution: { text: '', url: '', license: '', licenseUrl: '' },
    stems: {
      instrumental: 'https://r2.test/inst.mp3',
      vocal: 'https://r2.test/vox.mp3',
    },
    durationSec: 210,
    ...over,
  }) as DemoSongManifest

describe('lrcToSongLines', () => {
  it('carries text and start time across', () => {
    const out = lrcToSongLines([
      { time: 0, text: 'one' },
      { time: 4, text: 'two' },
    ])
    expect(out[0]).toMatchObject({ text: 'one', startSec: 0 })
  })

  it('ends each line where the next begins', () => {
    // An LRC carries starts only; filling the end lets a caller measure a
    // line without having to look at its neighbour.
    const out = lrcToSongLines([
      { time: 0, text: 'one' },
      { time: 4, text: 'two' },
    ])
    expect(out[0]!.endSec).toBe(4)
    expect(out[1]!.endSec).toBeUndefined() // last line runs to the end
  })

  it('drops blank lines rather than showing empty rows', () => {
    const out = lrcToSongLines([
      { time: 0, text: 'one' },
      { time: 2, text: '   ' },
      { time: 4, text: 'two' },
    ])
    expect(out.map((l) => l.text)).toEqual(['one', 'two'])
  })

  it('produces lines the room can actually look up', () => {
    const out = lrcToSongLines([
      { time: 0, text: 'one' },
      { time: 4, text: 'two' },
    ])
    expect(lineAt(out, 5)?.text).toBe('two')
  })

  it('survives an empty lyric sheet', () => {
    expect(lrcToSongLines([])).toEqual([])
  })
})

describe('demoSongToJamSong', () => {
  it('builds a fetchable song from the manifest', () => {
    const s = demoSongToJamSong(manifest())
    expect(s?.origin).toBe('url')
    expect(s?.stems.instrumental).toBe('https://r2.test/inst.mp3')
    expect(s?.stems.vocal).toBe('https://r2.test/vox.mp3')
    expect(s?.title).toBe('Demo Song')
  })

  it('refuses a manifest with nothing to sing over', () => {
    // A room loading it would be silent with no explanation.
    expect(demoSongToJamSong(manifest({ stems: {} }))).toBeNull()
    expect(
      demoSongToJamSong(manifest({ stems: { instrumental: '' } })),
    ).toBeNull()
    expect(demoSongToJamSong(null)).toBeNull()
  })

  it('accepts an instrumental with no guide vocal', () => {
    const s = demoSongToJamSong(
      manifest({ stems: { instrumental: 'https://r2.test/inst.mp3' } }),
    )
    expect(s).not.toBeNull()
    expect(s?.stems.vocal).toBeUndefined()
  })

  it('tolerates a manifest with no duration', () => {
    // The audio element knows the real one once it loads.
    const s = demoSongToJamSong(manifest({ durationSec: undefined }))
    expect(s?.durationSec).toBe(0)
  })
})
