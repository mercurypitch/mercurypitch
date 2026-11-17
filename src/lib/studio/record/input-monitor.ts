// ============================================================
// Studio input monitor — an armed lane's input through the lane's effects, volume and pan, then the master, off unless asked for
// ============================================================
//
// Off by default: the round trip makes a voice heard late against itself,
// and through speakers it feeds back into the microphone, so the Studio
// asks for headphones when it is on. An instrument a MIDI lane plays has no
// microphone to feed back, so its player always hears it
// (useStudioRecorder.ts). When on, the input plays through its lane the way
// the lane's clips do (graph-lanes.ts): folded to the take's mono as the
// recorder's worklet folds it (capture-input.ts), spread to both sides,
// through the lane's effects, then its volume and pan, and then, as every
// lane's clips do, through the master: one stage every monitored lane
// shares (monitor-master.ts), its loudness gain the one the song is heard
// at. The take itself is recorded dry, straight from the lane's input;
// nothing here feeds it.
//
// The effects and the master run at the monitor's profile (fx-profile.ts
// MONITOR_FX_PROFILE), in which nothing delays the signal: the singer hears
// no later through them than without them. A compressor plays without its
// lookahead (effects/compressor.ts), the de-esser and dynamic EQ sit out, a
// limiter plays its ceiling without its lookahead, and everything else
// plays.
//
// Each armed lane has a monitor of its own on its own input (lane-arms.ts),
// so a lane is heard once, and lanes armed on one input are heard together,
// as a DAW sums its armed tracks. The monitor's one path is built when its
// lane starts to sound and taken out of the graph when it stops, and the
// master with the last path: a silent chain still costs its processing.
//
// Level changes follow the house envelopes (CONVENTIONS.md 5b): toward the
// new level with setTargetAtTime, and to silence with the release, the
// nodes coming apart only after it. The input is the release's source too:
// disposed, the monitor says when its path has come apart, and a
// microphone's arm keeps its input open until then (lane-arms.ts `close`),
// so a disarm while the singer is heard is a release, not a cut. Not when
// the lane re-arms on another input device: MicManager ends the hold the new
// device replaces before opening it, since WebKit keeps one capture at a
// time, and the old input stops under the release. A path that has not
// begun to rise is silent: it comes apart at once, and a lane disarmed while
// its monitor waits to rise lets its input go at once.
//
// A path rises only once its input has settled. A new microphone source
// plays silence until the microphone's samples reach it, 10 to 202 ms after
// the press in headless Chromium, and they begin wherever the waveform is.
// The browser's buffer then runs dry for two quanta about 14 ms in, and in
// 3 of 13 re-arms again 173 to 181 ms after the press, the input stepping
// on either side of each gap. A path already rising carried those steps to
// the singer as clicks, up to 17.6 times the tone's own steepest step. So
// the lane says when its capture first meters a sound (lane-arms.ts
// `listen`), and the path rises from silence a quarter of a second after
// that. An input silent for longer, a muted microphone, comes up after a
// second anyway, so the monitor never stays shut. The wait holds back the
// first rise only: once up, the input plays straight through, no later than
// before. An instrument the page plays has none of a microphone's first
// moments, and its player expects to hear the first note: its monitor
// rises at once (`settled`). Nor has a microphone source another lane's
// monitor heard settle: a lane that joins it while it flows (a second lane,
// a re-arm inside the release, another channel of it) rises at once too,
// and the monitor says when its input has settled (`onSettled`) so the
// source knows it flows (armed-input.ts). A lane that joined the source in
// its first moments waits no settle of its own either: the moment any
// monitor on the source hears it settle, every lane still waiting on it
// rises (`inputSettled`), from silence on the house envelope. A source
// opened afresh keeps its settle.
import type { StudioFxChain } from '@/lib/studio-fx/chain'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { MONITOR_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { STUDIO_CAPTURE_INPUT } from './capture-input'
import type { StudioMonitorMaster, StudioMonitorMasterInput, } from './monitor-master'

/** The house release, and the slack before the nodes come apart. */
const RELEASE_SECONDS = 0.18
const RELEASE_SLACK_SECONDS = 0.06
/** The time constant the path rises and releases on. */
const LEVEL_TIME_CONSTANT = RELEASE_SECONDS / 5
/** How fast a volume or pan the singer sets is reached. */
const MOVE_SECONDS = 0.05
/** How long the input sounds before a path rises on it: past the gaps a new source's first moments hold. */
const SETTLE_MS = 250
/** How long a path waits for the input's first sound before it rises anyway: five times the slowest arrival measured. */
const ARRIVAL_WAIT_MS = 1000

export interface StudioMonitorSound {
  /** The lane is monitored: monitoring is on, or the lane plays an instrument. */
  readonly on: boolean
  /** The lane's effects as it plays them (arrangement-plan.ts `studioLaneSpec`). */
  readonly spec: ChainSpec
  /** Left and right fader gains (graph-lanes.ts `laneGains`); both 0 while the lane is not heard. */
  readonly gains: readonly [number, number]
}

export interface StudioInputMonitorOptions {
  /** The master every monitored input plays through (monitor-master.ts): the path reaches the speakers only through it. */
  readonly master: Pick<StudioMonitorMaster, 'join'>
  /** Timer for taking a released path apart and for the input's settling; injectable for tests. */
  readonly schedule?: (callback: () => void, delayMs: number) => () => void
  /** The input plays cleanly from here on, as an instrument the page plays does, or a source already flowing: a heard path rises at once. */
  readonly settled?: boolean
  /** Told once the input has settled, so lanes that join its source after this rise at once. */
  readonly onSettled?: () => void
}

/** The input through its lane: folded, spread, the chain, the faders, the level that rises and releases, and the master after it. */
interface MonitorPath {
  readonly fold: GainNode
  readonly spread: GainNode
  readonly chain: StudioFxChain
  readonly split: ChannelSplitterNode
  readonly sides: readonly GainNode[]
  readonly merge: ChannelMergerNode
  readonly level: GainNode
  readonly master: StudioMonitorMasterInput
  /** What the sides were last asked for. */
  gains: readonly [number, number]
  /** Its level has begun to rise: from then on it leaves on the release. */
  rose: boolean
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
  options: StudioInputMonitorOptions,
) {
  const schedule = options.schedule ?? defaultSchedule
  let path: MonitorPath | null = null
  /** Stops the take-apart of a path that is releasing; null while it is heard, or there is none. */
  let cancelRemoval: (() => void) | null = null
  let closed = false
  /** Told once the input feeds nothing here (dispose). */
  const silent: (() => void)[] = []
  /** The input has settled, or the wait for its first sound is over: a heard path may rise. */
  let settled = options.settled === true
  /** Ends the settling the input's first sound began. */
  let stopSettling: (() => void) | null = null
  const stopWaiting = settled
    ? () => undefined
    : schedule(() => settle(true), ARRIVAL_WAIT_MS)

  /** The input has settled: a heard path rises now. `tell` says so to the source, when this monitor heard it settle. */
  function settle(tell: boolean): void {
    if (settled) return
    settled = true
    stopWaiting()
    stopSettling?.()
    stopSettling = null
    if (tell) options.onSettled?.()
    if (path !== null && cancelRemoval === null) rise(path)
  }

  /** Raise `heard` from where its level is. */
  function rise(heard: MonitorPath): void {
    heard.rose = true
    glide(context, heard.level.gain, 1, LEVEL_TIME_CONSTANT)
  }

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
    const master = options.master.join(context)
    input.connect(fold)
    fold.connect(spread).connect(chain.input)
    chain.output.connect(split)
    merge.connect(level).connect(master.node)
    return {
      fold,
      spread,
      chain,
      split,
      sides,
      merge,
      level,
      master,
      gains: sound.gains,
      rose: false,
    }
  }

  /** Take the path out of the graph, the input's edge to it first: the input is its arm's; the master goes with the last path. */
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
      gone.master.leave()
    }
    for (const told of silent.splice(0)) told()
  }

  /** Fade the path out on the release, then take it apart; one that never rose is silent, and comes apart at once. */
  function release(): void {
    if (path === null || cancelRemoval !== null) return
    if (!path.rose) {
      takeApart()
      return
    }
    glide(context, path.level.gain, 0, LEVEL_TIME_CONSTANT)
    cancelRemoval = schedule(
      takeApart,
      (RELEASE_SECONDS + RELEASE_SLACK_SECONDS) * 1000,
    )
  }

  /** The path, built afresh or brought back from its release, rising from where it is once the input has settled; as it is while heard. */
  function bringIn(sound: StudioMonitorSound): MonitorPath {
    if (path === null) path = build(sound)
    else if (cancelRemoval !== null) {
      cancelRemoval()
      cancelRemoval = null
    } else return path
    if (settled) rise(path)
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
     * The input's first samples are here: the lane's capture metered a
     * sound. A heard path rises from silence once they have settled, and
     * at once after that; the wait for a silent input is over.
     */
    inputArrived(): void {
      if (closed || settled || stopSettling !== null) return
      stopWaiting()
      stopSettling = schedule(() => settle(true), SETTLE_MS)
    },
    /**
     * The input's source settled under another lane's monitor while this
     * one still waited: a heard path rises now, from silence on the house
     * envelope, and the wait and the settle are over.
     */
    inputSettled(): void {
      if (!closed) settle(false)
    },
    /**
     * Release the path for good. `whenSilent` runs once it has come apart
     * and the input feeds nothing here, at once when nothing was heard (no
     * path, or one that had not begun to rise): until then the input must
     * stay open, or the release is cut.
     */
    dispose(whenSilent?: () => void): void {
      if (!closed) {
        closed = true
        stopWaiting()
        stopSettling?.()
        stopSettling = null
        release()
      }
      if (whenSilent === undefined) return
      if (path === null) whenSilent()
      else silent.push(whenSilent)
    },
  }
}

export type StudioInputMonitor = ReturnType<typeof createStudioInputMonitor>
