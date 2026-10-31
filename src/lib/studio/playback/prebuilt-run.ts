// ============================================================
// Studio prebuilt run — the song's graph built, settled and parked before the press that plays it
// ============================================================
//
// A Play with no graph to start builds one inside the press. On the medium
// profiling song (twelve lanes, every role's chain) in headless Chromium
// that build took 79 ms, then the new compressors had 60 ms of silence to
// settle (RUN_SETTLE_SECONDS), so the song was heard 301 ms after the press
// against 141 to 151 ms for the graph Pause keeps (kept-run.ts).
//
// So once the Studio's clock exists, the transport builds that graph while
// nobody is pressing anything: after the warm-up has read the song's audio
// (warm-up.ts), when no graph is kept, playing or being built. It is built
// as a Play would build it, from the song's start so Play can start it from
// any frame, with every lane that has clips where memory allows. It opens no
// envelope and schedules no source. Its compressors settle on the silence
// it renders through the closed envelope, then the envelope lets go of the
// speakers, and nothing renders the graph until Play connects it (a zero
// gain in front of a chain would still cost the whole chain). Kept like a
// paused run, it holds memory, not the audio thread, and goes as a kept run
// does: after five idle minutes, half a minute hidden, or when the memory
// budget needs the room. Built ahead, the same song was heard 159 to 168 ms
// after the press.
//
// The clock is never made or resumed for it. On the web the Studio's clock
// exists only after a press made it (web-audio-lease.ts), where WebKit lets
// audio start, so the first Play of a visit still builds in the press. What
// comes after is built ahead: a song opened next, and an edit while paused
// that the kept graph cannot follow.
import type { StudioMasterGain } from '../export/sound-graph'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import type { StudioAsset, StudioProject } from '../model/types'
import type { buildStudioGraph } from './graph'
import { firstThatFits, studioRunLayouts } from './live-edit'
import type { StudioAdmitSources } from './prepare-plan'
import { admitStudioRun, planLatencySeconds, prepareStudioMaster, } from './prepare-plan'
import type { StudioRun } from './run'
import { buildParkedStudioRun } from './run'

export interface StudioPrebuildOptions {
  readonly repeat: boolean
  /** The measured master gains a Play from silence would start with. */
  readonly measured: StudioMasterGain
  readonly buildGraph: typeof buildStudioGraph
  readonly sources: StudioAdmitSources
}

/** A run built and parked, and when its compressors have settled on the audio clock. */
export interface StudioPrebuilt {
  readonly run: StudioRun
  readonly settledAt: number
}

/**
 * Build `project`'s graph on `ctx`, which must be running, and park it.
 * The caller keeps the run or frees it (releaseRun). Throws as a Play's
 * build would: aborted, out of memory, or audio that cannot be read.
 */
export async function prebuildStudioRun(
  project: StudioProject,
  assets: readonly StudioAsset[],
  ctx: AudioContext,
  signal: AbortSignal,
  options: StudioPrebuildOptions,
): Promise<StudioPrebuilt> {
  const master = resolveStudioSoundGraph(project, options.measured).full
  const masterLatency = await prepareStudioMaster(
    ctx,
    master,
    signal,
    options.sources.measure,
  )
  // From the song's start, with the silent lanes or without them.
  const request = { project, assets, ctx, master }
  const admitted = await firstThatFits(studioRunLayouts(0, true), (layout) =>
    admitStudioRun(request, layout, signal, options.sources),
  )
  try {
    signal.throwIfAborted()
    return buildParkedStudioRun({
      ...admitted,
      ctx,
      project,
      master,
      measured: options.measured,
      repeat: options.repeat,
      latency: planLatencySeconds(admitted.plan) + masterLatency,
      buildGraph: options.buildGraph,
    })
  } catch (error) {
    admitted.buffers.release()
    admitted.releaseMemory()
    throw error
  }
}
