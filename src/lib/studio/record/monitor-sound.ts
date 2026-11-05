// ============================================================
// Studio monitor sound — what the armed lane does to a monitored input: its effects, volume and pan as playback has them
// ============================================================
//
// The input plays through the lane a take on it plays through: the lane's
// chain under the song's macros (arrangement-plan.ts `studioLaneSpec`),
// then its volume, balance and pan (graph-lanes.ts `laneGains`). With no
// lane armed, a take starts a new voice lane (controller/imports.ts
// `addRecording`), so the input sounds as a new voice lane would. A lane
// playback leaves silent, muted or outside a Solo, is silent here too. A
// frozen lane is heard through its live chain: freezing renders what
// playback plays (lane-freeze-plan.ts), and the monitor builds a chain of
// its own from the lane's settings.
// Controls still moving count (the live mix): a fader is heard while it
// moves, as in playback.
//
// Volume and pan lines are not followed: the monitor takes the lane's
// faders as they stand. The take's own level is not either: playback
// brings each recording to the same loudness first (preparation-gain.ts),
// while the monitor hears the input as it arrives.
import { EMPTY_CHAIN } from '@/lib/studio-fx/chain-spec'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { MACRO_KEYS } from '@/lib/studio-fx/mix-macros'
import { studioLaneSpec } from '../model/arrangement-plan'
import { createStudioTrack } from '../model/defaults'
import type { StudioProject, StudioTrack } from '../model/types'
import { laneGains } from '../playback/graph-lanes'
import type { StudioLaneDraft } from '../playback/in-place'
import { withDrafts } from '../playback/in-place'
import { audibility } from '../playback/live-edit'
import type { StudioMonitorSound } from './input-monitor'

/** The key a new lane's path is kept under until the take gives it an id. */
export const NEW_TAKE_LANE = 'new-take-lane'

/** Controls still moving (features/studio/mix/live-mix.ts). */
export interface StudioMovingMix {
  lane(trackId: string): StudioLaneDraft | undefined
  macro(name: MacroKey): number | undefined
}

/** The project as it sounds now, with the armed lane's moving fader and every moving macro. */
function sounding(
  project: StudioProject,
  trackId: string | null,
  moving: StudioMovingMix | undefined,
): StudioProject {
  if (moving === undefined) return project
  const lanes = new Map<string, StudioLaneDraft>()
  const draft = trackId === null ? undefined : moving.lane(trackId)
  if (trackId !== null && draft !== undefined) lanes.set(trackId, draft)
  const macros = new Map<MacroKey, number>()
  for (const key of MACRO_KEYS) {
    const value = moving.macro(key)
    if (value !== undefined) macros.set(key, value)
  }
  return withDrafts(project, { lanes, macros })
}

function newTakeLane(): StudioTrack {
  return createStudioTrack({
    id: NEW_TAKE_LANE,
    name: 'Take',
    order: 0,
    role: 'voice',
  })
}

/** The armed lane's sound for a monitored input; silent, with nothing worked out, while monitoring is off or no song is open. */
export function studioMonitorSound(
  project: StudioProject | null,
  trackId: string | null,
  options: { readonly on: boolean; readonly moving?: StudioMovingMix },
): StudioMonitorSound {
  if (!options.on || project === null)
    return {
      on: false,
      laneId: trackId ?? NEW_TAKE_LANE,
      spec: EMPTY_CHAIN,
      gains: [0, 0],
    }
  const song = sounding(project, trackId, options.moving)
  const track = song.tracks.find((item) => item.id === trackId) ?? newTakeLane()
  const heard = audibility(song)(track)
  return {
    on: options.on,
    laneId: track.id,
    spec: studioLaneSpec(track, song.mix.macros),
    gains: heard ? laneGains(track) : [0, 0],
  }
}
