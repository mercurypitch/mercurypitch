// Recorder previews project frame-time evidence into the existing stage without owning playback or audio.
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { assignStringForMidi } from '@/lib/guitar/instrument-tuning'
import { recordingNoteNeedsFingering, recordingScoreTuning, } from '@/lib/guitar/recording-score'
import { midiToFreq, midiToNote } from '@/lib/scale-data'
import { createPersistedSignal } from '@/lib/storage'
import type { GuitarRecordingController } from './useGuitarRecordingController'
import type { GuitarRecordingPlayback } from './useGuitarRecordingPlayback'

export function useGuitarRecordingStage(
  recorder: Pick<
    GuitarRecordingController,
    | 'state'
    | 'busy'
    | 'duration'
    | 'captureSeconds'
    | 'previewRecording'
    | 'previewNotes'
    | 'previewScore'
  >,
  fallbackTuning: Accessor<InstrumentTuning>,
  playback?: Pick<GuitarRecordingPlayback, 'engaged' | 'position'> &
    Partial<Pick<GuitarRecordingPlayback, 'source' | 'duration'>>,
) {
  const [showLiveNotes, setShowLiveNotes] = createPersistedSignal(
    'guitar-recording-live-notes-v1',
    true,
    {
      validator: (value): value is boolean => typeof value === 'boolean',
    },
  )
  const [visualSeconds, setVisualSeconds] = createSignal(0)
  createEffect(() => {
    if (recorder.state() !== 'recording' || !showLiveNotes()) return
    let frame = 0
    const tick = () => {
      setVisualSeconds(recorder.captureSeconds())
      frame = requestAnimationFrame(tick)
    }
    tick()
    onCleanup(() => cancelAnimationFrame(frame))
  })
  const score = createMemo(() => {
    // Original-input audition must not pretend corrections changed the audio.
    if (playback?.engaged() === true && playback.source?.() === 'recording')
      return null
    const current = recorder.previewScore()
    return !recorder.busy() &&
      current?.recordingId === recorder.previewRecording()?.id
      ? current
      : null
  })
  const tuning = createMemo(() => {
    const current = score()
    return current === null
      ? (recorder.previewRecording()?.tuning ?? fallbackTuning())
      : recordingScoreTuning(current)
  })
  const seconds = () =>
    recorder.busy()
      ? showLiveNotes()
        ? visualSeconds()
        : recorder.duration()
      : (recorder.previewRecording()?.frames ?? 0) /
        (recorder.previewRecording()?.sampleRate ?? 48000)
  const notes = createMemo<readonly GuitarNote[]>(() => {
    if (recorder.busy() && !showLiveNotes()) return []
    const row = recorder.previewRecording()
    if (row === null) return []
    const corrected = score()
    if (corrected !== null)
      return corrected.notes.flatMap((note) => {
        if (recordingNoteNeedsFingering(corrected, note)) return []
        const name = midiToNote(note.midi)
        return [
          {
            id: note.id,
            midi: note.midi,
            noteName: `${name.name}${name.octave}`,
            stringIndex: note.string! - 1,
            fret: note.fret!,
            targetFreq: midiToFreq(note.midi),
            startBeat: (note.startBeat * 120) / corrected.bpm,
            duration: ((note.endBeat - note.startBeat) * 120) / corrected.bpm,
          },
        ]
      })
    // Only live presentation is bounded: cover the largest history window with
    // margin, including held notes. Do not recompile an entire five-minute take
    // on every pending-note update. Review and audition retain all evidence.
    const visibleFrom = recorder.busy()
      ? Math.max(0, (recorder.duration() - 6) * row.sampleRate)
      : -Infinity
    return recorder
      .previewNotes()
      .filter((note) => note.endFrame >= visibleFrom)
      .flatMap((note) => {
        const position = assignStringForMidi(note.midi, tuning())
        // Unplayable pitches stay in the recording/review, never folded onto a string.
        if (position === null) return []
        const name = midiToNote(note.midi)
        return [
          {
            id: note.id,
            midi: note.midi,
            noteName: `${name.name}${name.octave}`,
            stringIndex: position.stringIndex,
            fret: position.fret,
            startBeat: (note.startFrame / row.sampleRate) * 2,
            duration: ((note.endFrame - note.startFrame) / row.sampleRate) * 2,
            targetFreq: midiToFreq(note.midi),
          },
        ]
      })
  })
  const source: GuitarPerformanceStageSource = {
    title: () => 'Detected melody · draft',
    notes,
    recordingHistory: () => recorder.busy() || playback?.engaged() !== true,
    timeline: {
      // Keep capture time truthful. The renderer projects history behind NOW;
      // never disguise past evidence as future targets by offsetting the clock.
      positionSeconds: () =>
        !recorder.busy() && playback?.engaged() === true
          ? playback.position()
          : seconds(),
      durationSeconds: () =>
        !recorder.busy() && playback?.engaged() === true
          ? (playback.duration?.() ?? seconds())
          : seconds(),
      playheadBeat: () =>
        (!recorder.busy() && playback?.engaged() === true
          ? playback.position()
          : seconds()) * 2,
      // Projection unit only, never an inferred tempo or timing correction.
      tempoBpm: () => 120,
    },
  }
  return {
    source,
    tuning,
    showLiveNotes,
    setShowLiveNotes,
    available: () => recorder.previewRecording() !== null,
  }
}
