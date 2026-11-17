// ============================================================
// Studio monitor master — the master every monitored input plays through, as playback's lanes do, adding no latency
// ============================================================
//
// Playback plays its lanes into the master (graph.ts), and the monitor does
// too, as a DAW's does: REAPER sends a monitored track to the Master,
// Logic's Low Latency Mode bypasses the latency plug-ins on the track, its
// auxes and the output channel but keeps the channel, and Ableton passes a
// monitored input to the track's output, the Main by default. Without it, a
// measured loudness gain lifted the backing and not the voice heard against
// it, and the take then played back louder than it was sung.
//
// Every monitor path (input-monitor.ts) feeds one stage, built from the
// master playback plays (sound-graph.ts) at the monitor's profile
// (fx-profile.ts MONITOR_FX_PROFILE), so nothing in it delays the signal:
// the master EQ, the width, the trace saturation, the loudness gain and the
// safety gain play, and the glue compressor plays without its lookahead
// (effects/compressor.ts). It hears only the monitored inputs, where
// playback's hears the whole song, so it holds a voice down no more than
// playback's does, and with no makeup of its own it lifts nothing. The
// ceiling limiter
// plays its ceiling alone, a soft clip with nothing ahead of it
// (effects/limiter.ts): a voice the loudness gain lifts past full scale is
// held under the ceiling, as playback's limiter holds the song, and not
// clipped hard by the browser.
//
// The stage follows playback's master as it plays now (`follow`): the
// song's master, the macros still moving, and the gain the listener hears,
// which a stopped song takes from the next run (master-level.ts `heard`).
// While Compare plays, it takes the gain of the side playing, and on Before
// no master but that gain (monitor-sound.ts `studioMonitorMasterGain`).
// A change glides as it does on playback's master (chain.ts `setSpec`). The
// stage is built when the first path joins and taken apart when the last
// one leaves: a silent chain still costs its processing (MISTAKES.md, "Take
// a silent chain out of the graph").
import type { StudioFxChain } from '@/lib/studio-fx/chain'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { MONITOR_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { masterChain } from '@/lib/studio-fx/master'

/** A monitor path's way to the speakers, through the stage. */
export interface StudioMonitorMasterInput {
  /** Where the path connects. */
  readonly node: AudioNode
  /** The path has come apart: the stage goes with the last one. */
  leave(): void
}

interface Stage {
  readonly chain: StudioFxChain
  paths: number
}

/** The shared stage, on each clock a path joins it on; `spec` until the first `follow`. */
export function createStudioMonitorMaster(spec: ChainSpec = masterChain()) {
  let current = spec
  const stages = new Map<BaseAudioContext, Stage>()

  function build(context: BaseAudioContext): Stage {
    const chain = createStudioFxChain(context, current, {
      profile: MONITOR_FX_PROFILE,
      stereoHold: true,
    })
    chain.output.connect(context.destination)
    return { chain, paths: 0 }
  }

  return {
    /** A path joins on `context`: the stage's input, built for the first path. */
    join(context: BaseAudioContext): StudioMonitorMasterInput {
      let stage = stages.get(context)
      if (stage === undefined) {
        stage = build(context)
        stages.set(context, stage)
      }
      stage.paths += 1
      const joined = stage
      let left = false
      return {
        node: joined.chain.input,
        leave() {
          if (left) return
          left = true
          joined.paths -= 1
          if (joined.paths > 0) return
          stages.delete(context)
          joined.chain.dispose()
        },
      }
    },
    /** Playback's master as it plays now: a stage glides to it, and the next one is built at it. */
    follow(next: ChainSpec): void {
      current = next
      for (const { chain } of stages.values()) chain.setSpec(next)
    },
  }
}

export type StudioMonitorMaster = ReturnType<typeof createStudioMonitorMaster>
