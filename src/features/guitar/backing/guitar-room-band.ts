// Guitar room band schedules count-ins and synthesized grooves on the shared room buses.
// ============================================================

import { activateAudioPlayback } from '@/lib/audio-unlock'
import { triggerDrumVoice } from '@/lib/drum-voices'
import type { GuitarVariant } from '@/lib/guitar/guitar-synth'
import { createBassVoice, createGuitarVoice } from '@/lib/guitar/guitar-synth'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { foldIntoLoop } from '@/lib/guitar/loop-span'
import type { MidiTempoChange } from '@/lib/midi-song'
import { createBeatClock } from '@/lib/midi-song'
import type { GuitarSessionAudioGraph } from './guitar-session-audio-graph'
import { createGuitarSessionAudioGraph } from './guitar-session-audio-graph'

export type GuitarRoomBandBeatPhase = 'count-in' | 'exercise'

export const GUITAR_ROOM_BAND_MIN_TEMPO_BPM = 30
export const GUITAR_ROOM_BAND_MAX_TEMPO_BPM = 220

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
  /** Tempo events already scaled so beat zero agrees with `tempoBpm`. */
  tempoChanges?: readonly MidiTempoChange[]
  countInBeats: number
  exerciseBeats: number
  /** Exact score length; defaults to the whole-beat scheduling horizon. */
  durationBeats?: number
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
  /** `scheduledAtSeconds` is the authoritative time on this band's context. */
  onBeat?(
    beatIndex: number,
    phase: GuitarRoomBandBeatPhase,
    scheduledAtSeconds: number,
  ): void
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

