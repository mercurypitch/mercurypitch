// ============================================================
// Stem key control — keeps the key graph in step with the mixer
// ============================================================
//
// The audio controller owns the AudioContext, the sources and the clock; this
// owns what the key shifter is told. It turns the singer's key, the playback
// speed, Pitch Studio's suspension and the guide vocal's audibility into one
// KeyShiftState and re-applies it whenever any of them changes. Speed is
// compensated here: the shifter runs at key − 12·log2(speed), so speed changes
// only the tempo. Pitch Studio edits the song's own notes, so it hears the
// original key — at any speed.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js'
import { clampKeyShift, shifterSemitones } from '@/lib/key-shift/key-shift'
import type { KeyShiftBus, KeyShiftGraph, KeyShiftState, } from '@/lib/key-shift/key-shift-graph'
import { createKeyShiftGraph } from '@/lib/key-shift/key-shift-graph'
import type { PitchShiftPreset } from '@/lib/key-shift/pitch-shift-node'

export function busForTrack(label: string, keepDrums: boolean): KeyShiftBus {
  if (label === 'Vocal') return 'vocal'
  if (label === 'Drums' && keepDrums) return 'unpitched'
  return 'pitched'
}

export interface StemKeyControlDeps {
  keyShift: Accessor<number>
  /** Pitch Studio: play the song's own key. */
  suspended: Accessor<boolean>
  vocalAudible: Accessor<boolean>
  speed: Accessor<number>
  playing: Accessor<boolean>
  keepDrums: Accessor<boolean>
  preset: PitchShiftPreset
  /** The engine failed to load; the song keeps its original key. */
  onUnavailable: (error: unknown) => void
  createGraph?: typeof createKeyShiftGraph
}

export interface StemKeyControl {
  /** Once per AudioContext, ahead of the first source. */
  attach(ctx: AudioContext, destination: AudioNode): void
  /** Where a track connects; null before attach (use the destination). */
  busFor(label: string): AudioNode | null
  latencySec(): number
  /** The shift the audio is under now, for the reference pitch. */
  shiftSemitones(): number
  available: Accessor<boolean>
  /** The key the listener hears: 0 in Pitch Studio or without the engine. */
  appliedKey: Accessor<number>
  dispose(): void
}

export function createStemKeyControl(deps: StemKeyControlDeps): StemKeyControl {
  const create = deps.createGraph ?? createKeyShiftGraph
  const [graph, setGraph] = createSignal<KeyShiftGraph | null>(null)
  const [available, setAvailable] = createSignal(
    typeof AudioWorkletNode !== 'undefined',
  )
  let attachedTo: AudioContext | null = null

  // Not a memo: a memo reads its inputs as it is made, and the mixer makes
  // this before Pitch Studio's controller (which owns `suspended`) exists.
  const appliedKey = () =>
    available() && !deps.suspended() ? clampKeyShift(deps.keyShift()) : 0

  const state = (): KeyShiftState => {
    const key = deps.suspended() ? 0 : clampKeyShift(deps.keyShift())
    return {
      semitones: shifterSemitones(key, deps.speed()),
      vocalAudible: deps.vocalAudible(),
      // Decides whether a re-route dips. Re-applied on play and pause, which
      // costs nothing on an unchanged route, so a shifter that finishes
      // loading after play was pressed still fades in.
      playing: deps.playing(),
    }
  }

  createEffect(() => {
    const next = state()
    const current = graph()
    if (current !== null) void current.apply(next)
  })

  const dispose = () => {
    untrack(graph)?.dispose()
    setGraph(null)
    attachedTo = null
  }
  onCleanup(dispose)

  return {
    attach(ctx, destination) {
      if (attachedTo === ctx) return
      dispose()
      attachedTo = ctx
      const created = create(ctx, destination, {
        preset: deps.preset,
        onError: (error) => {
          setAvailable(false)
          deps.onUnavailable(error)
        },
      })
      setAvailable(created.available())
      setGraph(created)
    },
    busFor(label) {
      const current = untrack(graph)
      return current === null
        ? null
        : current.input(busForTrack(label, untrack(deps.keepDrums)))
    },
    latencySec: () => untrack(graph)?.latencySec() ?? 0,
    shiftSemitones: () => untrack(graph)?.shiftSemitones() ?? 0,
    available,
    appliedKey,
    dispose,
  }
}
