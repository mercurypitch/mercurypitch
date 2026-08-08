// The score room rehearses an authored tab on its own clock, with no separated song.
// ============================================================
//
// A tab does not need a recording to be worth playing. This drives the shared
// stage from the room band's count-in and groove, so an imported Guitar Pro or
// MIDI score is a complete rehearsal on its own terms.
//
// Musical time comes from the band's audio clock. A frame loop only *reads*
// that clock to refresh the signal — it never defines the beat.

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarRoomBand, GuitarRoomBandNote, } from '@/features/guitar/backing/guitar-room-band'
import { createGuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import { secondsToBeat } from '@/features/guitar/runtime/guitar-performance-contract'
import type { StringedInstrument } from '@/lib/guitar/instrument-tuning'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { foldIntoLoop, quantizeSpanToBeats } from '@/lib/guitar/loop-span'
import type { GuitarNightReference } from './reference-port'

export type GuitarNightScoreRoomStatus =
  | 'quiet'
  | 'starting'
  | 'count-in'
  | 'playing'
  | 'complete'
  | 'error'

export const SCORE_ROOM_MIN_TEMPO = 40
export const SCORE_ROOM_MAX_TEMPO = 220
export const SCORE_ROOM_MAX_COUNT_IN = 8

interface GuitarNightScoreRoomControllerOptions {
  reference: Accessor<GuitarNightReference | null>
  /**
   * Beats to repeat, in the score's own beat time. The click cannot be rewound
   * — it is a scheduled pulse — so a loop is scheduled into it at start and
   * folded out of the elapsed clock for display.
   */
  loop?: Accessor<LoopSpan | null>
  /** Which instrument the stage is showing, so the score sounds like it. */
  instrument?: Accessor<StringedInstrument>
  createBand?: () => GuitarRoomBand
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (handle: number) => void
}

/**
 * The score as the band can schedule it: MIDI pitch and position in beats.
 * The stage's own notes carry string and fret too, which the ear does not need.
 */
export function scoreToBandMelody(
  reference: GuitarNightReference | null,
): GuitarRoomBandNote[] {
  if (reference === null) return []
  return reference.notes.map((note) => ({
    midi: note.midi,
    startBeat: note.startBeat,
    durationBeats: note.duration,
  }))
}

/** Beats the score occupies, from its first note to the end of its last. */
export function scoreDurationBeats(
  reference: GuitarNightReference | null,
): number {
  if (reference === null) return 0
  return reference.notes.reduce(
    (latest, note) => Math.max(latest, note.startBeat + note.duration),
    0,
  )
}

export function useGuitarNightScoreRoomController(
  options: GuitarNightScoreRoomControllerOptions,
) {
  const [status, setStatus] = createSignal<GuitarNightScoreRoomStatus>('quiet')
  const [countInRemaining, setCountInRemaining] = createSignal(0)
  const [positionSeconds, setPositionSeconds] = createSignal(0)
  const [countInBeats, setCountInBeatsSignal] = createSignal(4)
  const [tempoOverride, setTempoOverride] = createSignal<number | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [runningLoop, setRunningLoop] = createSignal<LoopSpan | null>(null)

  const requestFrame =
    options.requestFrame ??
    ((callback: () => void) => requestAnimationFrame(callback))
  const cancelFrame =
    options.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle))

  const band = options.createBand?.() ?? createGuitarRoomBand()
  const [hearScore, setHearScore] = createSignal(true)
  const scoreMelody = createMemo(() => scoreToBandMelody(options.reference()))
  // A bass part played through a guitar voice reads as the wrong instrument
  // even when every note is right, so the tuning the room is already showing
  // decides the voice.
  const melodyVariant = createMemo(() =>
    options.instrument?.() === 'bass'
      ? ('bass' as const)
      : ('electric' as const),
  )
  let startGeneration = 0
  let frame = 0
  let originSeconds: number | null = null

  const scoreTempo = createMemo(() => options.reference()?.tempoBpm ?? 120)
  const tempoBpm = createMemo(() => tempoOverride() ?? scoreTempo())
  const durationBeats = createMemo(() =>
    scoreDurationBeats(options.reference()),
  )
  const durationSeconds = createMemo(() => {
    const bpm = tempoBpm()
    return bpm > 0 ? (durationBeats() * 60) / bpm : 0
  })
  /** The loop as the click was actually scheduled with it: whole beats. */
  const scheduledLoop = createMemo(() => {
    const span = options.loop?.() ?? null
    return span === null ? null : quantizeSpanToBeats(span)
  })
  const playheadBeat = createMemo(() => {
    if (status() === 'quiet') return null
    const elapsed = secondsToBeat(positionSeconds(), tempoBpm())
    // The same fold the scheduler applies, so the playhead and the click can
    // never disagree about which beat of the loop is sounding.
    return foldIntoLoop(elapsed, runningLoop())
  })

  const stopFrames = (): void => {
    if (frame !== 0) cancelFrame(frame)
    frame = 0
  }

  /** Read the band's audio clock every frame. The clock is the authority. */
  const followAudioClock = (): void => {
    stopFrames()
    const tick = (): void => {
      const context = band.getAudioGraph()?.context
      if (context !== undefined && originSeconds !== null) {
        setPositionSeconds(Math.max(0, context.currentTime - originSeconds))
      }
      frame = requestFrame(tick)
    }
    frame = requestFrame(tick)
  }

  const stop = (): void => {
    startGeneration += 1
    stopFrames()
    band.stop()
    originSeconds = null
    setRunningLoop(null)
    setStatus('quiet')
    setCountInRemaining(0)
    setPositionSeconds(0)
  }

  const start = async (): Promise<boolean> => {
    const reference = options.reference()
    if (reference === null || reference.notes.length === 0) return false

    startGeneration += 1
    const generation = startGeneration
    stopFrames()
    band.stop()
    originSeconds = null
    setError(null)
    setPositionSeconds(0)
    setCountInRemaining(countInBeats())
    setStatus('starting')

    try {
      // Pinned for this run: changing the marks mid-take must not desynchronise
      // the playhead from a pulse already scheduled without them.
      const loopForRun = scheduledLoop()
      setRunningLoop(loopForRun)
      await band.start({
        tempoBpm: tempoBpm(),
        countInBeats: countInBeats(),
        exerciseBeats: Math.max(1, Math.ceil(durationBeats())),
        loop: loopForRun,
        // A tab room rehearses a written part, so it ticks rather than
        // grooving, and it sounds the part rather than something under it.
        feel: 'click',
        melody: hearScore() ? scoreMelody() : [],
        melodyVariant: melodyVariant(),
        onBeat: (beatIndex, phase) => {
          if (generation !== startGeneration) return
          if (phase === 'count-in') {
            setStatus('count-in')
            setCountInRemaining(Math.max(1, countInBeats() - beatIndex))
            return
          }
          if (beatIndex === 0) {
            // Beat one of the score: anchor the timeline to the audio clock.
            originSeconds = band.getAudioGraph()?.context.currentTime ?? null
            followAudioClock()
          }
          setStatus('playing')
          setCountInRemaining(0)
        },
        onComplete: () => {
          if (generation !== startGeneration) return
          stopFrames()
          setStatus('complete')
          setPositionSeconds(durationSeconds())
        },
      })
      return generation === startGeneration
    } catch {
      if (generation !== startGeneration) return false
      stopFrames()
      setStatus('error')
      setError('The room clock could not start. Check this device’s audio.')
      return false
    }
  }

  const toggle = (): void => {
    if (
      status() === 'quiet' ||
      status() === 'complete' ||
      status() === 'error'
    ) {
      void start()
      return
    }
    stop()
  }

  const setTempoBpm = (value: number): void => {
    setTempoOverride(
      Math.min(
        SCORE_ROOM_MAX_TEMPO,
        Math.max(SCORE_ROOM_MIN_TEMPO, Math.round(value)),
      ),
    )
  }

  const resetTempo = (): void => {
    setTempoOverride(null)
  }

  const setCountInBeats = (value: number): void => {
    setCountInBeatsSignal(
      Math.min(SCORE_ROOM_MAX_COUNT_IN, Math.max(0, Math.round(value))),
    )
  }

  onCleanup(() => {
    startGeneration += 1
    stopFrames()
    void band.dispose()
  })

  return {
    /** The loop this take is actually running, null until one is scheduled. */
    runningLoop,
    /** Open the room's audio without scheduling a beat — for microphone input. */
    activateAudio: async (): Promise<boolean> =>
      (await band.activate()) !== null,
    getAudioGraph: () => band.getAudioGraph(),
    status,
    error,
    countInRemaining,
    positionSeconds,
    playheadBeat,
    durationSeconds,
    durationBeats,
    tempoBpm,
    scoreTempo,
    countInBeats,
    start,
    stop,
    toggle,
    setTempoBpm,
    resetTempo,
    setCountInBeats,
    /** Whether the room sounds the score. Takes effect on the next take. */
    hearScore,
    setHearScore,
  }
}