/** The exact tempo range every room using this scheduler can rely on. */
export function resolveGuitarRoomBandTempoBpm(tempoBpm: number): number {
  if (!Number.isFinite(tempoBpm)) return 120
  return Math.min(
    GUITAR_ROOM_BAND_MAX_TEMPO_BPM,
    Math.max(GUITAR_ROOM_BAND_MIN_TEMPO_BPM, tempoBpm),
  )
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
  destination: AudioNode,
  note: GuitarRoomBandNote,
  at: number,
  durationSeconds: number,
  variant: GuitarVariant = 'electric',
): void {
  const frequency = 440 * Math.pow(2, (note.midi - 69) / 12)
  if (!Number.isFinite(frequency) || frequency <= 0) return
  const audibleDurationSeconds = Math.max(0.08, durationSeconds)
  const voice =
    variant === 'bass'
      ? createBassVoice(
          graph.context,
          frequency,
          audibleDurationSeconds * 1000,
          at,
        )
      : createGuitarVoice(
          graph.context,
          frequency,
          audibleDurationSeconds * 1000,
          variant,
          at,
        )

  const releaseAt = at + audibleDurationSeconds
  const RELEASE_SECONDS = 0.09
  voice.gain.gain.setValueAtTime(1, releaseAt)
  voice.gain.gain.linearRampToValueAtTime(0.0001, releaseAt + RELEASE_SECONDS)
  voice.gain.connect(destination)

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
  let runOutput: { guide: GainNode; drums: GainNode } | null = null
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
    const output = runOutput
    runOutput = null
    if (output !== null) {
      // Sources already inside Web Audio's lookahead cannot be unscheduled.
      // Disconnect their run-scoped gates so Stop is audibly immediate and a
      // microphone opened next cannot hear the guide pretending to be input.
      const now = context?.currentTime ?? 0
      output.guide.gain.setValueAtTime(0, now)
      output.drums.gain.setValueAtTime(0, now)
      output.guide.disconnect()
      output.drums.disconnect()
    }
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

      const guideOutput = currentGraph.context.createGain()
      const drumsOutput = currentGraph.context.createGain()
      guideOutput.gain.value = 1
      drumsOutput.gain.value = 1
      guideOutput.connect(currentGraph.buses.guide)
      drumsOutput.connect(currentGraph.buses.drums)
      runOutput = { guide: guideOutput, drums: drumsOutput }

      const tempoBpm = resolveGuitarRoomBandTempoBpm(startOptions.tempoBpm)
      const openingBeatSeconds = 60 / tempoBpm
      const beatToSeconds = createBeatClock({
        bpm: tempoBpm,
        tempoChanges: startOptions.tempoChanges,
      })
      const countInBeats = Math.max(0, Math.floor(startOptions.countInBeats))
      const exerciseBeats = Math.max(1, Math.floor(startOptions.exerciseBeats))
      const durationBeats = Number.isFinite(startOptions.durationBeats)
        ? Math.min(
            exerciseBeats,
            Math.max(0, startOptions.durationBeats ?? exerciseBeats),
          )
        : exerciseBeats
      const loop = resolveBandLoop(startOptions.loop, exerciseBeats)
      const feel = startOptions.feel ?? 'groove'
      const notesByBeat = groupNotesByBeat(startOptions.melody ?? [])
      const melodyVariant = startOptions.melodyVariant ?? 'electric'
      const totalBeats = countInBeats + exerciseBeats
      const firstBeatAt = currentGraph.context.currentTime + 0.09
      const firstExerciseAt = firstBeatAt + countInBeats * openingBeatSeconds
      const firstBeatAtMs = performance.now() + 90
      const expectedHitTimesMs = Array.from(
        { length: exerciseBeats },
        (_, index) =>
          firstBeatAtMs +
          countInBeats * openingBeatSeconds * 1000 +
          beatToSeconds(index) * 1000,
      )
      let nextBeat = 0
      let nextBeatAt = firstBeatAt
      let completionScheduled = false

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
          const at = nextBeatAt
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
              drumsOutput,
            )
          } else if (feel === 'click') {
            // Downbeat accented, everything else the same tick. Nothing here
            // suggests a backbeat the score has not asked for.
            triggerDrumVoice(
              'sidestick',
              currentGraph.context,
              at,
              exerciseIndex % 4 === 0 ? 0.82 : 0.5,
              drumsOutput,
            )
          } else {
            triggerDrumVoice(
              exerciseIndex % 4 === 0 ? 'kick' : 'hh-closed',
              currentGraph.context,
              at,
              exerciseIndex % 4 === 0 ? 0.74 : 0.58,
              drumsOutput,
            )
            if (exerciseIndex % 4 === 2) {
              triggerDrumVoice(
                'snare',
                currentGraph.context,
                at,
                0.55,
                drumsOutput,
              )
            }
          }

          if (phase === 'exercise') {
            for (const note of notesByBeat.get(exerciseIndex) ?? []) {
              // Fractional positions inside the beat are kept: an eighth is
              // half a beat late, and quantising it to the beat would teach
              // the wrong rhythm.
              const noteAt =
                at +
                beatToSeconds(note.startBeat) -
                beatToSeconds(exerciseIndex)
              const noteDurationSeconds =
                beatToSeconds(note.startBeat + note.durationBeats) -
                beatToSeconds(note.startBeat)
              soundNote(
                currentGraph,
                guideOutput,
                note,
                noteAt,
                noteDurationSeconds,
                melodyVariant,
              )
            }
          }
          scheduleUiCallback(at, () =>
            startOptions.onBeat?.(
              phase === 'count-in' ? scheduledBeat : exerciseIndex,
              phase,
              at,
            ),
          )
          const beatDurationSeconds =
            phase === 'count-in'
              ? openingBeatSeconds
              : beatToSeconds(exerciseIndex + 1) - beatToSeconds(exerciseIndex)
          nextBeat += 1
          nextBeatAt += beatDurationSeconds
        }

        if (loop === null && nextBeat >= totalBeats && !completionScheduled) {
          completionScheduled = true
          if (interval !== null) window.clearInterval(interval)
          interval = null
          const completeAt = firstExerciseAt + beatToSeconds(durationBeats)
          scheduleUiCallback(completeAt, () => startOptions.onComplete?.())
        }
      }

      schedule()
      if (!completionScheduled) {
        interval = window.setInterval(schedule, schedulerIntervalMs)
      }
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
