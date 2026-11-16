// Studio monitor sound — the armed lane's chain and faders as playback has them, silent where playback is silent and for a lane that left the song, a new voice lane for a take with no lane, the controls still moving, and nothing worked out while the lane is not monitored or no song is open; then playback's master at the gain the listener hears, every effect off but its loudness gain while what they hear has none, and while Compare plays, the gain of its side.
import { describe, expect, it } from 'vitest'
import { EMPTY_CHAIN } from '@/lib/studio-fx/chain-spec'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { NEUTRAL_MACROS } from '@/lib/studio-fx/mix-macros'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { studioLaneSpec } from '../model/arrangement-plan'
import { createStudioProject, createStudioTrack } from '../model/defaults'
import type { StudioProject } from '../model/types'
import { laneGains } from '../playback/graph-lanes'
import type { StudioLaneDraft } from '../playback/in-place'
import { studioMonitorMasterGain, studioMonitorMasterSpec, studioMonitorSound, } from './monitor-sound'

function song(): StudioProject {
  const project = createStudioProject({
    id: 'song-1',
    title: 'Song',
    now: '2026-11-05T12:00:00.000Z',
  })
  return {
    ...project,
    mix: { ...project.mix, macros: { ...NEUTRAL_MACROS, space: 40 } },
    tracks: [
      {
        ...createStudioTrack({
          id: 'voice',
          name: 'Voice',
          order: 0,
          role: 'voice',
        }),
        gainDb: -6,
        pan: 0.5,
      },
      createStudioTrack({
        id: 'guitar',
        name: 'Guitar',
        order: 1,
        role: 'acoustic-guitar',
      }),
    ],
  }
}

function moving(
  lanes: Record<string, StudioLaneDraft> = {},
  macros: Partial<Record<MacroKey, number>> = {},
) {
  return {
    lane: (trackId: string) => lanes[trackId],
    macro: (name: MacroKey) => macros[name],
  }
}

describe('the monitored sound of a lane', () => {
  it('is the lane as it plays: its chain under the song macros, then its faders', () => {
    const project = song()
    const voice = project.tracks[0]

    const sound = studioMonitorSound(project, 'voice', { on: true })

    expect(sound).toEqual({
      on: true,
      spec: studioLaneSpec(voice, project.mix.macros),
      gains: laneGains(voice),
    })
    expect(sound.gains[0]).toBeCloseTo(10 ** (-6 / 20) * Math.cos(Math.PI / 4))
    expect(sound.gains[1]).toBeCloseTo(10 ** (-6 / 20))
  })

  it('is silent where playback is: a muted lane, and a lane outside a Solo', () => {
    const project = song()
    const muted = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === 'voice' ? { ...track, mute: true } : track,
      ),
    }
    const soloedElsewhere = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === 'guitar' ? { ...track, solo: true } : track,
      ),
    }
    const soloed = {
      ...project,
      tracks: project.tracks.map((track) => ({ ...track, solo: true })),
    }

    expect(studioMonitorSound(muted, 'voice', { on: true }).gains).toEqual([
      0, 0,
    ])
    expect(
      studioMonitorSound(soloedElsewhere, 'voice', { on: true }).gains,
    ).toEqual([0, 0])
    expect(studioMonitorSound(soloed, 'voice', { on: true }).gains).toEqual(
      laneGains(project.tracks[0]),
    )
  })

  it('sounds as the new voice lane a take with no lane starts', () => {
    const project = song()
    const lane = createStudioTrack({
      id: 'take',
      name: 'Take',
      order: 0,
      role: 'voice',
    })

    const sound = studioMonitorSound(project, null, { on: true })

    expect(sound).toEqual({
      on: true,
      spec: studioLaneSpec(lane, project.mix.macros),
      gains: [1, 1],
    })
  })

  it('is silent for a lane that has left the song, which disarms', () => {
    expect(studioMonitorSound(song(), 'removed', { on: true })).toEqual({
      on: false,
      spec: EMPTY_CHAIN,
      gains: [0, 0],
    })
  })

  it('hears the armed lane fader and every macro while they still move, and no other lane draft', () => {
    const project = song()
    const voice = project.tracks[0]

    const sound = studioMonitorSound(project, 'voice', {
      on: true,
      moving: moving(
        { voice: { gainDb: 0, pan: 0 }, guitar: { gainDb: -20 } },
        { space: 80 },
      ),
    })

    expect(sound.gains).toEqual([1, 1])
    expect(sound.spec).toEqual(
      studioLaneSpec(voice, { ...project.mix.macros, space: 80 }),
    )
    expect(sound.spec).not.toEqual(studioLaneSpec(voice, project.mix.macros))
  })

  it('is silent, with no chain worked out, while the lane is not monitored or no song is open', () => {
    const silent = { on: false, spec: EMPTY_CHAIN, gains: [0, 0] }
    expect(studioMonitorSound(song(), 'voice', { on: false })).toEqual(silent)
    expect(studioMonitorSound(null, 'voice', { on: true })).toEqual(silent)
  })
})

describe('the master the monitored inputs play through', () => {
  const heardAt = { gainDb: 6, safetyGainDb: -1 }

  it("is playback's master: the song's, its macros still moving, at the master gain the listener hears", () => {
    const project = song()

    const spec = studioMonitorMasterSpec(project, heardAt, {
      moving: moving({ voice: { gainDb: -20 } }, { warmth: 90 }),
    })

    const sounding = {
      ...project,
      mix: { ...project.mix, macros: { ...project.mix.macros, warmth: 90 } },
    }
    expect(spec).toEqual(resolveStudioSoundGraph(sounding, heardAt).full)
    expect(spec).not.toEqual(resolveStudioSoundGraph(project, heardAt).full)
  })

  it('turns every effect of that master off but its loudness gain, at the same settings, while what the listener hears has none', () => {
    const project = song()
    const heard = studioMonitorMasterSpec(project, heardAt, {})

    const bypassed = studioMonitorMasterSpec(project, heardAt, {
      bypassed: true,
    })

    expect(bypassed.effects).toEqual(
      heard.effects.map((effect) => ({
        ...effect,
        enabled: effect.id === 'loudness',
      })),
    )
    expect(bypassed.effects.find(({ id }) => id === 'loudness')).toEqual({
      id: 'loudness',
      kind: 'gain',
      enabled: true,
      params: { gainDb: 6 },
    })
  })
})

describe('the master gain the monitored inputs play at', () => {
  const heard = { gainDb: 6, safetyGainDb: -1 }
  // Compare measured +8 dB with a safety gain of -0.5 dB and matched the
  // sides: Before as it was, After turned down 7.5 dB.
  const gains = {
    beforeGainDb: -2,
    afterGainDb: -7.5,
    gainDb: 8,
    safetyGainDb: -0.5,
  }

  it('is the gain the listener hears while Compare plays nothing', () => {
    expect(studioMonitorMasterGain(heard, null)).toEqual(heard)
  })

  it("is Before's match gain while Compare plays Before, with the master's safety gain kept for its shape", () => {
    expect(studioMonitorMasterGain(heard, { side: 'before', gains })).toEqual({
      gainDb: -2,
      safetyGainDb: -0.5,
    })
  })

  it("is the measured gain plus After's match gain while Compare plays After, as After's song plays", () => {
    expect(studioMonitorMasterGain(heard, { side: 'after', gains })).toEqual({
      gainDb: 0.5,
      safetyGainDb: -0.5,
    })
  })
})
