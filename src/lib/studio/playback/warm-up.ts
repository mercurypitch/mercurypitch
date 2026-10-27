// Studio playback warm-up — read a song's audio and measure its chains before Play, so the press only builds the graph.
import type { AudioContextLease } from '@/lib/audio-context-lease'
import type { StudioMasterGain } from '../export/sound-graph'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { prepareStudioLiveMeter } from '../metering/live-meter'
import type { StudioAsset, StudioProject } from '../model/types'
import type { StudioBufferCache } from './buffer-cache'
import { firstThatFits } from './live-edit'
import type { StudioLatencyReader } from './prepare-plan'
import { planAssets, prepareStudioPlan } from './prepare-plan'

export interface StudioWarmupOptions {
  readonly lease: AudioContextLease
  readonly cache: StudioBufferCache
  readonly measureLatencies: StudioLatencyReader
  readCanonicalAsset(id: string): Promise<Blob>
  readonly masterGain?: StudioMasterGain
  /** True once the warm-up is not wanted any more: playback began, or the transport closed. */
  busy(): boolean
}

/**
 * Best effort: a failure here is reported, if at all, by the Play that needs
 * the same work. The buffers stay cached, unpinned, for that Play to find.
 */
export async function warmStudioPlayback(
  project: StudioProject,
  assets: readonly StudioAsset[],
  signal: AbortSignal,
  options: StudioWarmupOptions,
): Promise<void> {
  // Before the first gesture the app has no AudioContext yet. Buffers are
  // not tied to one, and the device rate is one of the two common ones.
  const live = options.lease.ensure()
  const factory =
    live ??
    (typeof OfflineAudioContext === 'undefined'
      ? null
      : new OfflineAudioContext(1, 1, 48000))
  if (!factory) return
  const rates = live ? [live.sampleRate] : [48000, 44100]
  if (live) await prepareStudioLiveMeter(live)
  const plans: Awaited<ReturnType<typeof prepareStudioPlan>>[] = []
  for (const rate of rates) {
    await options.measureLatencies(
      [resolveStudioSoundGraph(project, options.masterGain).full],
      rate,
    )
    plans.push(
      await prepareStudioPlan(
        project,
        assets,
        rate,
        0,
        signal,
        options.measureLatencies,
        true,
      ),
    )
  }
  const plan = plans.at(-1)
  if (plan === undefined || options.busy() || signal.aborted) return
  const lease = await firstThatFits([true, false], (silentLanes) =>
    options.cache.acquire(
      planAssets(plan, assets, silentLanes),
      factory,
      options.readCanonicalAsset,
      signal,
    ),
  )
  lease.release()
}
