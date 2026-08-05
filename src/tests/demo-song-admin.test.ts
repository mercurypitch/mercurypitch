// Reading a lyrics file into the demo song form.
//
// The file is never uploaded — its text goes into the row, which is what
// lets an .lrc reach a singer without an R2 round trip. Two things have to
// hold: a bad file must return an error rather than throw (the author is
// mid-form and an exception would cost them every other field), and the
// reported format must match what the RUNTIME will do with the text, not
// what the filename claims.

import { describe, expect, it } from 'vitest'
import { readLyricsFile } from '@/features/admin/demo-song-admin-service'

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

  it('refuses anything that is not .lrc or .txt', async () => {
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
