// ============================================================
// Studio monitor sound — what an armed lane does to its monitored input: its effects, volume and pan, and the master after them, as playback has them
// ============================================================
//
// The input plays through the lane a take on it plays through: the lane's
// chain under the song's macros (arrangement-plan.ts `studioLaneSpec`),
// then its volume, balance and pan (graph-lanes.ts `laneGains`). A lane
// armed with no lane of its own (null) starts a new voice lane with its
// take (controller/imports.ts `addRecording`), so its input sounds as a new
// voice lane would. A lane playback leaves silent, muted or outside a Solo,
// is silent here too, and so is a lane that has left the song: it disarms
// (useStudioRecorder.ts). A frozen lane is heard through its live chain:
// freezing renders what playback plays (lane-freeze-plan.ts), and the
// monitor builds a chain of its own from the lane's settings. A MIDI lane's
// instrument is heard through its lane the same way: its clips play
// through the lane's chain too.
// Controls still moving count (the live mix): a fader is heard while it
// moves, as in playback.
//
// Volume and pan lines are not followed: the monitor takes the lane's
// faders as they stand. The take's own level is not either: playback
// brings each recording to the same loudness first (preparation-gain.ts),
// while the monitor hears the input as it arrives.
//
// After the lanes, the master (`studioMonitorMasterSpec`): the song's, as
// playback plays it (sound-graph.ts), its macros still moving included, at
// the master gain the listener hears. While Compare plays, the voice takes
// the gain of the side playing, as the song does (`studioMonitorMasterGain`),
// so on After it keeps playback's balance with the song. Before plays the
// song with every effect off and no master (prepare-comparison.ts), so there
// the lane plays with every effect off too (`dry`), and the master with only
// its loudness gain, which plays the gain Before's song plays at: its WAV's
// encoding gain and then the side's match gain. A dry voice beside the dry
// song. Their balance there is the faders', not playback's: each effect
// moves each sound by its own amount.
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { EMPTY_CHAIN } from '@/lib/studio-fx/chain-spec'
import { MASTER_LOUDNESS_EFFECT_ID } from '@/lib/studio-fx/master'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { MACRO_KEYS } from '@/lib/studio-fx/mix-macros'
import type { StudioComparison } from '../export/prepare-comparison'
import type { StudioMasterGain } from '../export/sound-graph'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { studioLaneSpec } from '../model/arrangement-plan'
import { createStudioTrack } from '../model/defaults'
import type { StudioProject, StudioTrack } from '../model/types'
import { laneGains } from '../playback/graph-lanes'
import type { StudioLaneDraft } from '../playback/in-place'
import { withDrafts } from '../playback/in-place'
import { audibility } from '../playback/live-edit'
import type { StudioMonitorSound } from './input-monitor'

/** Controls still moving (features/studio/mix/live-mix.ts). */
export interface StudioMovingMix {
  lane(trackId: string): StudioLaneDraft | undefined
  macro(name: MacroKey): number | undefined
}

const SILENT: StudioMonitorSound = {
  on: false,
  spec: EMPTY_CHAIN,
  gains: [0, 0],
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

/** The voice lane a take armed with no lane of its own starts. */
function newTakeLane(): StudioTrack {
  return createStudioTrack({
    id: 'new-take-lane',
    name: 'Take',
    order: 0,
    role: 'voice',
  })
}

/** `spec` with every effect off at the same settings, `kept` aside: the chain glides each one out and back in (chain.ts `setSpec`). */
function effectsOff(spec: ChainSpec, kept?: string): ChainSpec {
  return {
    ...spec,
    effects: spec.effects.map((effect) => ({
      ...effect,
      enabled: effect.id === kept,
    })),
  }
}

/**
 * Lane `trackId`'s sound for its monitored input; silent, with nothing
 * worked out, while it is not monitored or no song is open. `dry` while what
 * the listener hears has no effects (Compare's Before side): every effect of
 * the lane off at the same settings, as Before renders the song, its faders
 * as they are.
 */
export function studioMonitorSound(
  project: StudioProject | null,
  trackId: string | null,
  options: {
    readonly on: boolean
    readonly moving?: StudioMovingMix
    readonly dry?: boolean
  },
): StudioMonitorSound {
  if (!options.on || project === null) return SILENT
  const song = sounding(project, trackId, options.moving)
  const track =
    trackId === null
      ? newTakeLane()
      : song.tracks.find((item) => item.id === trackId)
  if (track === undefined) return SILENT
  const spec = studioLaneSpec(track, song.mix.macros)
  return {
    on: true,
    spec: options.dry === true ? effectsOff(spec) : spec,
    gains: audibility(song)(track) ? laneGains(track) : [0, 0],
  }
}

/** The side Compare plays and the gains it plays at (prepare-comparison.ts). */
export interface StudioMonitorCompare {
  readonly side: 'before' | 'after'
  readonly gains: Pick<
    StudioComparison,
    | 'beforeEncodingGainDb'
    | 'beforeGainDb'
    | 'afterGainDb'
    | 'gainDb'
    | 'safetyGainDb'
  >
}

/**
 * The master gain the monitor plays at: the one the listener hears; while
 * Compare plays, its side's, as comparison-preview.ts plays the song. Before
 * plays the dry mix at the gain its WAV was encoded at and then the side's
 * match gain, After the master at the measured gain and then the side's match
 * gain. The safety gain stays, so the
 * master keeps its shape as the sides change.
 */
export function studioMonitorMasterGain(
  heard: StudioMasterGain,
  compare: StudioMonitorCompare | null,
): StudioMasterGain {
  if (compare === null) return heard
  const { gains } = compare
  return {
    gainDb:
      compare.side === 'before'
        ? gains.beforeEncodingGainDb + gains.beforeGainDb
        : gains.gainDb + gains.afterGainDb,
    safetyGainDb: gains.safetyGainDb,
  }
}

/**
 * The master every monitored input plays through (monitor-master.ts):
 * playback's, the song's macros still moving included, at `gain`, the
 * master gain the monitor plays at. `bypassed` while what they hear has no
 * master (Compare's Before side): every effect off at the same settings but
 * the loudness gain, which plays `gain`, so the master glides out and back
 * in without a jump.
 */
export function studioMonitorMasterSpec(
  project: StudioProject,
  gain: StudioMasterGain,
  options: { readonly moving?: StudioMovingMix; readonly bypassed?: boolean },
): ChainSpec {
  const song = sounding(project, null, options.moving)
  const master = resolveStudioSoundGraph(song, gain).full
  return options.bypassed === true
    ? effectsOff(master, MASTER_LOUDNESS_EFFECT_ID)
    : master
}
