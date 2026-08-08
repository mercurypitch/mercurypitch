// Guitar room band schedules count-ins and synthesized grooves on the shared room buses.
// ============================================================

import { activateAudioPlayback } from '@/lib/audio-unlock'
import { triggerDrumVoice } from '@/lib/drum-voices'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { foldIntoLoop } from '@/lib/guitar/loop-span'
import type { GuitarSessionAudioGraph } from './guitar-session-audio-graph'
import { createGuitarSessionAudioGraph } from './guitar-session-audio-graph'

export type GuitarRoomBandBeatPhase = 'count-in' | 'exercise'

export interface GuitarRoomBandStartOptions {
  tempoBpm: number
  countInBeats: number
  exerciseBeats: number
  /**
   * Repeat this half-open span of exercise beats for as long as the room is
   * running. Scheduled as one unbroken pulse rather than restarted per pass —
   * a restart costs the scheduler's lead-in every cycle, which is audible as a
   * hitch exactly where the player is trying to hear the downbeat.
   */
  loop?: LoopSpan | null
  onBeat?(beatIndex: number, phase: GuitarRoomBandBeatPhase): void
  onComplete?(): void
}

export interface GuitarRoomBandStartResult {
  expectedHitTimesMs: readonly number[]
}

export interface GuitarRoomBand {
  start(options: GuitarRoomBandStartOptions): Promise<GuitarRoomBandStartResult>
  /**
   * Bring the audio graph up without scheduling a beat. A room that offers
   * microphone input before the click starts needs a live context to analyse
   * into; `getAudioGraph` stays null until something has opened one.
   */
  activate(): Promise<GuitarSessionAudioGraph | null>
  stop(): void
  getAudioGraph(): GuitarSessionAudioGraph | null
  dispose(): Promise<void>
}

interface GuitarRoomBandOptions {
  contextFactory?: () => AudioContext
  activateContext?: (context: AudioContext) => Promise<void>
  scheduleAheadSeconds?: number
  schedulerIntervalMs?: number
}

/** A loop clamped to beats this exercise actually has, or null if unusable. */
export function resolveBandLoop(
  loop: LoopSpan | null | undefined,
  exerciseBeats: number,
): LoopSpan | null {
  if (loop === null || loop === undefined) return null
  const start = Math.max(0, Math.floor(loop.start))
  const end = Math.min(exerciseBeats, Math.floor(loop.end))
  if (start >= exerciseBeats || end - start < 1) return null
  return { start, end }
}

async function defaultActivateContext(context: AudioContext): Promise<void> {
  await activateAudioPlayback({
    getAudioContext: () => context,
    init: async () => undefined,
    resume: async () => context.resume(),
  })
}

export function createGuitarRoomBand(
  options: GuitarRoomBandOptions = {},
): GuitarRoomBand {
  const createContext =
    options.contextFactory ??
    (() => new AudioContext({ latencyHint: 'interactive' }))
  const activateContext = options.activateContext ?? defaultActivateContext
  const scheduleAheadSeconds = options.scheduleAheadSeconds ?? 0.12
  const schedulerIntervalMs = options.schedulerIntervalMs ?? 24

  let context: AudioContext | null = null
  let graph: GuitarSessionAudioGraph | null = null
  let interval: number | null = null
  let generation = 0
  const callbackTimers = new Set<number>()

  const ensureGraph = (): GuitarSessionAudioGraph => {
    if (graph !== null) return graph
    const createdContext = createContext()
    context = createdContext
    graph = createGuitarSessionAudioGraph(createdContext, {
      masterLevel: 0.76,
      busLevels: { drums: 0.72 },
    })
    return graph
  }

  const clearTimers = (): void => {
    if (interval !== null) window.clearInterval(interval)
    interval = null
    for (const timer of callbackTimers) window.clearTimeout(timer)
    callbackTimers.clear()
  }

  const stop = (): void => {
    generation += 1
    clearTimers()
  }

  return {
    async activate() {
      const currentGraph = ensureGraph()
      try {
        await activateContext(currentGraph.context)
      } catch {
        return null
      }
      return currentGraph
    },

    async start(startOptions) {
      stop()
      const currentGeneration = generation
      const currentGraph = ensureGraph()
      await activateContext(currentGraph.context)
      if (currentGeneration !== generation) {
        return { expectedHitTimesMs: [] }
      }

      const beatSeconds =
        60 / Math.min(200, Math.max(30, startOptions.tempoBpm))
      const countInBeats = Math.max(0, Math.floor(startOptions.countInBeats))
      const exerciseBeats = Math.max(1, Math.floor(startOptions.exerciseBeats))
      const loop = resolveBandLoop(startOptions.loop, exerciseBeats)
      const totalBeats = countInBeats + exerciseBeats
      const firstBeatAt = currentGraph.context.currentTime + 0.09
      const firstBeatAtMs = performance.now() + 90
      const expectedHitTimesMs = Array.from(
        { length: exerciseBeats },
        (_, index) =>
          firstBeatAtMs + (countInBeats + index) * beatSeconds * 1000,
      )
      let nextBeat = 0

      const scheduleUiCallback = (at: number, callback: () => void): void => {
        const delay = Math.max(
          0,
          (at - currentGraph.context.currentTime) * 1000,
        )
        const timer = window.setTimeout(() => {
          callbackTimers.delete(timer)
          if (currentGeneration === generation) callback()
        }, delay)
        callbackTimers.add(timer)
      }

      const schedule = (): void => {
        while (loop !== null || nextBeat < totalBeats) {
          const at = firstBeatAt + nextBeat * beatSeconds
          if (at > currentGraph.context.currentTime + scheduleAheadSeconds) {
            break
          }
          const scheduledBeat = nextBeat
          const phase: GuitarRoomBandBeatPhase =
            scheduledBeat < countInBeats ? 'count-in' : 'exercise'
          // The slot index only ever grows; a loop folds it back onto the
          // beats being repeated, so the pulse never pauses to restart.
          const exerciseIndex = foldIntoLoop(scheduledBeat - countInBeats, loop)
          if (phase === 'count-in') {
            triggerDrumVoice(
              'sidestick',
              currentGraph.context,
              at,
              nextBeat === countInBeats - 1 ? 0.9 : 0.68,
              currentGraph.buses.drums,
            )
          } else {
            triggerDrumVoice(
              exerciseIndex % 4 === 0 ? 'kick' : 'hh-closed',
              currentGraph.context,
              at,
              exerciseIndex % 4 === 0 ? 0.74 : 0.58,
              currentGraph.buses.drums,
            )
            if (exerciseIndex % 4 === 2) {
              triggerDrumVoice(
                'snare',
                currentGraph.context,
                at,
                0.55,
                currentGraph.buses.drums,
              )
            }
          }
          scheduleUiCallback(at, () =>
            startOptions.onBeat?.(
              phase === 'count-in' ? scheduledBeat : exerciseIndex,
              phase,
            ),
          )
          nextBeat += 1
        }

        if (loop === null && nextBeat >= totalBeats) {
          if (interval !== null) window.clearInterval(interval)
          interval = null
          const completeAt = firstBeatAt + totalBeats * beatSeconds
          scheduleUiCallback(completeAt, () => startOptions.onComplete?.())
        }
      }

      schedule()
      interval = window.setInterval(schedule, schedulerIntervalMs)
      return { expectedHitTimesMs }
    },
    stop,
    getAudioGraph: () => graph,
    async dispose() {
      stop()
      graph?.dispose()
      graph = null
      const ownedContext = context
      context = null
      if (ownedContext !== null && ownedContext.state !== 'closed') {
        await ownedContext.close()
      }
    },
  }
}
