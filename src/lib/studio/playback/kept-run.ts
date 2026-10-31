// ============================================================
// Studio kept run — Pause keeps the built graph, so Play only starts its sources again
// ============================================================
//
// Pause used to free the song's graph a quarter second after the press, so
// every Play built it again: measure the chains, reserve the memory, lease
// the audio, build each lane's effects and the master, and start a tenth of
// a second or more past that build to stay ahead of the clock. In headless
// Chromium the first sound came 172 to 208 ms after the press.
//
// Pause now keeps the newest run. Its envelope closes as before, and once it
// is silent its sources stop and its meters go, but its chains, master and
// leased audio stay. Play starts the same graph from the playhead: new
// sources a device callback ahead (seekEarliest), and the run's attack, so
// the first sound comes 87 to 98 ms after the press (with the 90 ms attack it
// replaced; see openRunEnvelope). An edit while paused
// moves the kept graph as it would a playing one: the mix and sound in
// place, other clips lane by lane (lane-replan.ts). One the graph cannot
// follow lets it go, and Play builds afresh: 171 to 182 ms to the first
// sound after a clip edit while paused, before clips moved in place.
// Another effect list is one: a parked graph takes no chain swap, since
// once its tails have rung out nothing renders it (below), and a new chain
// built then could not settle before Play (graph-swap.ts).
//
// Left connected, a kept graph costs about two points of a core for as long
// as it waits: the whole headless Chromium used 4.1 to 4.3 % of one core
// with it on a two-lane song, against 1.8 to 2.3 % with no graph, since
// compressors and analysers process silence on every quantum. So once its
// chains' tails have rung out through the closed envelope, the envelope
// lets go of the speakers and the peak analysers of the output (graph.ts),
// and nothing renders the graph until Play connects it again: 1.9 to 2.1 %.
// Not before: a reverb stopped mid-tail would ring on under the next Play.
//
// What it still holds is memory: the graph's and its pinned audio. It is let
// go when the memory budget needs the room, when the song stops or changes,
// when Play gets another audio context, after KEEP_IDLE_MS without Play or
// an edit, and after KEEP_HIDDEN_MS with the page hidden. Five minutes
// covers pausing to change a passage and playing it again; past that, the
// memory back is worth the tenth of a second the next Play spends building.
// A hidden page cannot take a Play press, and a phone may discard it.
//
// A run built ahead of the press (prebuilt-run.ts) is kept the same way. It
// never played, so it is silent from the start; its envelope feeds the
// speakers only until its fresh compressors have settled, and a Play before
// then starts it once they have.
import { closeEnvelope } from '@/lib/preview-player'
import { registerStudioMemoryReclaimer } from '../memory-budget'
import type { createStudioLaneMeter } from '../metering/live-meter'
import { createStudioLiveMeter } from '../metering/live-meter'
import type { StudioAsset, StudioProject } from '../model/types'
import type { StudioLiveSettings } from './in-place'
import { fitsInPlace, followInPlace, withDrafts } from './in-place'
import { freezesOutdated } from './lane-freeze'
import { replanLanes } from './lane-replan'
import { livePlaybackProfile } from './playback-quality'
import type { StudioRun } from './run'
import { frozenSong, openRunEnvelope, releaseRun, RUN_LOOKAHEAD_SECONDS, } from './run'
import { seekEarliest } from './seek'

/** Pause's fade, as a stopped run's: 180 ms down, silent by 240 ms. */
const FADE_SECONDS = 0.18
const SILENT_AFTER_MS = 240
/** Past the longest chain tail, before the graph stops being rendered. */
const TAIL_MARGIN_MS = 1000
/** How long a kept run waits for Play, or an edit, while the page is in view. */
export const KEEP_IDLE_MS = 5 * 60_000
/** How long it waits while the page is hidden. */
export const KEEP_HIDDEN_MS = 30_000
/** Past a prebuilt run's settle on the audio clock, before it stops being rendered. */
const SETTLED_MARGIN_MS = 40

export interface StudioKeptRunOptions {
  /** Fade a run out now and free it once silent: the transport's own stop. */
  retire(run: StudioRun): void
  /** Drop the audio no run plays, so what a kept run gave back is free. */
  clearCache(): void
  createLaneMeter: typeof createStudioLaneMeter
}

