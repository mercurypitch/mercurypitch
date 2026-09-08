// ============================================================
// Live history stage — projects existing Listening without recording or scoring.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { assignStringForMidi } from '@/lib/guitar/instrument-tuning'
import { midiToFreq, midiToNote } from '@/lib/scale-data'
import { createGuitarLiveHistory } from './guitar-live-history'
import type { GuitarLiveInputObservation, GuitarLiveInputRoute, } from './guitar-live-input-observations'

interface GuitarLiveHistoryStageOptions {
  enabled: Accessor<boolean>
  tuning: Accessor<InstrumentTuning>
  listening: {
    liveInputRoute(): GuitarLiveInputRoute | null
    subscribeLiveObservations(
      observer: (observation: GuitarLiveInputObservation) => void,
    ): () => void
  }
}

export function useGuitarLiveHistoryStage(
  options: GuitarLiveHistoryStageOptions,
) {
  const collector = createGuitarLiveHistory()
  const [snapshot, setSnapshot] = createSignal(collector.snapshot())
  const active = createMemo(() => snapshot().active)
  const refresh = () =>
    setSnapshot(
      collector.snapshot(
        options.listening.liveInputRoute()?.currentTimeSeconds(),
      ),
    )
  const unsubscribe = options.listening.subscribeLiveObservations(
    (observation) => {
      collector.observe(observation)
      refresh()
    },
  )
  onCleanup(unsubscribe)
  createEffect(() => {
    if (!options.enabled() || !active()) return
    let frame = 0
    const tick = () => {
      refresh()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    onCleanup(() => cancelAnimationFrame(frame))
  })
  // Advancing the playhead alone must not rebuild/recompile audio note ink.
  // MIDI's held-note ends do advance with the route clock and remain reactive.
  const visibleNotes = createMemo(() => snapshot().notes, undefined, {
    equals: (previous, next) =>
      previous.length === next.length &&
      previous.every((note, index) => {
        const other = next[index]
        return (
          note.id === other.id &&
          note.midi === other.midi &&
          note.startSeconds === other.startSeconds &&
          note.endSeconds === other.endSeconds
        )
      }),
  })
  const notes = createMemo<readonly GuitarNote[]>(() =>
    visibleNotes().flatMap((note) => {
      const position = assignStringForMidi(note.midi, options.tuning())
      if (position === null) return []
      const label = midiToNote(note.midi)
      return [
        {
          id: note.id,
          midi: note.midi,
          noteName: `${label.name}${label.octave}`,
          stringIndex: position.stringIndex,
          fret: position.fret,
          startBeat: note.startSeconds * 2,
          duration: (note.endSeconds - note.startSeconds) * 2,
          targetFreq: midiToFreq(note.midi),
        },
      ]
    }),
  )
  const source: GuitarPerformanceStageSource = {
    title: () => 'Live input · you played',
    notes,
    recordingHistory: () => true,
    historyKind: () => 'live',
    timeline: {
      positionSeconds: () => snapshot().nowSeconds,
      durationSeconds: () => snapshot().nowSeconds,
      playheadBeat: () => snapshot().nowSeconds * 2,
      tempoBpm: () => 120,
    },
  }
  return {
    source,
    tuning: options.tuning,
    available: () => true,
    active,
    noteCount: () => notes().length,
    unmappedCount: () => snapshot().notes.length - notes().length,
  }
}
