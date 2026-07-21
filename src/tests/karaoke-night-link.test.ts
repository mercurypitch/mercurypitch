import { describe, expect, it } from 'vitest'
import { KARAOKE_NIGHT_PATH, karaokeNightPlaylistUrl, karaokeNightSessionUrl, studioSessionUrl, } from '@/lib/karaoke-night-link'

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
})
