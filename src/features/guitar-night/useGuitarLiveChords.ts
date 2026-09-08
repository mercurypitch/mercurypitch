// Opt-in chord history owns only a disposable side tap; existing Listening, recording and scored Practice stay independent.
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import type { LiveChordSnapshot } from '@/lib/guitar/live-chord-capture'
import { startLiveChordCapture } from '@/lib/guitar/live-chord-capture'
import type { GuitarRecordingInput } from '@/lib/guitar/recording-capture'
import { assignChordFingering } from '@/lib/guitar/recording-refinement-score'
import type { GuitarPracticeNote } from '@/lib/guitar/recording-types'
import { midiToFreq, midiToNote } from '@/lib/scale-data'
import type { GuitarListeningController } from './useGuitarListeningController'

export function useGuitarLiveChords(options: {
  enabled: Accessor<boolean>
  recording: Accessor<boolean>
  tuning: Accessor<InstrumentTuning>
  listening: Pick<
    GuitarListeningController,
    'status' | 'inputProfile' | 'recordingInput'
  >
  /** Injectable capture boundary for lifecycle tests; production borrows the real route. */
  startCapture?: typeof startLiveChordCapture
}) {
  const [visible, setVisible] = createSignal(
    document.visibilityState !== 'hidden',
  )
  const [status, setStatus] = createSignal<
    'standby' | 'loading' | 'listening' | 'active' | 'paused'
  >('standby')
  const [error, setError] = createSignal<string | null>(null)
  const [snapshot, setSnapshot] = createSignal<LiveChordSnapshot | null>(null)
  const [now, setNow] = createSignal(0)
  const onVisibility = () => setVisible(document.visibilityState !== 'hidden')
  document.addEventListener('visibilitychange', onVisibility)
  onCleanup(() =>
    document.removeEventListener('visibilitychange', onVisibility),
  )
  const input = createMemo<GuitarRecordingInput | null>(
    () => {
      if (
        !options.enabled() ||
        !visible() ||
        options.listening.status() !== 'listening' ||
        options.listening.inputProfile() === 'midi'
      )
        return null
      return options.listening.recordingInput()
    },
    null,
    {
      equals: (a, b) =>
        a === b ||
        (a !== null &&
          b !== null &&
          a.context === b.context &&
          a.source === b.source &&
          a.stream === b.stream &&
          a.channel === b.channel &&
          a.channelCount === b.channelCount),
    },
  )
  createEffect(() => {
    const route = input()
    setSnapshot(null)
    setError(null)
    setStatus(route === null ? 'standby' : 'loading')
    if (route === null) return
    const abort = new AbortController()
    let frame = 0
    const tick = () => {
      setNow(route.context.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const fail = (message: string) => {
      if (abort.signal.aborted) return
      abort.abort()
      cancelAnimationFrame(frame)
      setSnapshot(null)
      setError(message)
      setStatus('paused')
    }
    void (options.startCapture ?? startLiveChordCapture)({
      input: route,
      signal: abort.signal,
      onReady: () => {
        if (!abort.signal.aborted) setStatus('listening')
      },
      onResult: (result) => {
        if (abort.signal.aborted) return
        setSnapshot(result)
        setStatus('active')
      },
      onError: fail,
    }).catch((cause: unknown) =>
      fail(
        cause instanceof Error
          ? cause.message
          : 'Live chords could not start. Refine after Stop is still available.',
      ),
    )
    onCleanup(() => {
      abort.abort()
      cancelAnimationFrame(frame)
    })
  })
  const notes = createMemo<readonly GuitarNote[]>(() => {
    const recent = snapshot()
    if (recent === null) return []
    const tuning = options.tuning()
    const candidates: GuitarPracticeNote[] = recent.notes.map((note) => ({
      id: `live-chord:${recent.audioStartSeconds}:${note.startSeconds}:${note.midi}`,
      evidenceId: '',
      midi: note.midi,
      startBeat: note.startSeconds * 2,
      endBeat: note.endSeconds * 2,
      string: null,
      fret: null,
    }))
    assignChordFingering(candidates, tuning.openMidi, tuning.capo ?? 0)
    return candidates.flatMap((note) => {
      if (note.string === null || note.fret === null) return []
      const label = midiToNote(note.midi)
      return [
        {
          id: note.id,
          midi: note.midi,
          noteName: `${label.name}${label.octave}`,
          stringIndex: note.string - 1,
          fret: note.fret,
          startBeat: note.startBeat,
          duration: note.endBeat - note.startBeat,
          targetFreq: midiToFreq(note.midi),
        },
      ]
    })
  })
  const position = () =>
    Math.max(0, now() - (snapshot()?.audioStartSeconds ?? now()))
  const source: GuitarPerformanceStageSource = {
    title: () => 'Live chords · you played',
    notes,
    recordingHistory: () => true,
    historyKind: () => (options.recording() ? 'recording' : 'live'),
    timeline: {
      positionSeconds: position,
      durationSeconds: position,
      playheadBeat: () => position() * 2,
      tempoBpm: () => 120,
    },
  }
  return {
    source,
    status,
    error,
    active: () => snapshot() !== null,
    processingMs: () => snapshot()?.processingMs ?? null,
    previewLagMs: () => {
      const result = snapshot()
      return result === null
        ? null
        : Math.max(
            0,
            (now() - result.audioStartSeconds - result.analysedSeconds) * 1000,
          )
    },
  }
}

export type GuitarLiveChords = ReturnType<typeof useGuitarLiveChords>
