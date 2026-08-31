// Guitar room band schedules count-ins and synthesized grooves on the shared room buses.
// ============================================================

import type { DrumKitPlayerPort } from '@/features/drum-night/runtime/drum-runtime-types'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import { triggerDrumVoice } from '@/lib/drum-voices'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarVariant } from '@/lib/guitar/guitar-synth'
import { createBassVoice, createGuitarVoice } from '@/lib/guitar/guitar-synth'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { foldIntoLoop } from '@/lib/guitar/loop-span'
import type { MidiTempoChange } from '@/lib/midi-song'
import { createBeatClock } from '@/lib/midi-song'
import { sliderToGain } from '@/lib/volume-curve'
import type { GuitarRoomRhythmPreset } from './guitar-room-rhythm'
import { guitarRoomRhythmHitsForBeat } from './guitar-room-rhythm'
import type { GuitarGuideInput, GuitarSessionAudioGraph, } from './guitar-session-audio-graph'
import { createGuitarSessionAudioGraph, setGuitarSessionGainTarget, } from './guitar-session-audio-graph'

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
  /**
   * The timbre this note is sounded with, when it differs from the run's. A
   * room sounding several parts at once has a bass line and four guitars in
   * one list; one variant for the lot would play the guitars on a bass.
   */
  variant?: GuitarVariant
  /** A stable mix lane, so a part can be muted without restarting the room. */
  channelId?: string
}

/** One authored drum attack, kept separate from pitched score notes. */
export interface GuitarRoomBandPercussionHit {
  /** Source track identity retained so one part can be muted on the live bus. */
  trackId: string
  /** Bounded General MIDI percussion identity, never a sounding pitch. */
  gmKey: number
  startBeat: number
  /** Authored attack intensity, 1–127. */
  velocity: number
  /** Stable imported-event identity retained at the shared kit boundary. */
  sourceId?: string
}

/** One exercise pulse exposed while it is inside the Web Audio look-ahead. */
export interface GuitarRoomBandScheduledBeat {
  beatIndex: number
  iteration: number
  scheduledAtSeconds: number
  expectedAtPerformanceMs: number
}

export interface GuitarRoomBandStartOptions {
  tempoBpm: number
  /** Tempo events already scaled so beat zero agrees with `tempoBpm`. */
  tempoChanges?: readonly MidiTempoChange[]
  countInBeats: number
  exerciseBeats: number
  /** Exact authored beat where this run begins. Defaults to beat zero. */
  startBeat?: number
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
  /** A tempo-free semantic rhythm rendered through this room's drum bus. */
  rhythmPreset?: GuitarRoomRhythmPreset
  /** Resolve one pinned rhythm at the beginning of each gapless loop lap. */
  rhythmPresetForIteration?(
    iteration: number,
    previousPreset: GuitarRoomRhythmPreset | null,
  ): GuitarRoomRhythmPreset
  /** Announced on the audible boundary, never when look-ahead first queues it. */
  onRhythmPreset?(
    preset: GuitarRoomRhythmPreset,
    iteration: number,
    scheduledAtSeconds: number,
  ): void
  /** Called for lap zero and every later loop boundary on the audible clock. */
  onLoopIteration?(iteration: number, scheduledAtSeconds: number): void
  /**
   * Immediate timing evidence for input matching. Increasing this value also
   * widens this run's scheduling horizon so early hits inside the named window
   * are already known to the controller.
   */
  inputTimingWindowMs?: number
  onExerciseBeatScheduled?(beat: GuitarRoomBandScheduledBeat): void
  /**
   * Keep the count-in audible while leaving the exercise itself silent. This
   * is the assessed-microphone path: sounding a click into an open microphone
   * would turn the room's own pulse into player evidence.
   */
  /**
   * Whether the room's own pulse is audible under the exercise.
   *
   * A function is read on every beat, so a reader can quiet the click while it
   * is ticking — which is the only moment anybody wants to. A plain boolean is
   * still accepted and still means "settled when the run started".
   */
  exercisePulse?: boolean | (() => boolean)
  /**
   * Sound the score itself, not only time. Without this a tab room shows notes
   * falling and plays something unrelated underneath, which is the opposite of
   * rehearsing a part.
   */
  melody?: readonly GuitarRoomBandNote[]
  /** Authored one-shot drums, scheduled on the same score clock as melody. */
  percussion?: readonly GuitarRoomBandPercussionHit[]
  /** Initial live-bus state. Omitted means every supplied drum track sounds. */
  audiblePercussionTrackIds?: readonly string[]
  melodyVariant?: GuitarVariant
  /** `scheduledAtSeconds` is the authoritative time on this band's context. */
  onBeat?(
    beatIndex: number,
    phase: GuitarRoomBandBeatPhase,
    scheduledAtSeconds: number,
  ): void
  /** Exact score epoch, including when a run starts between metronome beats. */
  onExerciseStart?(startBeat: number, scheduledAtSeconds: number): void
  /** Exact scheduled end on the band's AudioContext clock. */
  onComplete?(scheduledAtSeconds: number): void
}

