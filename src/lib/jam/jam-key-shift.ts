// ============================================================
// Jam key shift — each peer moves its own audio to the room's key
// ============================================================
//
// The host sets the room's key, and it travels with the song's manifest
// (see jam-song.ts). Every peer runs its own backing track and guide vocal
// through a key graph (lib/key-shift/key-shift-graph.ts): the backing on
// the pitched bus, the guide on the vocal bus, which keeps its formants. At
// the original key the graph goes straight through.
//
// The graph is made once per AudioContext, the first time the backing or
// the guide asks where to connect, and is told whatever state it missed.
//
// What is heard trails the element's clock by the shifter latency, so the
// stage draws the words and the lanes that much later while the song plays
// (heardPositionSec).

import type { KeyShiftGraph, KeyShiftState, } from '@/lib/key-shift/key-shift-graph'
import { createKeyShiftGraph } from '@/lib/key-shift/key-shift-graph'
import type { PitchShiftPreset } from '@/lib/key-shift/pitch-shift-node'

export interface JamKeyShiftDeps {
  preset: PitchShiftPreset
  /**
   * This device plays the original key from now on: the engine failed to
   * load (with the error), or it cannot run here at all (without one).
   * Called once.
   */
  onUnavailable: (error?: unknown) => void
  createGraph?: typeof createKeyShiftGraph
}

export interface JamKeyShift {
  /** Where the backing track's envelope connects. */
  backingOutput: (ctx: AudioContext) => AudioNode
  /** Where the guide vocal's level connects. */
  guideOutput: (ctx: AudioContext) => AudioNode
  apply: (state: KeyShiftState) => void
  /** 0 while bypassed. */
  latencySec: () => number
  /** The shift the audio is under right now; 0 while bypassed. */
  shiftSemitones: () => number
  available: () => boolean
  dispose: () => void
}

export function createJamKeyShift(deps: JamKeyShiftDeps): JamKeyShift {
  const create = deps.createGraph ?? createKeyShiftGraph
  let graph: KeyShiftGraph | null = null
  let graphContext: AudioContext | null = null
  let desired: KeyShiftState | null = null
  let available = typeof AudioWorkletNode !== 'undefined'

  const unavailable = (error?: unknown) => {
    if (!available) return
    available = false
    deps.onUnavailable(error)
  }

  /** Null when no graph can be made here: the audio then goes straight
   *  to the speakers, in the original key. */
  const graphFor = (ctx: AudioContext): KeyShiftGraph | null => {
    if (graph !== null && graphContext === ctx) return graph
    graph?.dispose()
    graph = null
    graphContext = ctx
    let made: KeyShiftGraph
    try {
      made = create(ctx, ctx.destination, {
        preset: deps.preset,
        onError: unavailable,
      })
    } catch (error) {
      unavailable(error)
      return null
    }
    graph = made
    if (!made.available()) unavailable()
    if (desired !== null) void made.apply(desired)
    return made
  }

  return {
    backingOutput: (ctx) => graphFor(ctx)?.input('pitched') ?? ctx.destination,
    guideOutput: (ctx) => graphFor(ctx)?.input('vocal') ?? ctx.destination,
    apply(state) {
      desired = state
      if (graph !== null) void graph.apply(state)
    },
    latencySec: () => graph?.latencySec() ?? 0,
    shiftSemitones: () => graph?.shiftSemitones() ?? 0,
    available: () => available,
    dispose() {
      graph?.dispose()
      graph = null
      graphContext = null
    },
  }
}

/**
 * The key this device plays, and so the one to draw, score and tell the key
 * graph: the room's once the backing goes through the graph, the original
 * until then -- a backing still playing natively is in its original key,
 * and a guide shifted over it would be a second key at once.
 */
export function heardRoomKey(
  roomKey: number,
  device: { available: boolean; backingInGraph: boolean },
): number {
  return device.available && device.backingInGraph ? roomKey : 0
}

/**
 * Where the singer is in the song: the element's position, less the
 * shifter's latency while the song is sounding. Paused, nothing is in the
 * shifter, so a line clicked lands on that line and not on the tail of the
 * one before it.
 */
export function heardPositionSec(
  positionSec: number,
  latencySec: number,
  playing: boolean,
): number {
  return playing ? Math.max(0, positionSec - latencySec) : positionSec
}
