// ============================================================
// Key shift graph — routes audio buses through the key shifter
// ============================================================
//
// Three buses:
//   - pitched:   everything that moves with the key → shifter P;
//   - vocal:     a guide vocal → shifter V (formant compensation), only
//                while it is audible; a muted guide's shifter idles on
//                silence, which the engine skips;
//   - unpitched: what stays put (drums, when the setting says so) → a
//                DelayNode of the shifter latency, so it stays in time.
// At 0 semitones every bus goes straight to the output: no shifter, no delay.
// The karaoke mixer feeds it its stems (see stem-key-control.ts); a Jam room
// its backing track and guide vocal.
//
// De-click. A re-route while playing ramps the output to 0 over 15 ms,
// switches, holds it silent for the shifter latency, then ramps back over
// 15 ms. The hold matters even when paused: a worklet that was disconnected
// may not have been pulled since (browsers differ) and can still hold its
// last L seconds of old audio, which would otherwise come out first. A guide
// vocal that returns is held the same way on its own bus gain, so the rest
// of the mix keeps playing.
//
// Moving the shift while already shifted goes straight to the engine: its
// overlap-add already crossfades between frames, and a dip there would drop
// the whole mix for 150 ms on every key press.

import type { PitchShifter, PitchShiftPreset } from './pitch-shift-node'
import { canShiftPitch, createPitchShifter } from './pitch-shift-node'

export type KeyShiftBus = 'pitched' | 'vocal' | 'unpitched'

export interface KeyShiftState {
  /** What the shifter must do: the key shift, speed compensation included. */
  semitones: number
  vocalAudible: boolean
  playing: boolean
}

export interface KeyShiftGraph {
  input(bus: KeyShiftBus): AudioNode
  /** Never rejects; an engine failure leaves the graph bypassed. */
  apply(state: KeyShiftState): Promise<void>
  /** 0 while bypassed. */
  latencySec(): number
  /** The shift the audio is under right now; 0 while bypassed. */
  shiftSemitones(): number
  /** False without AudioWorklet, or once the engine failed to load. */
  available(): boolean
  dispose(): void
}

export interface KeyShiftGraphOptions {
  preset: PitchShiftPreset
  formantBaseHz?: () => number
  onError?: (error: unknown) => void
  createShifter?: typeof createPitchShifter
}

const DIP_SEC = 0.015
// setTimeout runs on the main thread's clock, not the audio clock.
const SWITCH_SLACK_MS = 10
const MAX_DELAY_SEC = 1
const SHIFT_EPSILON = 1e-6

interface Shifters {
  pitched: PitchShifter
  vocal: PitchShifter
  vocalOut: GainNode
  delay: DelayNode
  latencySec: number
}

type Route =
  | { shifted: false }
  | { shifted: true; semitones: number; vocal: boolean }

interface Sleeper {
  timer: ReturnType<typeof setTimeout>
  resolve: () => void
}