export interface GuitarRoomBandStartResult {
  expectedHitTimesMs: readonly number[]
  /** Exact scheduled start on the band's AudioContext clock. */
  exerciseStartedAtSeconds: number | null
  /** Exact scheduled end; null for a cancelled or intentionally looping run. */
  completedAtSeconds: number | null
}

export interface GuitarRoomBand {
  start(options: GuitarRoomBandStartOptions): Promise<GuitarRoomBandStartResult>
  /** Change one authored drum part's run-scoped gate without restarting time. */
  setPercussionTrackAudible(trackId: string, audible: boolean): void
  /**
   * Bring the audio graph up without scheduling a beat. A room that offers
   * microphone input before the click starts needs a live context to analyse
   * into; `getAudioGraph` stays null until something has opened one.
   */
  activate(): Promise<GuitarSessionAudioGraph | null>
  /** Persisted room position, applied before audio opens and while it runs. */
  setMasterLevel(position: number): void
  /** Persisted amp state, seeded before activation and smoothed while live. */
  setElectricAmpParameters(parameters: GuitarElectricAmpParameters): void
  /** A live, pop-free gain gate for one authored melody lane. */
  setMelodyChannelLevel(channelId: string, position: number): void
  stop(): void
  getAudioGraph(): GuitarSessionAudioGraph | null
  dispose(): Promise<void>
}

export interface GuitarRoomBandPercussionPlayerOptions {
  getAudioContext(): AudioContext | null
  getOutput(): AudioNode | null
}

export interface GuitarRoomBandOptions {
  contextFactory?: () => AudioContext
  activateContext?: (context: AudioContext) => Promise<void>
  /**
   * Injected for tests and future Guitar-specific kit preferences. The default
   * is the zero-download Mercury Synth manifest; sampled kits remain lazy.
   */
  createPercussionPlayer?: (
    options: GuitarRoomBandPercussionPlayerOptions,
  ) => DrumKitPlayerPort
  scheduleAheadSeconds?: number
  schedulerIntervalMs?: number
}

/**
 * Keep the shared kit implementation out of pitched-only Guitar rooms. The
 * first authored drum run imports and activates it inside the same user
 * gesture; construction and first paint remain inert.
 */
