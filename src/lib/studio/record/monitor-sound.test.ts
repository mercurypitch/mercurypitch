// Studio monitor sound — the armed lane's chain and faders as playback has them, silent where playback is silent, a new voice lane for a take with no lane, the controls still moving, and nothing worked out while monitoring is off or no song is open.
import { describe, expect, it } from 'vitest'
import { EMPTY_CHAIN } from '@/lib/studio-fx/chain-spec'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { NEUTRAL_MACROS } from '@/lib/studio-fx/mix-macros'
import { studioLaneSpec } from '../model/arrangement-plan'
import { createStudioProject, createStudioTrack } from '../model/defaults'
import type { StudioProject } from '../model/types'
import { laneGains } from '../playback/graph-lanes'
import type { StudioLaneDraft } from '../playback/in-place'
import { NEW_TAKE_LANE, studioMonitorSound } from './monitor-sound'

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
      laneId: 'voice',
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
      id: NEW_TAKE_LANE,
      name: 'Take',
      order: 0,
      role: 'voice',
    })

    const sound = studioMonitorSound(project, null, { on: true })

    expect(sound).toEqual({
      on: true,
      laneId: NEW_TAKE_LANE,
      spec: studioLaneSpec(lane, project.mix.macros),
      gains: [1, 1],
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

  it('is silent, with no chain worked out, while monitoring is off or no song is open', () => {
    const silent = {
      on: false,
      laneId: 'voice',
      spec: EMPTY_CHAIN,
      gains: [0, 0],
    }
    expect(studioMonitorSound(song(), 'voice', { on: false })).toEqual(silent)
    expect(studioMonitorSound(null, 'voice', { on: true })).toEqual(silent)
  })
})
