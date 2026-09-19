// Reading a lyrics file into the demo song form.
//
// The file is never uploaded — its text goes into the row, which is what
// lets an .lrc reach a singer without an R2 round trip. Two things have to
// hold: a bad file must return an error rather than throw (the author is
// mid-form and an exception would cost them every other field), and the
// reported format must match what the RUNTIME will do with the text, not
// what the filename claims.

import { describe, expect, it } from 'vitest'
import { describeLyricsFile, readLyricsFile, } from '@/features/admin/demo-song-admin-service'
import { parseLrcTimingMetadata, withLrcTimingMetadata, } from '@/lib/lrc-timing-metadata'
import { serialiseLyricsfile } from '@/lib/lyricsfile'

const file = (name: string, body: string): File =>
  new File([body], name, { type: 'text/plain' })

const TIMED = '[00:12.30]The first line\n[00:15.10]The second'
const PLAIN = 'The first line\nThe second'

describe('readLyricsFile', () => {
  it('reads a plain .txt', async () => {
    const read = await readLyricsFile(file('words.txt', PLAIN))
    expect(read).toEqual({ ok: true, text: PLAIN, format: 'txt' })
  })

  it('reads a timed .lrc', async () => {
    const read = await readLyricsFile(file('words.lrc', TIMED))
    expect(read).toEqual({ ok: true, text: TIMED, format: 'lrc' })
  })

  it('calls a .lrc without timestamps plain text', async () => {
    // The runtime infers sync from [mm:ss stamps, so the studio must not
    // promise a sync the singer will never get.
    const read = await readLyricsFile(file('stripped.lrc', PLAIN))
    expect(read).toMatchObject({ ok: true, format: 'txt' })
  })

  it('calls a .txt with timestamps timed', async () => {
    const read = await readLyricsFile(file('timed.txt', TIMED))
    expect(read).toMatchObject({ ok: true, format: 'lrc' })
  })

  it('accepts an uppercase extension', async () => {
    await expect(
      readLyricsFile(file('WORDS.LRC', TIMED)),
    ).resolves.toMatchObject({ ok: true })
  })

  it('refuses anything that is not a lyrics file', async () => {
    for (const name of ['track.mp3', 'lyrics.pdf', 'noextension']) {
      const read = await readLyricsFile(file(name, PLAIN))
      expect(read.ok).toBe(false)
    }
  })

  it('refuses an empty or whitespace-only file', async () => {
    expect((await readLyricsFile(file('a.txt', ''))).ok).toBe(false)
    expect((await readLyricsFile(file('b.lrc', '   \n  '))).ok).toBe(false)
  })

  it('returns an error rather than throwing, so the form survives', async () => {
    // Every failure path resolves; nothing here should reject.
    await expect(readLyricsFile(file('x.mp3', PLAIN))).resolves.toMatchObject({
      ok: false,
    })
  })
})

// ── A mapping with word ends, through either format ─────────────────
//
// One stored text, whichever file the author has to hand. The singer's
// mixer derives both downloads from what it loaded, so the studio keeps a
// single copy and converts on the way in.

/** Second line: every word timed, one end marked, one word split. */
function mappedEnds(): number[] {
  const ends: number[] = []
  ends[2] = 5.2
  return ends
}

const MAPPED = {
  lines: [
    { time: 1, text: 'Lantern under water' },
    { time: 3, text: 'Paper boats go over' },
  ],
  wordTimings: { 0: [1, 1.4, 1.9], 1: [3, 3.5, 4.1, 4.6] },
  wordEndTimings: { 1: mappedEnds() },
  wordSweepTimings: { 1: { 2: [{ time: 4.6, progress: 0.5 }] } },
}

describe('readLyricsFile — word ends and splits', () => {
  it('turns a .lyricsfile into timed LRC that still carries them', async () => {
    const read = await readLyricsFile(
      file('boats.lyricsfile', serialiseLyricsfile(MAPPED)),
    )
    if (!read.ok) throw new Error(read.error)

    expect(read.format).toBe('lrc')
    expect(read.timing).toEqual({ wordEnds: 1, splits: 1 })
    expect(read.text).toContain('[00:03.00] Paper [00:03.50] boats')
    // Not just counted: the ends the singer's mixer will read are the ones
    // that were authored, on the word they were authored on.
    const back = parseLrcTimingMetadata(read.text)
    expect(back?.wordEndTimings[1][2]).toBe(5.2)
    expect(0 in (back?.wordEndTimings[1] ?? [])).toBe(false)
    expect(back?.wordSweepTimings[1][2]).toEqual([{ time: 4.6, progress: 0.5 }])
  })

  it('refuses a .lyricsfile that is not one, and keeps the form', async () => {
    for (const body of ['just some words', 'lines: "no"', '{ : : ']) {
      await expect(
        readLyricsFile(file('broken.lyricsfile', body)),
      ).resolves.toEqual({
        ok: false,
        error: 'That is not a valid .lyricsfile.',
      })
    }
  })

  it('counts what an exported .lrc carries in its timing tag', async () => {
    const lrc = withLrcTimingMetadata(TIMED, {
      wordEndTimings: MAPPED.wordEndTimings,
      wordSweepTimings: {},
    })
    const read = await readLyricsFile(file('exported.lrc', lrc))
    expect(read).toEqual({
      ok: true,
      text: lrc,
      format: 'lrc',
      timing: { wordEnds: 1, splits: 0 },
    })
  })

  it('says so when the tag is there but cannot be read', async () => {
    const lrc = `[x-mp-timing:bm90IGpzb24=]\n${TIMED}`
    const read = await readLyricsFile(file('damaged.lrc', lrc))
    // Still loaded: the lyrics are fine, only the ends are gone.
    expect(read).toEqual({
      ok: true,
      text: lrc,
      format: 'lrc',
      timingUnreadable: true,
    })
  })
})

describe('describeLyricsFile', () => {
  const ok = (extra: object) =>
    ({ ok: true, text: TIMED, format: 'lrc', ...extra }) as const

  it('describes a plain and a timed file as before', () => {
    expect(
      describeLyricsFile('w.txt', { ok: true, text: PLAIN, format: 'txt' }),
    ).toBe('Loaded w.txt — 2 lines, plain text. Save to publish it.')
    expect(describeLyricsFile('w.lrc', ok({}))).toBe(
      'Loaded w.lrc — 2 lines, timed. Save to publish it.',
    )
  })

  it('names what the timing tag holds, and does not count it as a line', () => {
    const text = `[x-mp-timing:abcd]\n${TIMED}`
    expect(
      describeLyricsFile('w.lrc', {
        ok: true,
        text,
        format: 'lrc',
        timing: { wordEnds: 2, splits: 1 },
      }),
    ).toBe(
      'Loaded w.lrc — 2 lines, timed, with 2 word ends and 1 split word. Save to publish it.',
    )
    expect(
      describeLyricsFile('w.lrc', ok({ timing: { wordEnds: 1, splits: 0 } })),
    ).toBe(
      'Loaded w.lrc — 2 lines, timed, with 1 word end. Save to publish it.',
    )
  })

  it('warns about a tag it could not read', () => {
    expect(describeLyricsFile('w.lrc', ok({ timingUnreadable: true }))).toBe(
      'Loaded w.lrc — 2 lines, timed. Its timing tag could not be read, so the word ends in it will be ignored. Save to publish it.',
    )
  })
})
