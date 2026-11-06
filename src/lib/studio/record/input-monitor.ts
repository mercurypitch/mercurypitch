// ============================================================
// Studio input monitor — the armed microphone through its lane's effects, volume and pan, off unless asked for
// ============================================================
//
// Off by default: the round trip makes a voice heard late against itself,
// and through speakers it feeds back into the microphone, so the Studio
// asks for headphones when it is on. When on, the input plays through the
// armed lane the way the lane's clips do (graph-lanes.ts): folded to the
// take's mono (capture-node.ts), spread to both sides, through the lane's
// effects, then its volume and pan. The take itself is recorded dry,
// straight from the source; nothing here feeds it.
//
// The effects run at the monitor's profile (fx-profile.ts
// MONITOR_FX_PROFILE), in which nothing delays the signal: the singer hears
// no later through the effects than without them. The lookahead dynamics
// (compressor, de-esser, dynamic EQ, limiter) sit out; everything else plays.
//
// Each lane gets its own path, built when it starts to sound and taken out
// of the graph when it stops: a silent chain still costs its processing.
// Moving the arm crosses from one lane's path to the other's on one time
// constant, one falling as the other rises, so their levels add to one and
// the input is never heard twice over. The input is folded once, and every
// path feeds from that fold.
//
// Level changes follow the house envelopes (CONVENTIONS.md 5b): toward the
// new level with setTargetAtTime, and to silence with the release, the
// nodes coming apart only after it. The input is the release's source too:
// disposed, the monitor says when the last path has come apart, and the arm
// keeps its source and microphone open until then (studio-recorder.ts
// `closeArmed`), so a disarm while the singer is heard is a release, not a
// cut.
//
// A path rises only once the input has settled. A new source plays silence
// until the microphone's samples reach it, 10 to 202 ms after the press in
// headless Chromium, and they begin wherever the waveform is. The browser's
// buffer then runs dry for two quanta about 14 ms in, and in 3 of 13
// re-arms again 173 to 181 ms after the press, the input stepping on either
// side of each gap. A path already rising carried those steps to the singer
// as clicks, up to 17.6 times the tone's own steepest step. So the arm says
// when its worklet first meters a sound (studio-recorder.ts
// `captureEvents`), and the path rises from silence a quarter of a second
// after that. An input silent for longer, a muted microphone, comes up after
// a second anyway, so the monitor never stays shut. The wait holds back the
// first rise only: once up, the input plays straight through, no later than
// before.
import type { StudioFxChain } from '@/lib/studio-fx/chain'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { MONITOR_FX_PROFILE } from '@/lib/studio-fx/fx-profile'

/** The house release, and the slack before the nodes come apart. */
const RELEASE_SECONDS = 0.18
const RELEASE_SLACK_SECONDS = 0.06
/** One time constant for the path coming in and the path going out. */
const CROSS_TIME_CONSTANT = RELEASE_SECONDS / 5
/** How fast a volume or pan the singer sets is reached. */
const MOVE_SECONDS = 0.05
/** How long the input sounds before a path rises on it: past the gaps a new source's first moments hold. */
const SETTLE_MS = 250
/** How long a path waits for the input's first sound before it rises anyway: five times the slowest arrival measured. */
const ARRIVAL_WAIT_MS = 1000

export interface StudioMonitorSound {
  /** The singer turned monitoring on. */
  readonly on: boolean
  /** The lane the input plays through; each lane keeps a path of its own. */
  readonly laneId: string
  /** The lane's effects as it plays them (arrangement-plan.ts `studioLaneSpec`). */
  readonly spec: ChainSpec
  /** Left and right fader gains (graph-lanes.ts `laneGains`); both 0 while the lane is not heard. */
  readonly gains: readonly [number, number]
}

export interface StudioInputMonitorOptions {
  /** Timer for taking a released path apart; injectable for tests. */
  readonly schedule?: (callback: () => void, delayMs: number) => () => void
}

/** Where every path feeds from: the input folded to the take's mono, then spread to both sides as a clip is. */
interface MonitorInlet {
  readonly fold: GainNode
  readonly spread: GainNode
}

interface MonitorPath {
  readonly laneId: string
  readonly chain: StudioFxChain
  readonly split: ChannelSplitterNode
  readonly sides: readonly GainNode[]
  readonly merge: ChannelMergerNode
  readonly level: GainNode
  /** What the sides were last asked for. */
  gains: readonly [number, number]
  /** Stops the take-apart of a path that comes back while it releases. */
  cancelRemoval: (() => void) | null
}

function defaultSchedule(callback: () => void, delayMs: number): () => void {
  const handle = setTimeout(callback, delayMs)
  return () => clearTimeout(handle)
}

