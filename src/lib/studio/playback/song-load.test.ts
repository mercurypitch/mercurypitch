// Studio song load tests — a song's heard lanes, what they cost per tier, and how that matches the measured renders.
import { describe, expect, it } from 'vitest'
import { PLAYBACK_TIERS } from './playback-quality'
import { LARGE_SONG, MEDIUM_SONG, roleSong, SMALL_SONG, THIS_DESKTOP_US, } from './song.test-fixtures'
import { songCostInVoiceChains, studioSongChains } from './song-load'

const cost = (
  song: ReturnType<typeof roleSong>,
  tier: (typeof PLAYBACK_TIERS)[number],
) => songCostInVoiceChains(studioSongChains(song), tier)

describe("a song's heard lanes", () => {
  it('leave out muted and soloed-out lanes, and lanes without clips', () => {
    const song = roleSong(SMALL_SONG, [1])
    expect(studioSongChains(song)).toHaveLength(3)
    const soloed = {
      ...song,
      tracks: song.tracks.map((track, index) => ({
        ...track,
        solo: index === 0,
      })),
    }
    expect(studioSongChains(soloed)).toHaveLength(1)
    expect(studioSongChains({ ...song, clips: [] })).toHaveLength(0)
    // Nothing heard costs what the master and realtime playback cost alone.
    expect(cost(roleSong(SMALL_SONG, [0, 1, 2, 3]), 'best')).toBe(
      songCostInVoiceChains([], 'best'),
    )
  })
})

describe('what a song costs', () => {
  it('costs less at each lower tier', () => {
    for (const roles of [SMALL_SONG, MEDIUM_SONG, LARGE_SONG]) {
      const song = roleSong(roles)
      expect(cost(song, 'balanced')).toBeLessThan(cost(song, 'best'))
      expect(cost(song, 'light')).toBeLessThan(cost(song, 'balanced'))
    }
  })

  it('pays for each shared space once, and keeps a ducked reverb on its lane', () => {
    const one = roleSong(['acoustic-guitar'])
    const two = roleSong(['acoustic-guitar', 'acoustic-guitar'])
    const lane = cost(two, 'balanced') - cost(one, 'balanced')
    // The second guitar sends to the hall the first opened: less than the first cost.
    expect(lane).toBeLessThan(
      cost(one, 'balanced') - songCostInVoiceChains([], 'balanced'),
    )
    // At Best each guitar convolves on its own lane.
    expect(cost(two, 'best') - cost(one, 'best')).toBeCloseTo(
      cost(one, 'best') - songCostInVoiceChains([], 'best'),
    )
    // The voice's reverb is ducked, so it stays on its lane at every tier: a
    // second voice costs what the first did.
    const voices = (count: number) => roleSong(Array(count).fill('voice'))
    expect(
      cost(voices(2), 'balanced') - cost(voices(1), 'balanced'),
    ).toBeCloseTo(
      cost(voices(1), 'balanced') - songCostInVoiceChains([], 'balanced'),
    )
  })

  it("adds up to the profiling fixtures' measured offline cost within 10 %", () => {
    // Lanes only (each fixture less the same song with every lane muted), in
    // us per 128 frames: headless Chromium 148 on the desktop whose voice
    // chain read THIS_DESKTOP_US (evidence: auto-song-kind-costs.json).
    const measured = {
      small: {
        roles: SMALL_SONG,
        us: { best: 523.6, balanced: 501.3, light: 402.4 },
      },
      medium: {
        roles: MEDIUM_SONG,
        us: { best: 1384.9, balanced: 1109.9, light: 866.9 },
      },
      large: {
        roles: LARGE_SONG,
        us: { best: 3088.3, balanced: 2229.6, light: 1717.5 },
      },
    }
    for (const { roles, us } of Object.values(measured))
      for (const tier of PLAYBACK_TIERS) {
        const lanes =
          cost(roleSong(roles), tier) - songCostInVoiceChains([], tier)
        expect(Math.abs((lanes * THIS_DESKTOP_US) / us[tier] - 1)).toBeLessThan(
          0.1,
        )
      }
  })
})
