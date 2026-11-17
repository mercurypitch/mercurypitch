// Studio song load tests — a song's heard lanes and its monitored ones, what they cost per tier, and how that matches the measured renders.
import { describe, expect, it } from 'vitest'
import type { StudioLiteEffect } from '@/lib/studio-fx/fx-profile'
import type { TrackRole } from '@/lib/studio-fx/role-chains'
import { PLAYBACK_TIERS, TIER_PROFILES } from './playback-quality'
import { LARGE_SONG, MEDIUM_SONG, roleSong, SMALL_SONG, THIS_DESKTOP_US, } from './song.test-fixtures'
import { LANE_HOLD_COST, monitorCostInVoiceChains, songCostInVoiceChains, songLoad, studioSongChains, } from './song-load'

const cost = (
  song: ReturnType<typeof roleSong>,
  tier: (typeof PLAYBACK_TIERS)[number],
) => songCostInVoiceChains(studioSongChains(song), tier)

/** A new lane of `role`: its chain as its clips play it, and its monitor. */
const chainOf = (role: TrackRole) => studioSongChains(roleSong([role]))[0]
/** What Light's monitor passes uncut. */
const LIGHT_LITE = TIER_PROFILES.light.lite

/** One monitored lane of `role` beside another, master aside: what the lane itself costs. */
function monitoredLane(
  role: TrackRole,
  lite: readonly StudioLiteEffect[],
): number {
  const chain = chainOf(role)
  return (
    monitorCostInVoiceChains([chain, chain], lite) -
    monitorCostInVoiceChains([chain], lite)
  )
}

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
    // chain read THIS_DESKTOP_US (evidence: auto-song-kind-costs.json). Read
    // before lanes were held at two channels, so their holds are left out.
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
          cost(roleSong(roles), tier) -
          songCostInVoiceChains([], tier) -
          roles.length * LANE_HOLD_COST
        expect(Math.abs((lanes * THIS_DESKTOP_US) / us[tier] - 1)).toBeLessThan(
          0.1,
        )
      }
  })
})

describe('what monitored lanes cost', () => {
  it("costs nothing with no lane monitored, and pays for the monitor's master once however many are", () => {
    const voice = chainOf('voice')
    const one = monitorCostInVoiceChains([voice], [])
    const lane = monitoredLane('voice', [])

    expect(monitorCostInVoiceChains([], [])).toBe(0)
    expect(monitorCostInVoiceChains([voice, voice, voice], [])).toBeCloseTo(
      one + 2 * lane,
    )
    // The master is the song's, at the monitor's profile: about a quarter
    // of a voice chain.
    expect(one - lane).toBeGreaterThan(0.2)
  })

  it("weighs a lane as the tier's monitor plays it: on Light its de-esser and dynamic EQ are a wire", () => {
    // The lead vocal's four dynamic EQ bands are most of its chain's work.
    expect(monitoredLane('voice', LIGHT_LITE)).toBeLessThan(
      monitoredLane('voice', []) - 0.25,
    )
    // The bass has neither, and costs the same on Light.
    expect(monitoredLane('bass', LIGHT_LITE)).toBe(monitoredLane('bass', []))
  })

  it("adds to a song's load on the audio thread it shares with playback", () => {
    const chains = studioSongChains(roleSong(SMALL_SONG))
    const voice = chainOf('voice')
    for (const tier of PLAYBACK_TIERS) {
      const lite = TIER_PROFILES[tier].lite
      const added =
        songLoad(chains, tier, THIS_DESKTOP_US, { chains: [voice], lite }) -
        songLoad(chains, tier, THIS_DESKTOP_US)
      expect(added).toBeCloseTo(
        (monitorCostInVoiceChains([voice], lite) * THIS_DESKTOP_US) /
          ((128 / 48000) * 1e6),
      )
    }
  })

  it("adds up to each role's whole monitored lane, as measured, within 10 %", () => {
    for (const [role, measured] of Object.entries(MEASURED_ROLES)) {
      const best = monitoredLane(role as TrackRole, [])
      expect(Math.abs(best / measured.best - 1)).toBeLessThan(0.1)
      if (measured.light === undefined) continue
      const light = monitoredLane(role as TrackRole, LIGHT_LITE)
      expect(Math.abs(light / measured.light - 1)).toBeLessThan(0.1)
    }
  })
})

/**
 * Each role's new lane monitored, in voice chains, as at Best and Balanced
 * and, for the roles with a de-esser or dynamic EQ, as on Light: six lanes
 * on one input against none, through a master with nothing in it, the
 * median of five runs. Headless Chromium 148 on the desktop whose voice
 * chain read THIS_DESKTOP_US on 30 Oct, 163.5 to 173.3 us on 17 Nov 2026
 * (studio-monitor-browser-probes.mjs `cost`; evidence:
 * monitor-lane-costs.json). One lane read up to 9 % apart from run to run.
 */
const MEASURED_ROLES: Readonly<
  Record<TrackRole, { readonly best: number; readonly light?: number }>
> = {
  voice: { best: 0.884, light: 0.595 },
  'backing-vocals': { best: 0.709, light: 0.55 },
  'acoustic-guitar': { best: 0.527, light: 0.47 },
  'electric-guitar': { best: 0.558, light: 0.464 },
  bass: { best: 0.22 },
  piano: { best: 0.497 },
  keys: { best: 0.638 },
  drums: { best: 0.762, light: 0.696 },
  backing: { best: 0.197 },
  other: { best: 0.423 },
}
