import { describe, expect, it } from 'vitest'
import { KARAOKE_NIGHT_PATH, karaokeNightPlaylistUrl, karaokeNightSessionUrl, karaokeNightSongUrl, mixerKaraokeNightUrl, parseKaraokeNightLaunch, studioSessionUrl, takeScannedSyncLink, } from '@/lib/karaoke-night-link'

describe('karaoke-night-link', () => {
  // REQ-SKL-001 & REQ-SKL-006: karaokeNightSessionUrl
  it('builds Karaoke Night session URL (SK-LINK-1, SK-LINK-6)', () => {
    expect(karaokeNightSessionUrl('session-123')).toBe(
      `${KARAOKE_NIGHT_PATH}?session=session-123`,
    )
    expect(karaokeNightSessionUrl('demo/test 1')).toBe(
      `${KARAOKE_NIGHT_PATH}?session=demo%2Ftest%201`,
    )
  })

  // REQ-SKL-014: the mixer's Open in Karaoke Night
  it('opens the mixer’s song on the stage, paused where it is (REQ-SKL-014)', () => {
    expect(mixerKaraokeNightUrl('session-123', { startAtSec: 83.24 })).toBe(
      `${KARAOKE_NIGHT_PATH}?session=session-123&t=83.2`,
    )
    expect(mixerKaraokeNightUrl('session-123')).toBe(
      `${KARAOKE_NIGHT_PATH}?session=session-123`,
    )
    // Never autoplay: a browser may refuse it after a page load.
    expect(
      mixerKaraokeNightUrl('session-123', { startAtSec: 5 }),
    ).not.toContain('autoplay')
    // The start of the song needs no position.
    expect(mixerKaraokeNightUrl('session-123', { startAtSec: 0 })).toBe(
      `${KARAOKE_NIGHT_PATH}?session=session-123`,
    )
  })

  it('opens an example by its song link, which keeps what the visitor replaced (REQ-SKL-014)', () => {
    expect(
      mixerKaraokeNightUrl('karaoke-night-demo:nothing-in-the-dark', {
        startAtSec: 12,
      }),
    ).toBe(`${KARAOKE_NIGHT_PATH}?song=nothing-in-the-dark&t=12`)
    // The original demo's own id names the legacy slug, which the page
    // reads and rewrites to the song's link slug.
    expect(mixerKaraokeNightUrl('karaoke-night-demo')).toBe(
      `${KARAOKE_NIGHT_PATH}?song=karaoke-night`,
    )
  })

  // REQ-SKL-005: studioSessionUrl
  it('builds studio session URL for active song (SK-LINK-5)', () => {
    expect(studioSessionUrl('session-123')).toBe(
      '/#/karaoke/session/session-123/mixer',
    )
    expect(studioSessionUrl('karaoke-night-demo')).toBe(
      '/#/karaoke/session/karaoke-night-demo/mixer',
    )
  })

  it('falls back to bare studio route when no session is provided (SK-LINK-5)', () => {
    expect(studioSessionUrl(null)).toBe('/#/karaoke')
    expect(studioSessionUrl(undefined)).toBe('/#/karaoke')
    expect(studioSessionUrl('')).toBe('/#/karaoke')
  })

  it('builds Karaoke Night playlist URL', () => {
    expect(karaokeNightPlaylistUrl('playlist-99')).toBe(
      `${KARAOKE_NIGHT_PATH}?playlist=playlist-99`,
    )
  })

  it('carries the launch contract: start position and autoplay', () => {
    expect(
      karaokeNightSessionUrl('s-1', { startAtSec: 101.52, autoplay: true }),
    ).toBe(`${KARAOKE_NIGHT_PATH}?session=s-1&t=101.5&autoplay=1`)
    expect(karaokeNightSessionUrl('s-1', { startAtSec: 0 })).toBe(
      `${KARAOKE_NIGHT_PATH}?session=s-1&t=0`,
    )
    // Negative and non-finite offsets never leak into the URL.
    expect(karaokeNightSessionUrl('s-1', { startAtSec: -3 })).toBe(
      `${KARAOKE_NIGHT_PATH}?session=s-1&t=0`,
    )
    expect(karaokeNightSessionUrl('s-1', { startAtSec: Number.NaN })).toBe(
      `${KARAOKE_NIGHT_PATH}?session=s-1`,
    )
    expect(karaokeNightSessionUrl('s-1', { autoplay: false })).toBe(
      `${KARAOKE_NIGHT_PATH}?session=s-1`,
    )
  })

  it('parses the launch contract back from a query string', () => {
    const launch = parseKaraokeNightLaunch('?session=s-1&t=101.5&autoplay=1')
    expect(launch).toEqual({
      sessionId: 's-1',
      startAtSec: 101.5,
      autoplay: true,
      song: null,
      zen: false,
    })
  })

  it('round-trips what it builds', () => {
    const url = karaokeNightSessionUrl('demo/test 1', {
      startAtSec: 62.3,
      autoplay: true,
    })
    const launch = parseKaraokeNightLaunch(url.split('?')[1])
    expect(launch).toEqual({
      sessionId: 'demo/test 1',
      startAtSec: 62.3,
      autoplay: true,
      song: null,
      zen: false,
    })
  })

  it('rejects malformed launch params instead of guessing', () => {
    expect(parseKaraokeNightLaunch('?session=s-1&t=abc&autoplay=yes')).toEqual({
      sessionId: 's-1',
      startAtSec: null,
      autoplay: false,
      song: null,
      zen: false,
    })
    expect(parseKaraokeNightLaunch('?session=s-1&t=-5')).toEqual({
      sessionId: 's-1',
      startAtSec: null,
      autoplay: false,
      song: null,
      zen: false,
    })
    expect(parseKaraokeNightLaunch('')).toEqual({
      sessionId: null,
      startAtSec: null,
      autoplay: false,
      song: null,
      zen: false,
    })
    // `autoplay=true` from a hand-typed link still counts.
    expect(parseKaraokeNightLaunch('?autoplay=true').autoplay).toBe(true)
  })

  // REQ-SKL-012: a song link names an example by its slug.
  describe('song links', () => {
    it('builds the readable link, with and without zen', () => {
      expect(karaokeNightSongUrl('nothing-in-the-dark')).toBe(
        `${KARAOKE_NIGHT_PATH}?song=nothing-in-the-dark`,
      )
      expect(karaokeNightSongUrl('goodbye-to-spring', { zen: true })).toBe(
        `${KARAOKE_NIGHT_PATH}?song=goodbye-to-spring&zen=1`,
      )
      expect(karaokeNightSongUrl('josephine', { zen: false })).toBe(
        `${KARAOKE_NIGHT_PATH}?song=josephine`,
      )
    })

    it('parses the slug the way the studio stores one', () => {
      expect(parseKaraokeNightLaunch('?song=nothing-in-the-dark').song).toBe(
        'nothing-in-the-dark',
      )
      // Typed by hand or mangled by a chat app: case and padding forgiven.
      expect(parseKaraokeNightLaunch('?song=%20Josephine%20').song).toBe(
        'josephine',
      )
    })

    it('reads a malformed or missing slug as no song', () => {
      for (const query of [
        '',
        '?song=',
        '?song=%20%20',
        '?song=no%20spaces',
        '?song=karaoke-night-demo%3Ajosephine',
        '?song=--',
        `?song=${'a'.repeat(65)}`,
      ])
        expect(parseKaraokeNightLaunch(query).song, query).toBeNull()
    })

    it('round-trips what it builds', () => {
      const url = karaokeNightSongUrl('nothing-in-the-dark', { zen: true })
      expect(parseKaraokeNightLaunch(url.split('?')[1])).toEqual({
        sessionId: null,
        startAtSec: null,
        autoplay: false,
        song: 'nothing-in-the-dark',
        zen: true,
      })
    })

    it('keeps session and song apart when a link carries both', () => {
      const launch = parseKaraokeNightLaunch('?session=s-1&song=josephine')
      expect(launch.sessionId).toBe('s-1')
      expect(launch.song).toBe('josephine')
    })
  })

  // REQ-SKL-013: zen=1 asks for the zen stage.
  describe('zen', () => {
    it('is on for 1, true and a bare flag', () => {
      for (const query of ['?zen=1', '?zen=true', '?zen', '?zen='])
        expect(parseKaraokeNightLaunch(query).zen, query).toBe(true)
    })

    it('is off when absent or anything else', () => {
      for (const query of ['', '?zen=0', '?zen=false', '?zen=no', '?zenith=1'])
        expect(parseKaraokeNightLaunch(query).zen, query).toBe(false)
    })
  })

  // REQ-SKL-011: the page catches its own scanned link — and CONSUMES it,
  // so a reload, tab restore, or rail collapse/expand cannot re-join a
  // session the person already finished.
  describe('takeScannedSyncLink', () => {
    it('hands back the code once and eats the hash', () => {
      window.location.hash = '#/sync:abcd2345'
      try {
        expect(takeScannedSyncLink()).toBe('ABCD2345')
        expect(window.location.hash).toBe('')
        // The second boot of the same URL has nothing left to act on.
        expect(takeScannedSyncLink()).toBeNull()
      } finally {
        window.location.hash = ''
      }
    })

    it('leaves an unrelated hash alone', () => {
      window.location.hash = '#/karaoke'
      try {
        expect(takeScannedSyncLink()).toBeNull()
        expect(window.location.hash).toBe('#/karaoke')
      } finally {
        window.location.hash = ''
      }
    })

    it('refuses a mangled code without consuming anything', () => {
      window.location.hash = '#/sync:zz'
      try {
        expect(takeScannedSyncLink()).toBeNull()
        expect(window.location.hash).toBe('#/sync:zz')
      } finally {
        window.location.hash = ''
      }
    })
  })
})