export function createStudioKeptRun(options: StudioKeptRunOptions) {
  let kept: StudioRun | null = null
  // Its sources have stopped, so Play can start it again.
  let silent = false
  // Its envelope has let go of the speakers, so nothing renders it.
  let unrendered = false
  let hidden = false
  // When a prebuilt run's compressors have settled: Play starts it no sooner.
  let readyAt = -Infinity
  let silenceTimer: ReturnType<typeof setTimeout> | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  const unregister = registerStudioMemoryReclaimer(() => {
    if (!kept || !silent) return
    letGo()
    options.clearCache()
  })

  function detach(): StudioRun | null {
    const run = kept
    kept = null
    silent = false
    clearTimeout(silenceTimer)
    if (run && unrendered) run.envelope.connect(run.ctx.destination)
    unrendered = false
    readyAt = -Infinity
    clearTimeout(idleTimer)
    return run
  }

  /** Free the kept run: at once when it is silent, after its fade when not. */
  function letGo(): void {
    const quiet = silent
    const run = detach()
    if (!run) return
    if (quiet) releaseRun(run)
    else options.retire(run)
  }

  function waitForPlay(): void {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(letGo, hidden ? KEEP_HIDDEN_MS : KEEP_IDLE_MS)
  }

  /** Let a prebuilt run go of the speakers once the audio clock has passed its settle. */
  function unrenderOnceSettled(run: StudioRun): void {
    const wait = Math.max(0, readyAt - run.ctx.currentTime) * 1000
    silenceTimer = setTimeout(() => {
      if (run.ctx.currentTime < readyAt) unrenderOnceSettled(run)
      else {
        run.envelope.disconnect(run.ctx.destination)
        unrendered = true
      }
    }, wait + SETTLED_MARGIN_MS)
  }

  /** An edit while paused: the kept graph moves with it, or goes when it cannot follow. */
  function follow(
    project: StudioProject,
    assets: readonly StudioAsset[],
    settings: StudioLiveSettings,
  ): void {
    if (!kept) return
    if (!follows(kept, project, assets, settings)) {
      letGo()
      return
    }
    followInPlace(kept, project, settings)
    waitForPlay()
  }

  /** Whether the kept graph can play `project`: as it is, or with its lanes moved to other clips. */
  function follows(
    run: StudioRun,
    project: StudioProject,
    assets: readonly StudioAsset[],
    settings: StudioLiveSettings,
  ): boolean {
    // Built again for renders that finished or went stale since (lane-freezer.ts)...
    const outdated = settings.freezes
      ? settings.freezes.differs(project, assets, run.frozen)
      : freezesOutdated(
          run.frozen,
          withDrafts(project, settings.drafts),
          assets,
        )
    if (outdated) return false
    // ...and at another playback quality (playback-quality.ts).
    const song = frozenSong(project, run.frozen)
    if (run.graph.profile() !== livePlaybackProfile(song)) return false
    return (
      fitsInPlace(run, project, settings.drafts) ||
      replanLanes(run, project, assets)
    )
  }

  return {
    /** Fade `run` out and keep its graph; its sources and meters stop once it is silent. */
    keep(run: StudioRun): void {
      letGo()
      // A fade needs the clock to run; on a stopped one the run just goes.
      if (run.ctx.state !== 'running') {
        options.retire(run)
        return
      }
      kept = run
      closeEnvelope(run.envelope, run.ctx, FADE_SECONDS)
      silenceTimer = setTimeout(() => {
        run.graph.park()
        run.meter?.dispose()
        run.laneMeter?.dispose()
        run.meter = null
        run.laneMeter = null
        silent = true
        silenceTimer = setTimeout(
          () => {
            run.envelope.disconnect(run.ctx.destination)
            unrendered = true
          },
          run.tailFrames / 48 + TAIL_MARGIN_MS,
        )
      }, SILENT_AFTER_MS)
      waitForPlay()
    },
    /**
     * Start the kept run again from `from`, heard as soon as the clock
     * allows, when its graph can play `project` on `ctx`. Null, with the run
     * let go, when it cannot: Play builds a new one.
     */
    take(
      ctx: AudioContext,
      project: StudioProject,
      assets: readonly StudioAsset[],
      from: number,
      settings: StudioLiveSettings,
    ): StudioRun | null {
      if (
        !kept ||
        !silent ||
        kept.ctx !== ctx ||
        !follows(kept, project, assets, settings)
      ) {
        letGo()
        return null
      }
      // Detached first: the meters below reserve memory, and the reclaimer
      // must not free the run they are for.
      const settled = readyAt
      const run = detach()!
      const epoch = Math.max(seekEarliest(ctx), settled)
      if (!run.graph.resume(from, epoch, settings.repeat)) {
        releaseRun(run)
        return null
      }
      followInPlace(run, project, settings)
      const audibleEpoch = epoch + run.latency
      run.startFrame = from
      run.audibleEpoch = audibleEpoch
      run.untilFrame = settings.repeat ? Infinity : run.endFrame
      run.silentUntil = audibleEpoch
      run.envelope.gain.cancelScheduledValues(0)
      run.openAt = openRunEnvelope(run.envelope, audibleEpoch)
      run.meter = createStudioLiveMeter(ctx, run.envelope, audibleEpoch)
      run.laneMeter = options.createLaneMeter(
        ctx,
        run.graph.laneOutputs(),
        audibleEpoch,
      )
      run.graph.scheduleUntil(ctx.currentTime + RUN_LOOKAHEAD_SECONDS)
      return run
    },
    follow,
    /**
     * Whether a run built ahead is wanted for `project`: a kept run follows
     * it first, or goes, and none is wanted while one is kept or the page
     * is hidden.
     */
    wants(
      project: StudioProject,
      assets: readonly StudioAsset[],
      settings: StudioLiveSettings,
    ): boolean {
      follow(project, assets, settings)
      return kept === null && !hidden
    },
    /**
     * Keep a run built ahead of the press (prebuilt-run.ts): parked and
     * never heard, so silent from the start. Nothing renders it once its
     * compressors have settled at `settledAt`.
     */
    adopt(run: StudioRun, settledAt: number): void {
      letGo()
      kept = run
      silent = true
      readyAt = settledAt
      unrenderOnceSettled(run)
      waitForPlay()
    },
    letGo,
    /** A kept run still fading fades out and goes, as a stopped one does. */
    settle(): void {
      if (kept && !silent) letGo()
    },
    setPageHidden(value: boolean): void {
      hidden = value
      if (kept) waitForPlay()
    },
    dispose(): void {
      letGo()
      unregister()
    },
  }
}
