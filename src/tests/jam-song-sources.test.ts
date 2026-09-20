// ── Song source tests ─────────────────────────────────────────────────
// Only songs every peer can FETCH belong in a room. These pin the LRC
// conversion and the refusal to build a song with nothing to sing over.

import { describe, expect, it } from 'vitest'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { demoSessionId, isDemoSessionId, LEGACY_SLUG, } from '@/features/karaoke-night/demo-song'
import { lineAt } from '@/lib/jam/jam-song'
import { demoSongToJamSong, exampleSongId, isExampleSongId, jamSongSessionId, lrcTextToSongLines, lrcToSongLines, sessionToJamSong, stripWordTimings, } from '@/lib/jam/jam-song-sources'
import { withLrcTimingMetadata } from '@/lib/lrc-timing-metadata'

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

  it('gives every example its own id', () => {
    // One shared id meant a second example could not be told from the
    // first: same row marked as running, same pitch guide, same scores.
    expect(demoSongToJamSong(manifest({ slug: 'josephine' }))?.id).toBe(
      'karaoke-night-demo:josephine',
    )
    expect(demoSongToJamSong(manifest({ slug: LEGACY_SLUG }))?.id).toBe(
      'karaoke-night-demo',
    )
    expect(demoSongToJamSong(manifest({ slug: undefined }))?.id).toBe(
      'karaoke-night-demo',
    )
  })
})

describe('exampleSongId', () => {
  // The rule is demo-song's, spelled a second time so jam-song-sources can
  // stay in its own layer. Two spellings drifting apart would not throw: a
  // song's pitch guide would be saved under a session nothing else reads.
  it('is exactly the session id Karaoke Night stores the example under', () => {
    for (const slug of [undefined, '', '  ', LEGACY_SLUG, 'josephine', 'a:b']) {
      expect(exampleSongId(slug)).toBe(demoSessionId(slug))
    }
  })

  it('recognises the ids it mints, and only those', () => {
    for (const id of [
      'karaoke-night-demo',
      'karaoke-night-demo:josephine',
      'session:abc',
      'karaoke-night-demos',
      '',
    ]) {
      expect(isExampleSongId(id)).toBe(isDemoSessionId(id))
    }
  })
})

describe('sessionToJamSong', () => {
  it('is a song only this device holds, unless told otherwise', () => {
    const built = sessionToJamSong(
      { sessionId: 'abc', originalFile: { name: 'x.mp3' } },
      { instrumental: 'blob:i' },
    )
    expect(built?.origin).toBe('local')
  })

  it('can be a song every peer fetches, for an example sung from its row', () => {
    const built = sessionToJamSong(
      { sessionId: 'karaoke-night-demo:josephine' },
      { instrumental: 'https://stems.example/i.m4a' },
      [],
      0,
      [],
      'url',
    )
    expect(built?.origin).toBe('url')
  })
})

describe('jamSongSessionId', () => {
  it('finds the session behind a separated song', () => {
    expect(jamSongSessionId('session:9f2c')).toBe('9f2c')
  })

  it('finds an example, whose song id IS its session id', () => {
    expect(jamSongSessionId('karaoke-night-demo')).toBe('karaoke-night-demo')
    expect(jamSongSessionId('karaoke-night-demo:josephine')).toBe(
      'karaoke-night-demo:josephine',
    )
  })

  it('finds an example that was loaded from its library row', () => {
    expect(jamSongSessionId('session:karaoke-night-demo:josephine')).toBe(
      'karaoke-night-demo:josephine',
    )
  })

  it('agrees with the ids the builders actually mint', () => {
    // The one property that matters: whatever sessionToJamSong writes,
    // this reads back. A prefix changed in one place and not the other
    // would silently stop every local song being analysable.
    const built = sessionToJamSong(
      { sessionId: 'abc', originalFile: { name: 'x.mp3' } },
      { instrumental: 'blob:i' },
    )
    expect(jamSongSessionId(built!.id)).toBe('abc')
  })

  it('has nothing to offer for a song that carries its own notes', () => {
    for (const id of [
      '',
      'session:',
      'exercise:scale',
      'melody:7',
      'weekly',
      'karaoke-night-demos',
    ]) {
      expect(jamSongSessionId(id)).toBeNull()
    }
  })
})

