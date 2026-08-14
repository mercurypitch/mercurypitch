import { describe, expect, it } from 'vitest'
import { KARAOKE_NIGHT_PATH, karaokeNightPlaylistUrl, karaokeNightSessionUrl, parseKaraokeNightLaunch, studioSessionUrl, } from '@/lib/karaoke-night-link'

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
    })
  })

  it('rejects malformed launch params instead of guessing', () => {
    expect(parseKaraokeNightLaunch('?session=s-1&t=abc&autoplay=yes')).toEqual({
      sessionId: 's-1',
      startAtSec: null,
      autoplay: false,
    })
    expect(parseKaraokeNightLaunch('?session=s-1&t=-5')).toEqual({
      sessionId: 's-1',
      startAtSec: null,
      autoplay: false,
    })
    expect(parseKaraokeNightLaunch('')).toEqual({
      sessionId: null,
      startAtSec: null,
      autoplay: false,
    })
    // `autoplay=true` from a hand-typed link still counts.
    expect(parseKaraokeNightLaunch('?autoplay=true').autoplay).toBe(true)
  })
})
