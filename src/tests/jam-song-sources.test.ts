// ── Song source tests ─────────────────────────────────────────────────
// Only songs every peer can FETCH belong in a room. These pin the LRC
// conversion and the refusal to build a song with nothing to sing over.

import { describe, expect, it } from 'vitest'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { lineAt } from '@/lib/jam/jam-song'
import { demoSongToJamSong, lrcToSongLines, stripWordTimings, } from '@/lib/jam/jam-song-sources'

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

describe('stripWordTimings', () => {
  it('removes enhanced-LRC word times a singer should not be reading', () => {
    // The A2 format embeds per-word times INSIDE the line; parseLrcFile
    // only pulls off the leading line timestamp, so these arrived on
    // screen as text.
    expect(
      stripWordTimings('Lay, [00:18.87] and [00:19.07] put [00:19.23] your'),
    ).toBe('Lay, and put your')
  })

  it('handles the angle-bracket spelling the spec prescribes', () => {
    expect(stripWordTimings('Yeah, <00:24.21> I <00:24.41> will')).toBe(
      'Yeah, I will',
    )
  })

  it('leaves a plain line completely alone', () => {
    expect(stripWordTimings('just some words')).toBe('just some words')
  })

  it('does not eat square brackets that are not times', () => {
    expect(stripWordTimings('[chorus] sing it')).toBe('[chorus] sing it')
  })

  it('collapses the gap a stripped stamp leaves behind', () => {
    expect(stripWordTimings('a [00:01.00] b')).toBe('a b')
  })

  it('drops a line that was nothing but timings', () => {
    expect(
      lrcToSongLines([{ time: 0, text: '[00:01.00] [00:02.00]' }]),
    ).toEqual([])
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
