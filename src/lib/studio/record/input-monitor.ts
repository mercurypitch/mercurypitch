// ============================================================
// Studio input monitor — an armed lane's input through the lane's effects, volume and pan, off unless asked for
// ============================================================
//
// Off by default: the round trip makes a voice heard late against itself,
// and through speakers it feeds back into the microphone, so the Studio
// asks for headphones when it is on. An instrument a MIDI lane plays has no
// microphone to feed back, so its player always hears it
// (useStudioRecorder.ts). When on, the input plays through its lane the way
// the lane's clips do (graph-lanes.ts): folded to the take's mono as the
// recorder's worklet folds it (capture-input.ts), spread to both sides,
// through the lane's effects, then its volume and pan. The take itself is
// recorded dry, straight from the lane's input; nothing here feeds it.
//
// The effects run at the monitor's profile (fx-profile.ts
// MONITOR_FX_PROFILE), in which nothing delays the signal: the singer hears
// no later through the effects than without them. The lookahead dynamics
// (compressor, de-esser, dynamic EQ, limiter) sit out; everything else plays.
//
// Each armed lane has a monitor of its own on its own input (lane-arms.ts),
// so a lane is heard once, and lanes armed on one input are heard together,
// as a DAW sums its armed tracks. The monitor's one path is built when its
// lane starts to sound and taken out of the graph when it stops: a silent
// chain still costs its processing.
//
// Level changes follow the house envelopes (CONVENTIONS.md 5b): toward the
// new level with setTargetAtTime, and to silence with the release, the
// nodes coming apart only after it. The input is the release's source too:
// disposed, the monitor says when its path has come apart, and a
// microphone's arm keeps its input open until then (lane-arms.ts `close`),
// so a disarm while the singer is heard is a release, not a cut.
import type { StudioFxChain } from '@/lib/studio-fx/chain'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { MONITOR_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { STUDIO_CAPTURE_INPUT } from './capture-input'

/** The house release, and the slack before the nodes come apart. */
const RELEASE_SECONDS = 0.18
const RELEASE_SLACK_SECONDS = 0.06
/** The time constant the path rises and releases on. */
const LEVEL_TIME_CONSTANT = RELEASE_SECONDS / 5
/** How fast a volume or pan the singer sets is reached. */
const MOVE_SECONDS = 0.05

export interface StudioMonitorSound {
  /** The lane is monitored: monitoring is on, or the lane plays an instrument. */
  readonly on: boolean
  /** The lane's effects as it plays them (arrangement-plan.ts `studioLaneSpec`). */
  readonly spec: ChainSpec
  /** Left and right fader gains (graph-lanes.ts `laneGains`); both 0 while the lane is not heard. */
  readonly gains: readonly [number, number]
}

export interface StudioInputMonitorOptions {
  /** Timer for taking a released path apart; injectable for tests. */
  readonly schedule?: (callback: () => void, delayMs: number) => () => void
}

/** The input through its lane: folded, spread, the chain, the faders, and the level that rises and releases. */
interface MonitorPath {
  readonly fold: GainNode
  readonly spread: GainNode
  readonly chain: StudioFxChain
  readonly split: ChannelSplitterNode
  readonly sides: readonly GainNode[]
  readonly merge: ChannelMergerNode
  readonly level: GainNode
  /** What the sides were last asked for. */
  gains: readonly [number, number]
}

function defaultSchedule(callback: () => void, delayMs: number): () => void {
  const handle = setTimeout(callback, delayMs)
  return () => clearTimeout(handle)
}

/** A gain that mixes what it is given to `channels` by the speaker rules. */
function channelGain(
  context: BaseAudioContext,
  settings: Pick<
    AudioNodeOptions,
    'channelCount' | 'channelCountMode' | 'channelInterpretation'
  >,
): GainNode {
  return Object.assign(context.createGain(), settings)
}

/** Glide `param` from where it is now toward `value`. */
function glide(
  context: BaseAudioContext,
  param: AudioParam,
  value: number,
  timeConstant: number,
): void {
  const now = context.currentTime
  param.cancelScheduledValues(now)
  param.setValueAtTime(param.value, now)
  param.setTargetAtTime(value, now, timeConstant)
}

export function createStudioInputMonitor(
  context: BaseAudioContext,
  input: AudioNode,
  options: StudioInputMonitorOptions = {},
) {
  const schedule = options.schedule ?? defaultSchedule
  let path: MonitorPath | null = null
  /** Stops the take-apart of a path that is releasing; null while it is heard, or there is none. */
  let cancelRemoval: (() => void) | null = null
  let closed = false
  /** Told once the input feeds nothing here (dispose). */
  const silent: (() => void)[] = []

  function build(sound: StudioMonitorSound): MonitorPath {
    const fold = channelGain(context, STUDIO_CAPTURE_INPUT)
    const spread = channelGain(context, {
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    })
    const chain = createStudioFxChain(context, sound.spec, {
      profile: MONITOR_FX_PROFILE,
      stereoHold: true,
    })
    const split = context.createChannelSplitter(2)
    const merge = context.createChannelMerger(2)
    const sides = sound.gains.map((value, side) => {
      const gain = context.createGain()
      gain.gain.value = value
      split.connect(gain, side)
      gain.connect(merge, 0, side)
      return gain
    })
    const level = context.createGain()
    level.gain.value = 0
    input.connect(fold)
    fold.connect(spread).connect(chain.input)
    chain.output.connect(split)
    merge.connect(level).connect(context.destination)
    return {
      fold,
      spread,
      chain,
      split,
      sides,
      merge,
      level,
      gains: sound.gains,
    }
  }

  /** Take the path out of the graph, the input's edge to it first: the input is its arm's. */
  function takeApart(): void {
    const gone = path
    path = null
    cancelRemoval = null
    if (gone !== null) {
      try {
        input.disconnect(gone.fold)
      } catch {
        // Already apart: the arm closed its input first.
      }
      gone.fold.disconnect()
      gone.spread.disconnect()
      gone.chain.dispose()
      gone.split.disconnect()
      for (const side of gone.sides) side.disconnect()
      gone.merge.disconnect()
      gone.level.disconnect()
    }
    for (const told of silent.splice(0)) told()
  }

  /** Fade the path out on the release, then take it apart. */
  function release(): void {
    if (path === null || cancelRemoval !== null) return
    glide(context, path.level.gain, 0, LEVEL_TIME_CONSTANT)
    cancelRemoval = schedule(
      takeApart,
      (RELEASE_SECONDS + RELEASE_SLACK_SECONDS) * 1000,
    )
  }

  /** The path, built afresh or brought back from its release, rising from where it is; as it is while heard. */
  function bringIn(sound: StudioMonitorSound): MonitorPath {
    if (path === null) path = build(sound)
    else if (cancelRemoval !== null) {
      cancelRemoval()
      cancelRemoval = null
    } else return path
    glide(context, path.level.gain, 1, LEVEL_TIME_CONSTANT)
    return path
  }

  return {
    set(sound: StudioMonitorSound): void {
      if (closed) return
      if (!sound.on || sound.gains.every((gain) => gain <= 0)) {
        release()
        return
      }
      const heard = bringIn(sound)
      heard.chain.setSpec(sound.spec)
      if (heard.gains.every((gain, side) => gain === sound.gains[side])) return
      heard.gains = sound.gains
      for (const [side, gain] of heard.sides.entries())
        glide(context, gain.gain, sound.gains[side], MOVE_SECONDS / 5)
    },
    /**
     * Release the path for good. `whenSilent` runs once it has come apart
     * and the input feeds nothing here, at once when nothing is heard: until
     * then the input must stay open, or the release is cut.
     */
    dispose(whenSilent?: () => void): void {
      if (!closed) {
        closed = true
        release()
      }
      if (whenSilent === undefined) return
      if (path === null) whenSilent()
      else silent.push(whenSilent)
    },
  }
}

export type StudioInputMonitor = ReturnType<typeof createStudioInputMonitor>