describe('the words inside a line', () => {
  // They used to be scrubbed out of the text and thrown away, so a room lit
  // a whole line at once under a sheet somebody had mapped word by word.
  it('keeps each word and when it starts', () => {
    const [line] = lrcToSongLines([
      {
        time: 18.5,
        text: 'Lay, [00:18.87] and [00:19.07] put [00:19.23] your',
      },
    ])
    expect(line?.text).toBe('Lay, and put your')
    expect(line?.words).toEqual(['Lay,', 'and', 'put', 'your'])
    expect(line?.wordStartsSec).toEqual([18.5, 18.87, 19.07, 19.23])
  })

  it('reads the angle-bracket spelling the same way', () => {
    const [line] = lrcToSongLines([
      { time: 24, text: 'Yeah, <00:24.21> I <00:24.41> will' },
    ])
    expect(line?.text).toBe('Yeah, I will')
    expect(line?.words).toEqual(['Yeah,', 'I', 'will'])
    expect(line?.wordStartsSec).toEqual([24, 24.21, 24.41])
  })

  it('adds nothing to a line that was only ever timed as a line', () => {
    const [line] = lrcToSongLines([{ time: 3, text: 'just some words' }])
    expect(line).toEqual({ text: 'just some words', startSec: 3 })
  })

  it('always reads as the words joined, so a line never reflows when it lights', () => {
    const [line] = lrcToSongLines([
      { time: 0, text: 'two   spaces [00:01.00]   here' },
    ])
    expect(line?.text).toBe(line?.words?.join(' '))
  })

  it('looks a word end up by the line it was marked on, blank lines counted', () => {
    // The mixer keys ends by the line's index in the FILE. Line 1 here is
    // blank and is dropped from the sheet; the end marked on file line 2
    // must still land on the second line a singer sees.
    const out = lrcToSongLines(
      [
        { time: 0, text: 'one [00:01.00] two' },
        { time: 5, text: '' },
        { time: 10, text: 'three [00:11.00] four' },
      ],
      { 2: [undefined, 12.5] },
    )
    expect(out).toHaveLength(2)
    expect(out[0]?.wordEndsSec).toBeUndefined()
    expect(out[1]?.wordEndsSec).toEqual([null, 12.5])
  })

  it('writes an unmarked word as null, which is what JSON would make of it', () => {
    const sparse: number[] = []
    sparse[2] = 4.2
    const [line] = lrcToSongLines(
      [{ time: 0, text: 'a [00:01.00] b [00:02.00] c' }],
      { 0: sparse },
    )
    expect(line?.wordEndsSec).toEqual([null, null, 4.2])
    expect(JSON.parse(JSON.stringify(line))).toEqual(line)
  })

  it('keeps no ends for a line with no word starts to end', () => {
    const [line] = lrcToSongLines([{ time: 0, text: 'plain line' }], {
      0: [1, 2],
    })
    expect(line?.wordEndsSec).toBeUndefined()
  })
})

describe('lrcTextToSongLines', () => {
  const SHEET = ['[00:01.00]one [00:01.50]two', '[00:04.00]three', ''].join(
    '\n',
  )

  it('reads the word ends the app writes into its own exports', () => {
    const tagged = withLrcTimingMetadata(SHEET, {
      wordEndTimings: { 0: [1.4, 2.25] },
      wordSweepTimings: {},
    })
    const [first, second] = lrcTextToSongLines(tagged)
    expect(first?.words).toEqual(['one', 'two'])
    expect(first?.wordEndsSec).toEqual([1.4, 2.25])
    expect(second?.wordEndsSec).toBeUndefined()
    // The tag is a tag, not a lyric.
    expect(lrcTextToSongLines(tagged).map((l) => l.text)).toEqual([
      'one two',
      'three',
    ])
  })

  it("takes the caller's own map over the tag: a stored version has one", () => {
    const tagged = withLrcTimingMetadata(SHEET, {
      wordEndTimings: { 0: [1.4, 2.25] },
      wordSweepTimings: {},
    })
    const [first] = lrcTextToSongLines(tagged, { 0: [1.2] })
    expect(first?.wordEndsSec).toEqual([1.2])
  })

  it('is just the lines when there is nothing finer', () => {
    expect(lrcTextToSongLines('[00:01.00]plain\n[00:03.00]sheet\n')).toEqual([
      { text: 'plain', startSec: 1, endSec: 3 },
      { text: 'sheet', startSec: 3 },
    ])
  })
})
