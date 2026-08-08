// Guitar room band schedules count-ins and synthesized grooves on the shared room buses.
// ============================================================

import { activateAudioPlayback } from '@/lib/audio-unlock'
import { triggerDrumVoice } from '@/lib/drum-voices'
import type { GuitarVariant } from '@/lib/guitar/guitar-synth'
import { createBassVoice, createGuitarVoice } from '@/lib/guitar/guitar-synth'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { foldIntoLoop } from '@/lib/guitar/loop-span'
import type { GuitarSessionAudioGraph } from './guitar-session-audio-graph'
import { createGuitarSessionAudioGraph } from './guitar-session-audio-graph'

export type GuitarRoomBandBeatPhase = 'count-in' | 'exercise'

/**
 * What the band plays under the player.
 *
 * `groove` is a drum kit keeping a feel, which is right when a real recording
 * is the thing being played along to. `click` is a bare pulse, which is right
 * when a written score is: a kit implies an arrangement, and a tab on its own
 * is not evidence of one.
 */
export type GuitarRoomBandFeel = 'groove' | 'click'

/** One note of the score, positioned in exercise beats. */
export interface GuitarRoomBandNote {
  midi: number
  startBeat: number
  durationBeats: number
}

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
  /** Defaults to the drum groove, which is what the play-along room wants. */
  feel?: GuitarRoomBandFeel
  /**
   * Sound the score itself, not only time. Without this a tab room shows notes
   * falling and plays something unrelated underneath, which is the opposite of
   * rehearsing a part.
   */
  melody?: readonly GuitarRoomBandNote[]
  melodyVariant?: GuitarVariant
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

/**
 * Score notes bucketed by the whole beat they start in. Built once per take:
 * the scheduler runs every few milliseconds and must not scan the whole score
 * each time, and a loop revisits the same beats over and over.
 */
export function groupNotesByBeat(
  melody: readonly GuitarRoomBandNote[],
): Map<number, GuitarRoomBandNote[]> {
  const byBeat = new Map<number, GuitarRoomBandNote[]>()
  for (const note of melody) {
    if (!Number.isFinite(note.startBeat) || note.startBeat < 0) continue
    const beat = Math.floor(note.startBeat)
    const bucket = byBeat.get(beat)
    if (bucket === undefined) byBeat.set(beat, [note])
    else bucket.push(note)
  }
  return byBeat
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

/**
 * Strike one string of the score at a scheduled time.
 *
 * The pluck model rings for a couple of seconds whatever the written length,
 * which is true of a real string and wrong for a fast line — sixteen notes
 * would pile into a chord nobody wrote. So the voice is released over the
 * note's own length, with a short fade rather than a cut, because a hard stop
 * on a ringing string is a click.
 */
function soundNote(
  graph: GuitarSessionAudioGraph,
  note: GuitarRoomBandNote,
  at: number,
  beatSeconds: number,
  variant: GuitarVariant = 'electric',
): void {
  const frequency = 440 * Math.pow(2, (note.midi - 69) / 12)
  if (!Number.isFinite(frequency) || frequency <= 0) return
  const durationSeconds = Math.max(0.08, note.durationBeats * beatSeconds)
  const voice =
    variant === 'bass'
      ? createBassVoice(graph.context, frequency, durationSeconds * 1000, at)
      : createGuitarVoice(
          graph.context,
          frequency,
          durationSeconds * 1000,
          variant,
          at,
        )

  const releaseAt = at + durationSeconds
  const RELEASE_SECONDS = 0.09
  voice.gain.gain.setValueAtTime(1, releaseAt)
  voice.gain.gain.linearRampToValueAtTime(0.0001, releaseAt + RELEASE_SECONDS)
  voice.gain.connect(graph.buses.guide)

  const disposeIn =
    (releaseAt + RELEASE_SECONDS - graph.context.currentTime) * 1000
  window.setTimeout(() => voice.dispose(), Math.max(0, disposeIn) + 60)
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
      const feel = startOptions.feel ?? 'groove'
      const notesByBeat = groupNotesByBeat(startOptions.melody ?? [])
      const melodyVariant = startOptions.melodyVariant ?? 'electric'
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
          } else if (feel === 'click') {
            // Downbeat accented, everything else the same tick. Nothing here
            // suggests a backbeat the score has not asked for.
            triggerDrumVoice(
              'sidestick',
              currentGraph.context,
              at,
              exerciseIndex % 4 === 0 ? 0.82 : 0.5,
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

          if (phase === 'exercise') {
            for (const note of notesByBeat.get(exerciseIndex) ?? []) {
              // Fractional positions inside the beat are kept: an eighth is
              // half a beat late, and quantising it to the beat would teach
              // the wrong rhythm.
              const noteAt = at + (note.startBeat - exerciseIndex) * beatSeconds
              soundNote(currentGraph, note, noteAt, beatSeconds, melodyVariant)
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
