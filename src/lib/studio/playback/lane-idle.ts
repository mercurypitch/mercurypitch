// ============================================================
// Studio lane idling — a lane no one can hear stops running its chain
// ============================================================
//
// Mute and Solo silence a lane at its faders, after its chain, so a muted
// lane used to run every effect at full cost: on the 24-lane perf fixture
// one audible lane cost the same 99 % of the audio thread as all 24.
// Chromium keeps processing a chain fed silence (a gate in front of the
// chain saved 15 %); only a chain nothing pulls costs nothing. So a lane
// no one can hear goes idle in three steps:
//
//   1. its faders glide to silence, as before;
//   2. once they are 100 dB down, its inlet (the gain its sources feed, in
//      front of the chain) closes, and the chain runs on, on silence, until
//      its tails have rung out, so it holds nothing stale;
//   3. then its chain leaves the mix. Its sources keep playing into a muted
//      keep-alive: a buffer source nothing pulls stops advancing, and would
//      come back late.
//
// Unmute is immediate: the chain goes back into the mix in the same task and
// its inlet opens over the run's 10 ms attack. It starts from silence, so
// its sound arrives one chain latency later and a reverb fills from empty.
// A lane built silent closes its inlet from the start and leaves the mix
// once its compressors have settled on that silence.
//
// Offline renders build only audible lanes and never idle one.
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { estimateTailSeconds } from '@/lib/studio-fx/render'
import { openRunEnvelope } from './open-envelope'

/** The faders glide with a 12 ms time constant: twelve of them is 104 dB down. */
const CLOSE_AFTER_SECONDS = 0.144
/** Room past the estimated tail before the chain leaves the mix. */
const TAIL_MARGIN_SECONDS = 0.25
/** A fresh compressor settles in about 300 ms, on silence too. */
const SETTLE_SECONDS = 0.35

export type StudioLaneIdle =
  | { readonly phase: 'live' }
  /** The inlet closes at `closeAt`; the chain leaves the mix at `leaveAt`. */
  | {
      readonly phase: 'draining'
      readonly closeAt: number
      readonly leaveAt: number
    }
  /** Out of the mix; `keepAlive` pulls its sources. */
  | { readonly phase: 'idle'; readonly keepAlive: GainNode }

export const LIVE_LANE: StudioLaneIdle = { phase: 'live' }

/** What idling reads and writes of a lane (graph-lanes.ts StudioGraphLane). */
export interface StudioIdleLane {
  idle: StudioLaneIdle
  readonly feed: { readonly input: AudioNode }
  readonly fade: GainNode
  readonly split: AudioNode
  readonly chain: { getSpec(): ChainSpec }
  readonly retiring: object | null
  /** Its reverb sends (graph-reverb-bus.ts): out of the mix with it. */
  readonly sends: readonly {
    readonly input: AudioNode
    readonly split: AudioNode
  }[]
}

/** How long a chain rings on after its input stops, plus room. */
function drainSeconds(lane: StudioIdleLane): number {
  return estimateTailSeconds(lane.chain.getSpec()) + TAIL_MARGIN_SECONDS
}

/** A lane no one hears from `now`: close its inlet after its faders, and plan its leaving. */
export function quietLane(ctx: BaseAudioContext, lane: StudioIdleLane): void {
  if (lane.idle.phase !== 'live') return
  const closeAt = ctx.currentTime + CLOSE_AFTER_SECONDS
  const inlet = lane.feed.input as GainNode
  inlet.gain.cancelScheduledValues(ctx.currentTime)
  inlet.gain.setValueAtTime(0, closeAt)
  lane.idle = {
    phase: 'draining',
    closeAt,
    leaveAt: closeAt + drainSeconds(lane),
  }
}

/** A lane built silent: its inlet closed before any source plays, its chain settling on silence. */
export function quietNewLane(
  ctx: BaseAudioContext,
  lane: StudioIdleLane,
): void {
  const inlet = lane.feed.input as GainNode
  inlet.gain.setValueAtTime(0, ctx.currentTime)
  lane.idle = {
    phase: 'draining',
    closeAt: ctx.currentTime,
    leaveAt: ctx.currentTime + SETTLE_SECONDS,
  }
}

/** Bring a lane back at once: into the mix, and its inlet open again if it had closed. */
export function wakeLane(ctx: BaseAudioContext, lane: StudioIdleLane): void {
  const idle = lane.idle
  if (idle.phase === 'live') return
  const now = ctx.currentTime
  const inlet = lane.feed.input as GainNode
  if (idle.phase === 'idle') {
    lane.fade.connect(lane.split)
    for (const send of lane.sends) send.input.connect(send.split)
    inlet.disconnect(idle.keepAlive)
    idle.keepAlive.disconnect()
  }
  inlet.gain.cancelScheduledValues(now)
  if (idle.phase === 'idle' || now >= idle.closeAt)
    openRunEnvelope(inlet, now + 128 / ctx.sampleRate)
  lane.idle = LIVE_LANE
}

/** Take each drained lane out of the mix. A lane crossing to a new chain waits until it has. */
export function settleIdleLanes(
  ctx: BaseAudioContext,
  lanes: readonly StudioIdleLane[],
): void {
  const now = ctx.currentTime
  for (const lane of lanes) {
    const idle = lane.idle
    if (idle.phase !== 'draining' || now < idle.leaveAt || lane.retiring)
      continue
    const keepAlive = ctx.createGain()
    keepAlive.gain.value = 0
    // The keep-alive first: nothing may pull the sources less in between.
    lane.feed.input.connect(keepAlive).connect(ctx.destination)
    lane.fade.disconnect(lane.split)
    for (const send of lane.sends) send.input.disconnect(send.split)
    lane.idle = { phase: 'idle', keepAlive }
  }
}

/**
 * A lane no one hears was crossed to a new chain (graph-swap.ts): the new
 * chain's inlet closes at once, before any source reaches it, and the lane
 * drains again from there. The old chain goes with the swap.
 */
export function quietSwappedLane(
  ctx: BaseAudioContext,
  lane: StudioIdleLane,
  previous: StudioLaneIdle,
): void {
  if (previous.phase === 'live') return
  if (previous.phase === 'idle') previous.keepAlive.disconnect()
  lane.idle = LIVE_LANE
  quietNewLane(ctx, lane)
}

/** Take a lane's idling apart as the lane goes. */
export function disposeLaneIdle(lane: StudioIdleLane): void {
  if (lane.idle.phase === 'idle') lane.idle.keepAlive.disconnect()
  lane.idle = LIVE_LANE
}