export function createKeyShiftGraph(
  ctx: AudioContext,
  destination: AudioNode,
  options: KeyShiftGraphOptions,
): KeyShiftGraph {
  const pitchedIn = ctx.createGain()
  const vocalIn = ctx.createGain()
  const unpitchedIn = ctx.createGain()
  const output = ctx.createGain()
  const inputs = [pitchedIn, vocalIn, unpitchedIn]
  output.connect(destination)
  for (const input of inputs) input.connect(output)

  let route: Route = { shifted: false }
  let bypassEdges = true
  let shiftedEdges = false
  let vocalEdges = false
  let shifters: Shifters | null = null
  let failed = !canShiftPitch(ctx)
  let disposed = false
  let desired: KeyShiftState = {
    semitones: 0,
    vocalAudible: true,
    playing: false,
  }
  let chain: Promise<void> = Promise.resolve()
  const sleepers = new Set<Sleeper>()

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const sleeper: Sleeper = {
        timer: setTimeout(() => {
          sleepers.delete(sleeper)
          resolve()
        }, ms),
        resolve,
      }
      sleepers.add(sleeper)
    })
  }

  // Waits until the audio clock has passed `time`; a suspended context
  // (where nothing is audible anyway) gives up after a few tries.
  async function waitForContextTime(time: number): Promise<void> {
    for (let tries = 0; tries < 10 && ctx.currentTime < time; tries++) {
      await sleep(
        Math.max(1, (time - ctx.currentTime) * 1000) + SWITCH_SLACK_MS,
      )
      if (disposed) return
    }
  }

  function setBypassEdges(on: boolean): void {
    if (on === bypassEdges) return
    for (const input of inputs) {
      if (on) input.connect(output)
      else input.disconnect(output)
    }
    bypassEdges = on
  }

  function setShiftedEdges(on: boolean, set: Shifters): void {
    if (on === shiftedEdges) return
    if (on) {
      pitchedIn.connect(set.pitched.node)
      set.pitched.node.connect(output)
      unpitchedIn.connect(set.delay)
      set.delay.connect(output)
    } else {
      pitchedIn.disconnect(set.pitched.node)
      set.pitched.node.disconnect(output)
      unpitchedIn.disconnect(set.delay)
      set.delay.disconnect(output)
    }
    shiftedEdges = on
  }

  // Out of the path, the shifter can still be run -- Chromium keeps pulling
  // a worklet whose output is disconnected -- but with nothing coming in it
  // is fed silence, which the engine skips (workers/pitch-shift-live-input.ts).
  function setVocalEdges(on: boolean, set: Shifters): void {
    if (on === vocalEdges) return
    if (on) {
      vocalIn.connect(set.vocal.node)
      set.vocal.node.connect(set.vocalOut)
    } else {
      vocalIn.disconnect(set.vocal.node)
      set.vocal.node.disconnect(set.vocalOut)
    }
    vocalEdges = on
  }

  // Silent now, silent for `holdSec`, then up over 15 ms.
  function holdThenOpen(param: AudioParam, holdSec: number): void {
    const now = ctx.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(0, now)
    param.setValueAtTime(0, now + holdSec)
    param.linearRampToValueAtTime(1, now + holdSec + DIP_SEC)
  }

  async function fadeOut(param: AudioParam): Promise<void> {
    const now = ctx.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(0, now + DIP_SEC)
    await waitForContextTime(now + DIP_SEC)
  }

  // `atContextTime` is when the change should be HEARD. Audio entering the
  // shifter now comes out L later, so a change scheduled at now + L lands on
  // the audio that was played after it — after a speed change, the first
  // audio at the new rate.
  function setSemitones(
    set: Shifters,
    semitones: number,
    atContextTime?: number,
  ): void {
    set.pitched.setSemitones(semitones, atContextTime)
    set.vocal.setSemitones(semitones, atContextTime)
  }

  async function switchVocal(
    set: Shifters,
    on: boolean,
    playing: boolean,
  ): Promise<void> {
    if (on) {
      setVocalEdges(true, set)
      holdThenOpen(set.vocalOut.gain, set.latencySec)
      return
    }
    if (playing) await fadeOut(set.vocalOut.gain)
    if (!disposed) setVocalEdges(false, set)
  }

  async function reroute(next: Route, playing: boolean): Promise<void> {
    if (playing) await fadeOut(output.gain)
    if (disposed) return
    const set = shifters
    if (next.shifted && set !== null) {
      setSemitones(set, next.semitones)
      setShiftedEdges(true, set)
      setVocalEdges(next.vocal, set)
      set.vocalOut.gain.cancelScheduledValues(ctx.currentTime)
      set.vocalOut.gain.setValueAtTime(1, ctx.currentTime)
      setBypassEdges(false)
      route = next
      holdThenOpen(output.gain, set.latencySec)
      return
    }
    setBypassEdges(true)
    if (set !== null) {
      setShiftedEdges(false, set)
      setVocalEdges(false, set)
    }
    route = { shifted: false }
    holdThenOpen(output.gain, 0)
  }

  async function transition(next: Route, playing: boolean): Promise<void> {
    const from = route
    const set = shifters
    if (from.shifted && next.shifted && set !== null) {
      if (from.semitones !== next.semitones)
        setSemitones(set, next.semitones, ctx.currentTime + set.latencySec)
      route = next
      if (from.vocal !== next.vocal) await switchVocal(set, next.vocal, playing)
      return
    }
    if (from.shifted === next.shifted) return
    await reroute(next, playing)
  }

  async function loadShifters(): Promise<Shifters> {
    const create = options.createShifter ?? createPitchShifter
    const [pitched, vocal] = await Promise.allSettled([
      create(ctx, { formantCompensation: false, preset: options.preset }),
      create(ctx, {
        formantCompensation: true,
        formantBaseHz: options.formantBaseHz?.() ?? 0,
        preset: options.preset,
      }),
    ])
    if (pitched.status === 'fulfilled' && vocal.status === 'fulfilled') {
      const vocalOut = ctx.createGain()
      vocalOut.connect(output)
      const delay = ctx.createDelay(MAX_DELAY_SEC)
      const latencySec = pitched.value.latencySec
      delay.delayTime.value = latencySec
      return {
        pitched: pitched.value,
        vocal: vocal.value,
        vocalOut,
        delay,
        latencySec,
      }
    }
    // One engine without the other is no use: release whichever started.
    if (pitched.status === 'fulfilled') pitched.value.dispose()
    if (vocal.status === 'fulfilled') vocal.value.dispose()
    throw pitched.status === 'rejected'
      ? pitched.reason
      : vocal.status === 'rejected'
        ? vocal.reason
        : new Error('The key-change engine did not start.')
  }

  function release(set: Shifters): void {
    set.pitched.dispose()
    set.vocal.dispose()
    set.vocalOut.disconnect()
    set.delay.disconnect()
  }

  function wantsShift(state: KeyShiftState): boolean {
    return !failed && Math.abs(state.semitones) > SHIFT_EPSILON
  }

  function fail(error: unknown): void {
    if (failed) return
    failed = true
    options.onError?.(error)
  }

  async function step(): Promise<void> {
    if (disposed) return
    if (wantsShift(desired) && shifters === null) {
      try {
        const loaded = await loadShifters()
        if (disposed) {
          release(loaded)
          return
        }
        shifters = loaded
      } catch (error) {
        fail(error)
      }
    }
    // Re-read: requests that arrived while the engine loaded win.
    const want = desired
    const next: Route =
      wantsShift(want) && shifters !== null
        ? { shifted: true, semitones: want.semitones, vocal: want.vocalAudible }
        : { shifted: false }
    await transition(next, want.playing)
  }

  return {
    input(bus) {
      if (bus === 'vocal') return vocalIn
      if (bus === 'unpitched') return unpitchedIn
      return pitchedIn
    },
    apply(state) {
      desired = state
      const run = chain.then(step).catch((error: unknown) => {
        fail(error)
        if (!disposed) void reroute({ shifted: false }, false)
      })
      chain = run
      return run
    },
    latencySec() {
      return route.shifted && shifters !== null ? shifters.latencySec : 0
    },
    shiftSemitones() {
      return route.shifted ? route.semitones : 0
    },
    available() {
      return !failed
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const sleeper of sleepers) {
        clearTimeout(sleeper.timer)
        sleeper.resolve()
      }
      sleepers.clear()
      for (const input of inputs) input.disconnect()
      output.disconnect()
      if (shifters !== null) release(shifters)
      shifters = null
    },
  }
}