function channelGain(context: BaseAudioContext, channels: number): GainNode {
  const gain = context.createGain()
  gain.channelCount = channels
  gain.channelCountMode = 'explicit'
  gain.channelInterpretation = 'speakers'
  return gain
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
  let inlet: MonitorInlet | null = null
  let current: MonitorPath | null = null
  const releasing = new Set<MonitorPath>()
  let closed = false
  /** Told once the input is no longer heard (dispose). */
  const silent: (() => void)[] = []
  /** The input has settled, or the wait for its first sound is over: a heard path may rise. */
  let settled = false
  /** Ends the settling the input's first sound began. */
  let stopSettling: (() => void) | null = null
  const stopWaiting = schedule(settle, ARRIVAL_WAIT_MS)

  function settle(): void {
    if (settled) return
    settled = true
    stopWaiting()
    stopSettling?.()
    stopSettling = null
    if (current !== null)
      glide(context, current.level.gain, 1, CROSS_TIME_CONSTANT)
  }

  function openInlet(): MonitorInlet {
    const fold = channelGain(context, 1)
    const spread = channelGain(context, 2)
    input.connect(fold)
    fold.connect(spread)
    return { fold, spread }
  }

  /** Once no path is left, the input stops feeding the fold. */
  function closeInlet(): void {
    if (inlet === null || current !== null || releasing.size > 0) return
    try {
      input.disconnect(inlet.fold)
    } catch {
      // Already apart: the arm closed its source first.
    }
    inlet.fold.disconnect()
    inlet.spread.disconnect()
    inlet = null
    for (const told of silent.splice(0)) told()
  }

  function buildPath(sound: StudioMonitorSound): MonitorPath {
    inlet ??= openInlet()
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
    inlet.spread.connect(chain.input)
    chain.output.connect(split)
    merge.connect(level).connect(context.destination)
    return {
      laneId: sound.laneId,
      chain,
      split,
      sides,
      merge,
      level,
      gains: sound.gains,
      cancelRemoval: null,
    }
  }

  function removePath(path: MonitorPath): void {
    releasing.delete(path)
    path.cancelRemoval = null
    try {
      inlet?.spread.disconnect(path.chain.input)
    } catch {
      // Already apart.
    }
    path.chain.dispose()
    path.split.disconnect()
    for (const side of path.sides) side.disconnect()
    path.merge.disconnect()
    path.level.disconnect()
    closeInlet()
  }

  function release(path: MonitorPath): void {
    glide(context, path.level.gain, 0, CROSS_TIME_CONSTANT)
    releasing.add(path)
    path.cancelRemoval = schedule(
      () => removePath(path),
      (RELEASE_SECONDS + RELEASE_SLACK_SECONDS) * 1000,
    )
  }

  /** The lane's path, brought back from its release or built afresh, rising on the crossing's time constant once the input has settled. */
  function bringIn(sound: StudioMonitorSound): MonitorPath {
    let path = [...releasing].find((item) => item.laneId === sound.laneId)
    if (path === undefined) path = buildPath(sound)
    else {
      path.cancelRemoval?.()
      path.cancelRemoval = null
      releasing.delete(path)
    }
    if (settled) glide(context, path.level.gain, 1, CROSS_TIME_CONSTANT)
    return path
  }

  return {
    set(sound: StudioMonitorSound): void {
      if (closed) return
      const heard = sound.on && sound.gains.some((gain) => gain > 0)
      if (current !== null && (!heard || current.laneId !== sound.laneId)) {
        release(current)
        current = null
      }
      if (!heard) return
      current ??= bringIn(sound)
      current.chain.setSpec(sound.spec)
      const path = current
      if (path.gains.every((gain, side) => gain === sound.gains[side])) return
      path.gains = sound.gains
      for (const [side, gain] of path.sides.entries())
        glide(context, gain.gain, sound.gains[side], MOVE_SECONDS / 5)
    },
    /**
     * The input's first samples are here: the arm's worklet metered a sound.
     * A heard path rises from silence once they have settled, and every one
     * after it at once; the wait for a silent input is over.
     */
    inputArrived(): void {
      if (closed || settled || stopSettling !== null) return
      stopWaiting()
      stopSettling = schedule(settle, SETTLE_MS)
    },
    /**
     * Release every path for good. `whenSilent` runs once the last one has
     * come apart and the input feeds nothing here, at once when none sounds:
     * until then the input must stay open, or the release is cut.
     */
    dispose(whenSilent?: () => void): void {
      if (!closed) {
        closed = true
        stopWaiting()
        stopSettling?.()
        if (current !== null) release(current)
        current = null
      }
      if (whenSilent === undefined) return
      if (inlet === null) whenSilent()
      else silent.push(whenSilent)
    },
  }
}

export type StudioInputMonitor = ReturnType<typeof createStudioInputMonitor>