function createLazyMercurySynthPlayer(
  options: GuitarRoomBandPercussionPlayerOptions,
): DrumKitPlayerPort {
  let player: DrumKitPlayerPort | null = null
  let activation: Promise<boolean> | null = null
  let disposed = false

  return {
    async activate(): Promise<boolean> {
      if (disposed) return false
      if (activation !== null) return await activation
      if (player !== null) return await player.activate()
      const pendingActivation = (async () => {
        const module =
          await import('@/features/drum-night/audio/drum-kit-player')
        if (disposed) return false
        const created = module.createDrumKitPlayer({
          getAudioContext: options.getAudioContext,
          getOutput: options.getOutput,
          initialKitId: 'mercury-synth',
        })
        player = created
        return await created.activate()
      })()
      activation = pendingActivation
      try {
        return await pendingActivation
      } finally {
        if (activation === pendingActivation) activation = null
      }
    },
    trigger: (hit) => player?.trigger(hit) ?? 'dropped',
    panic: () => player?.panic(),
    async dispose(): Promise<void> {
      disposed = true
      try {
        await activation
      } finally {
        await player?.dispose()
        player = null
      }
    },
  }
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

/** Drum attacks bucketed independently so they can never enter pitch voices. */
export function groupPercussionHitsByBeat(
  percussion: readonly GuitarRoomBandPercussionHit[],
): Map<number, GuitarRoomBandPercussionHit[]> {
  const byBeat = new Map<number, GuitarRoomBandPercussionHit[]>()
  for (const hit of percussion) {
    if (!Number.isFinite(hit.startBeat) || hit.startBeat < 0) continue
    const beat = Math.floor(hit.startBeat)
    const bucket = byBeat.get(beat)
    if (bucket === undefined) byBeat.set(beat, [hit])
    else bucket.push(hit)
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
 * Clamp a requested score position and fold positions beyond B into the loop.
 * The controller and scheduler share this rule so the parked playhead cannot
 * disagree with the first sound after Resume.
 */
export function resolveBandStartBeat(
  requestedBeat: number | undefined,
  durationBeats: number,
  loop: LoopSpan | null,
): number {
  const finiteDuration = Number.isFinite(durationBeats)
    ? Math.max(0, durationBeats)
    : 0
  const clamped = Math.min(
    finiteDuration,
    Number.isFinite(requestedBeat) ? Math.max(0, requestedBeat ?? 0) : 0,
  )
  return loop === null ? clamped : foldIntoLoop(clamped, loop)
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
          variant === 'electric' ? 'shared' : 'per-voice',
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
  let masterLevel = 0.76
  let electricAmpParameters: GuitarElectricAmpParameters = {
    ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
  }
  const melodyChannelLevels = new Map<string, number>()
  const percussionPlayers = new Map<
    string,
    { output: GainNode; player: DrumKitPlayerPort }
  >()
  let runOutput: {
    guide: Record<GuitarGuideInput, GainNode>
    drums: GainNode
    melodyChannels: Map<string, Partial<Record<GuitarGuideInput, GainNode>>>
    percussionTracks: Map<string, GainNode>
  } | null = null
  const callbackTimers = new Set<number>()
  const pendingReleases = new Set<Promise<void>>()
  let disposed = false

  const createPercussionPlayer =
    options.createPercussionPlayer ?? createLazyMercurySynthPlayer

  const percussionChannelForTrack = (
    trackId: string,
    currentGraph: GuitarSessionAudioGraph,
  ): { output: GainNode; player: DrumKitPlayerPort } => {
    const existing = percussionPlayers.get(trackId)
    if (existing !== undefined) return existing
    const holder = {
      output: currentGraph.context.createGain(),
    } as { output: GainNode; player: DrumKitPlayerPort }
    holder.player = createPercussionPlayer({
      getAudioContext: () => context,
      getOutput: () => holder.output,
    })
    percussionPlayers.set(trackId, holder)
    return holder
  }

  const ensureGraph = (): GuitarSessionAudioGraph => {
    if (graph !== null) return graph
    const createdContext = createContext()
    context = createdContext
    graph = createGuitarSessionAudioGraph(createdContext, {
      masterLevel,
      busLevels: { drums: 0.72 },
      electricAmpParameters,
    })
    return graph
  }

  const clearTimers = (): void => {
    if (interval !== null) window.clearInterval(interval)
    interval = null
    for (const timer of callbackTimers) window.clearTimeout(timer)
    callbackTimers.clear()
  }

  const releaseRunOutput = (): Promise<void> | null => {
    generation += 1
    clearTimers()
    const output = runOutput
    runOutput = null
    if (output === null) return null

    for (const percussionPlayer of percussionPlayers.values()) {
      percussionPlayer.player.panic()
    }

    // Sources already inside Web Audio's lookahead cannot be unscheduled.
    // Fade their run-scoped gates before disconnecting so Stop remains fast
    // without introducing a discontinuity click at the output.
    const now = context?.currentTime ?? 0
    const outputs = [
      ...Object.values(output.guide),
      output.drums,
      ...[...output.melodyChannels.values()].flatMap((channel) =>
        Object.values(channel),
      ),
    ]
    for (const node of outputs) {
      setGuitarSessionGainTarget(node.gain, 0, now)
    }
    const release = new Promise<void>((resolve) => {
      window.setTimeout(() => {
        for (const node of outputs) node.disconnect()
        for (const node of output.percussionTracks.values()) {
          node.disconnect(output.drums)
        }
        pendingReleases.delete(release)
        resolve()
      }, 80)
    })
    pendingReleases.add(release)
    return release
  }

  const stop = (): void => {
    void releaseRunOutput()
  }

  return {
    setPercussionTrackAudible(trackId, audible) {
      const trackOutput = runOutput?.percussionTracks.get(trackId)
      if (trackOutput === undefined || context === null) return
      setGuitarSessionGainTarget(
        trackOutput.gain,
        audible ? 1 : 0,
        context.currentTime,
      )
    },

    async activate() {
      if (disposed) return null
      const currentGraph = ensureGraph()
      try {
        await activateContext(currentGraph.context)
      } catch {
        return null
      }
      return currentGraph
    },

    setMasterLevel(position) {
      masterLevel = Math.min(1, Math.max(0, position))
      if (disposed) return
      graph?.setMasterLevel(masterLevel)
    },

    setElectricAmpParameters(parameters) {
      electricAmpParameters = { ...parameters }
      if (disposed) return
      graph?.setElectricAmpParameters(electricAmpParameters)
    },

    setMelodyChannelLevel(channelId, position) {
      if (channelId.length === 0) return
      const level = Math.min(1, Math.max(0, position))
      melodyChannelLevels.set(channelId, level)
      if (disposed) return
      const channels = runOutput?.melodyChannels.get(channelId)
      if (channels === undefined || context === null) return
      const now = context.currentTime
      for (const channel of Object.values(channels)) {
        setGuitarSessionGainTarget(channel.gain, sliderToGain(level), now)
      }
    },

    async start(startOptions) {
      if (disposed) {
        return {
          expectedHitTimesMs: [],
          exerciseStartedAtSeconds: null,
          completedAtSeconds: null,
        }
      }
      stop()
      const currentGeneration = generation
      const currentGraph = ensureGraph()
      await activateContext(currentGraph.context)
      if (currentGeneration !== generation) {
        return {
          expectedHitTimesMs: [],
          exerciseStartedAtSeconds: null,
          completedAtSeconds: null,
        }
      }

      const guideOutput = {
        clean: currentGraph.context.createGain(),
        electric: currentGraph.context.createGain(),
      } satisfies Record<GuitarGuideInput, GainNode>
      const drumsOutput = currentGraph.context.createGain()
      guideOutput.clean.gain.value = 1
      guideOutput.electric.gain.value = 1
      drumsOutput.gain.value = 1
      guideOutput.clean.connect(currentGraph.guideInputs.clean)
      guideOutput.electric.connect(currentGraph.guideInputs.electric)
      drumsOutput.connect(currentGraph.buses.drums)
      const melodyChannels = new Map<
        string,
        Partial<Record<GuitarGuideInput, GainNode>>
      >()
      const percussionTrackOutputs = new Map<string, GainNode>()
      const runPercussionPlayers = new Map<string, DrumKitPlayerPort>()
      const initiallyAudibleTracks = startOptions.audiblePercussionTrackIds
      for (const hit of startOptions.percussion ?? []) {
        if (hit.trackId === '' || percussionTrackOutputs.has(hit.trackId)) {
          continue
        }
        const channel = percussionChannelForTrack(hit.trackId, currentGraph)
        const initialLevel =
          initiallyAudibleTracks === undefined ||
          initiallyAudibleTracks.includes(hit.trackId)
            ? 1
            : 0
        channel.output.gain.value = initialLevel
        channel.output.gain.setValueAtTime(
          initialLevel,
          currentGraph.context.currentTime,
        )
        channel.output.connect(drumsOutput)
        percussionTrackOutputs.set(hit.trackId, channel.output)
        runPercussionPlayers.set(hit.trackId, channel.player)
      }
      for (const [trackId, channel] of percussionPlayers) {
        if (runPercussionPlayers.has(trackId)) continue
        channel.output.disconnect()
        void channel.player.dispose()
        percussionPlayers.delete(trackId)
      }
      runOutput = {
        guide: guideOutput,
        drums: drumsOutput,
        melodyChannels,
        percussionTracks: percussionTrackOutputs,
      }
      let percussionActivations: readonly boolean[]
      try {
        percussionActivations = await Promise.all(
          [...runPercussionPlayers.values()].map((player) => player.activate()),
        )
      } catch (error) {
        if (currentGeneration !== generation) {
          return {
            expectedHitTimesMs: [],
            exerciseStartedAtSeconds: null,
            completedAtSeconds: null,
          }
        }
        stop()
        throw error
      }
      if (currentGeneration !== generation) {
        return {
          expectedHitTimesMs: [],
          exerciseStartedAtSeconds: null,
          completedAtSeconds: null,
        }
      }
      if (percussionActivations.some((activated) => !activated)) {
        stop()
        throw new Error('The authored drum player could not activate.')
      }

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
      const startBeat = resolveBandStartBeat(
        startOptions.startBeat,
        durationBeats,
        loop,
      )
      const feel = startOptions.feel ?? 'groove'
      const inputTimingWindowSeconds = Number.isFinite(
        startOptions.inputTimingWindowMs,
      )
        ? Math.min(
            0.5,
            Math.max(0, startOptions.inputTimingWindowMs ?? 0) / 1000,
          )
        : 0
      const runScheduleAheadSeconds = Math.max(
        scheduleAheadSeconds,
        inputTimingWindowSeconds + 0.03,
      )
      const notesByBeat = groupNotesByBeat(startOptions.melody ?? [])
      const percussionByBeat = groupPercussionHitsByBeat(
        startOptions.percussion ?? [],
      )
      const melodyVariant = startOptions.melodyVariant ?? 'electric'
      const firstBeatAt = currentGraph.context.currentTime + 0.09
      const firstExerciseAt = firstBeatAt + countInBeats * openingBeatSeconds
      const completedAt =
        loop === null
          ? firstExerciseAt +
            beatToSeconds(durationBeats) -
            beatToSeconds(startBeat)
          : null
      const firstBeatAtMs = performance.now() + 90
      const firstExerciseAtMs =
        firstBeatAtMs + countInBeats * openingBeatSeconds * 1000
      const expectedHitTimesMs: number[] = []
      let expectedBeat = Math.ceil(startBeat)
      while (loop === null && expectedBeat < durationBeats) {
        expectedHitTimesMs.push(
          firstExerciseAtMs +
            (beatToSeconds(expectedBeat) - beatToSeconds(startBeat)) * 1000,
        )
        expectedBeat += 1
      }

      let nextCountInBeat = 0
      let nextCountInAt = firstBeatAt
      let nextExerciseBeat = Math.ceil(startBeat)
      let nextExerciseAt =
        firstExerciseAt +
        beatToSeconds(nextExerciseBeat) -
        beatToSeconds(startBeat)
      if (loop !== null && nextExerciseBeat >= loop.end) {
        nextExerciseBeat = loop.start
        nextExerciseAt =
          firstExerciseAt + beatToSeconds(loop.end) - beatToSeconds(startBeat)
      }
      let exerciseStartScheduled = false
      let partialNotesScheduled = Number.isInteger(startBeat)
      let completionScheduled = false
      let loopIteration = 0
      let loopBoundaryPending = false
      let activeRhythmPreset =
        startOptions.rhythmPresetForIteration?.(0, null) ??
        startOptions.rhythmPreset ??
        null

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

      const soundBucket = (
        exerciseIndex: number,
        at: number,
        earliestStartBeat = exerciseIndex,
      ): void => {
        for (const note of notesByBeat.get(Math.floor(exerciseIndex)) ?? []) {
          if (
            note.startBeat < earliestStartBeat ||
            (loop === null && note.startBeat >= durationBeats)
          ) {
            continue
          }
          const noteAt =
            at + beatToSeconds(note.startBeat) - beatToSeconds(exerciseIndex)
          const noteDurationSeconds =
            beatToSeconds(note.startBeat + note.durationBeats) -
            beatToSeconds(note.startBeat)
          const channelId = note.channelId ?? 'score'
          const variant = note.variant ?? melodyVariant
          const guideInput: GuitarGuideInput =
            variant === 'electric' ? 'electric' : 'clean'
          let channelOutputs = melodyChannels.get(channelId)
          if (channelOutputs === undefined) {
            channelOutputs = {}
            melodyChannels.set(channelId, channelOutputs)
          }
          let channelOutput = channelOutputs[guideInput]
          if (channelOutput === undefined) {
            channelOutput = currentGraph.context.createGain()
            channelOutput.gain.value = sliderToGain(
              melodyChannelLevels.get(channelId) ?? 1,
            )
            channelOutput.connect(guideOutput[guideInput])
            channelOutputs[guideInput] = channelOutput
          }
          soundNote(
            currentGraph,
            channelOutput,
            note,
            noteAt,
            noteDurationSeconds,
            variant,
          )
        }
      }

      const soundPercussionBucket = (
        exerciseIndex: number,
        at: number,
        earliestStartBeat = exerciseIndex,
      ): void => {
        for (const hit of percussionByBeat.get(Math.floor(exerciseIndex)) ??
          []) {
          if (
            hit.startBeat < earliestStartBeat ||
            (loop === null && hit.startBeat >= durationBeats) ||
            !Number.isInteger(hit.gmKey) ||
            !Number.isInteger(hit.velocity) ||
            hit.velocity < 1 ||
            hit.velocity > 127
          ) {
            continue
          }
          const percussionPlayer = runPercussionPlayers.get(hit.trackId)
          if (percussionPlayer === undefined) continue
          const hitAt =
            at + beatToSeconds(hit.startBeat) - beatToSeconds(exerciseIndex)
          percussionPlayer.trigger({
            gmKey: hit.gmKey,
            velocity: hit.velocity,
            atContextTime: hitAt,
            ...(hit.sourceId === undefined ? {} : { sourceId: hit.sourceId }),
          })
        }
      }

      const soundRhythmBeat = (
        preset: GuitarRoomRhythmPreset,
        exerciseIndex: number,
        at: number,
      ): void => {
        for (const hit of guitarRoomRhythmHitsForBeat(preset, exerciseIndex)) {
          if (
            !Number.isFinite(hit.beatOffset) ||
            !Number.isFinite(hit.velocity)
          ) {
            continue
          }
          const fractionalOffset = hit.beatOffset - Math.floor(hit.beatOffset)
          const hitAt =
            at +
            beatToSeconds(exerciseIndex + fractionalOffset) -
            beatToSeconds(exerciseIndex)
          triggerDrumVoice(
            hit.voice,
            currentGraph.context,
            hitAt,
            Math.min(1, Math.max(0, hit.velocity)),
            drumsOutput,
          )
        }
      }

      const schedule = (): void => {
        const horizon =
          currentGraph.context.currentTime + runScheduleAheadSeconds
        while (nextCountInBeat < countInBeats && nextCountInAt <= horizon) {
          const scheduledBeat = nextCountInBeat
          const at = nextCountInAt
          triggerDrumVoice(
            'sidestick',
            currentGraph.context,
            at,
            scheduledBeat === countInBeats - 1 ? 0.9 : 0.68,
            drumsOutput,
          )
          scheduleUiCallback(at, () =>
            startOptions.onBeat?.(scheduledBeat, 'count-in', at),
          )
          nextCountInBeat += 1
          nextCountInAt += openingBeatSeconds
        }

        if (nextCountInBeat < countInBeats) return

        if (!exerciseStartScheduled && firstExerciseAt <= horizon) {
          exerciseStartScheduled = true
          const openingRhythm = activeRhythmPreset
          scheduleUiCallback(firstExerciseAt, () => {
            startOptions.onExerciseStart?.(startBeat, firstExerciseAt)
            startOptions.onLoopIteration?.(0, firstExerciseAt)
            if (openingRhythm !== null) {
              startOptions.onRhythmPreset?.(openingRhythm, 0, firstExerciseAt)
            }
          })
        }

        if (
          !partialNotesScheduled &&
          firstExerciseAt <= horizon &&
          startBeat < durationBeats
        ) {
          partialNotesScheduled = true
          soundBucket(startBeat, firstExerciseAt, startBeat)
          soundPercussionBucket(startBeat, firstExerciseAt, startBeat)
        }

        while (
          (loop !== null || nextExerciseBeat < durationBeats) &&
          nextExerciseAt <= horizon
        ) {
          if (loopBoundaryPending) {
            activeRhythmPreset =
              startOptions.rhythmPresetForIteration?.(
                loopIteration,
                activeRhythmPreset,
              ) ??
              startOptions.rhythmPreset ??
              activeRhythmPreset
            const iterationAtBoundary = loopIteration
            const rhythmAtBoundary = activeRhythmPreset
            const scheduledBoundaryAt = nextExerciseAt
            scheduleUiCallback(scheduledBoundaryAt, () => {
              startOptions.onLoopIteration?.(
                iterationAtBoundary,
                scheduledBoundaryAt,
              )
              if (rhythmAtBoundary !== null) {
                startOptions.onRhythmPreset?.(
                  rhythmAtBoundary,
                  iterationAtBoundary,
                  scheduledBoundaryAt,
                )
              }
            })
            loopBoundaryPending = false
          }
          const exerciseIndex = nextExerciseBeat
          const at = nextExerciseAt
          const pulseAudible =
            typeof startOptions.exercisePulse === 'function'
              ? startOptions.exercisePulse()
              : startOptions.exercisePulse !== false
          if (!pulseAudible) {
            // The scheduled beat callback still advances the visual score.
            // Only the room's own audible pulse is withheld from the input.
          } else if (feel === 'click') {
            triggerDrumVoice(
              'sidestick',
              currentGraph.context,
              at,
              exerciseIndex % 4 === 0 ? 0.82 : 0.5,
              drumsOutput,
            )
          } else if (activeRhythmPreset !== null) {
            soundRhythmBeat(activeRhythmPreset, exerciseIndex, at)
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

          soundBucket(exerciseIndex, at)
          soundPercussionBucket(exerciseIndex, at)
          startOptions.onExerciseBeatScheduled?.({
            beatIndex: exerciseIndex,
            iteration: loopIteration,
            scheduledAtSeconds: at,
            expectedAtPerformanceMs:
              performance.now() +
              Math.max(0, at - currentGraph.context.currentTime) * 1000,
          })
          scheduleUiCallback(at, () =>
            startOptions.onBeat?.(exerciseIndex, 'exercise', at),
          )

          if (loop !== null && exerciseIndex + 1 >= loop.end) {
            const nextIterationAt =
              nextExerciseAt +
              beatToSeconds(loop.end) -
              beatToSeconds(exerciseIndex)
            nextExerciseAt = nextIterationAt
            nextExerciseBeat = loop.start
            loopIteration += 1
            loopBoundaryPending = true
          } else {
            nextExerciseAt +=
              beatToSeconds(exerciseIndex + 1) - beatToSeconds(exerciseIndex)
            nextExerciseBeat += 1
          }
        }

        if (
          loop === null &&
          nextExerciseBeat >= durationBeats &&
          !completionScheduled
        ) {
          completionScheduled = true
          if (interval !== null) window.clearInterval(interval)
          interval = null
          if (completedAt !== null) {
            scheduleUiCallback(completedAt, () =>
              startOptions.onComplete?.(completedAt),
            )
          }
        }
      }

      schedule()
      if (!completionScheduled) {
        interval = window.setInterval(schedule, schedulerIntervalMs)
      }
      return {
        expectedHitTimesMs,
        exerciseStartedAtSeconds: firstExerciseAt,
        completedAtSeconds: completedAt,
      }
    },
    stop,
    getAudioGraph: () => graph,
    async dispose() {
      if (disposed) return
      disposed = true
      void releaseRunOutput()
      await Promise.all([...pendingReleases])
      await Promise.all(
        [...percussionPlayers.values()].map(({ player }) => player.dispose()),
      )
      percussionPlayers.clear()
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
