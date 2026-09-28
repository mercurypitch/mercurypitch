// The code a free song's email record keeps (free-song-email.ts): the same
// for an address however it is typed, another for another address, month or
// key, and none at all without a key worth having.
// node-tests/free-song-email-integration.test.ts runs it through the
// worker, with every migration applied.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { freeSongEmailCode } from './free-song-email'

const KEY = { FREE_SONG_EMAIL_SECRET: 'free-song-email-test-key-0123456789' }
const OTHER_KEY = {
  FREE_SONG_EMAIL_SECRET: 'another-free-song-email-key-9876543210',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('an email’s code', () => {
  it('is the same for the address however it is typed', async () => {
    const plain = await freeSongEmailCode(KEY, 'singer@example.com', '2026-10')

    for (const typed of [
      'Singer@Example.com',
      '  singer@example.com',
      'SINGER@EXAMPLE.COM\n',
    ]) {
      expect(await freeSongEmailCode(KEY, typed, '2026-10'), typed).toBe(plain)
    }
    expect(plain).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is another code for another address, month or key', async () => {
    const codes = await Promise.all([
      freeSongEmailCode(KEY, 'singer@example.com', '2026-10'),
      freeSongEmailCode(KEY, 'another.singer@example.com', '2026-10'),
      freeSongEmailCode(KEY, 'singer@example.com', '2026-11'),
      freeSongEmailCode(OTHER_KEY, 'singer@example.com', '2026-10'),
    ])

    expect(codes).not.toContain(null)
    expect(new Set(codes).size).toBe(4)
  })
})

describe('without a key worth having', () => {
  it('is no code, and the log says so once', async () => {
    // The warning is once per isolate: a fresh copy of the module starts
    // where a new isolate does, whatever ran before this test.
    vi.resetModules()
    const fresh = (await import('./free-song-email')).freeSongEmailCode
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const codes = [
      await fresh({}, 'singer@example.com', '2026-10'),
      await fresh(
        { FREE_SONG_EMAIL_SECRET: '' },
        'singer@example.com',
        '2026-10',
      ),
      await fresh(
        { FREE_SONG_EMAIL_SECRET: 'x'.repeat(31) },
        'singer@example.com',
        '2026-10',
      ),
    ]

    expect(codes).toEqual([null, null, null])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('FREE_SONG_EMAIL_SECRET')
  })

  it('takes a key of 32 bytes', async () => {
    const code = await freeSongEmailCode(
      { FREE_SONG_EMAIL_SECRET: 'x'.repeat(32) },
      'singer@example.com',
      '2026-10',
    )

    expect(code).not.toBeNull()
  })
})
