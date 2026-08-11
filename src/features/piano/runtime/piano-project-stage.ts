// ============================================================
// Piano project stage — canonical score-track projection for performance
// ============================================================
//
// Integer ticks remain authoritative in PianoProject. This pure adapter gives
// a beat-native stage to the route runtime without importing legacy song or
// App-owned store shapes. Equal-pitch overlaps pair FIFO and never mutate the
// canonical event arrays.

import type { PianoProject, PianoProjectChannelEvent, PianoProjectTrack, } from '@/features/piano-project/piano-project'
import { pianoProjectTicksPerQuarter } from '@/features/piano-project/piano-project'
import type { PianoPerformanceNote } from './piano-performance-contract'
import type { CompiledPianoTempoMap } from './piano-tempo-map'
import { compilePianoTempoMap } from './piano-tempo-map'

export interface PianoProjectStageNote extends PianoPerformanceNote {
  /** Strike velocity normalized from canonical MIDI 0..127 into 0..1. */
  readonly velocity: number
  /** Release velocity normalized from canonical MIDI 0..127 into 0..1. */
  readonly releaseVelocity: number
  readonly channel: number
}

export interface PianoProjectStage {
  readonly title: string
  readonly notes: readonly PianoProjectStageNote[]
  readonly totalBeats: number
  readonly initialTempoBpm: number
  readonly tempoMap: CompiledPianoTempoMap
}

interface ActiveNote {
  tick: number
  order: number
  velocity: number
}

interface OrderedStageNote extends PianoProjectStageNote {
  sourceOrder: number
}

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

function midiFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function compareEvents(
  left: PianoProjectChannelEvent,
  right: PianoProjectChannelEvent,
): number {
  return left.tick - right.tick || left.order - right.order
}

/** Project one canonical playable track without changing its source events. */
export function pianoProjectTrackToStageNotes(
  track: PianoProjectTrack,
  ticksPerQuarter: number,
): readonly PianoProjectStageNote[] {
  const active = new Map<number, ActiveNote[]>()
  const projected: OrderedStageNote[] = []
  const events = [...track.events].sort(compareEvents)

  for (const event of events) {
    if (event.type === 'note-on' && event.velocity > 0) {
      const queue = active.get(event.note) ?? []
      queue.push({
        tick: event.tick,
        order: event.order,
        velocity: event.velocity,
      })
      active.set(event.note, queue)
      continue
    }
    if (
      event.type !== 'note-off' &&
      !(event.type === 'note-on' && event.velocity === 0)
    ) {
      continue
    }

    const queue = active.get(event.note)
    const started = queue?.shift()
    if (started === undefined) continue
    if (queue?.length === 0) active.delete(event.note)

    projected.push({
      id: `${track.id}:${started.order}`,
      midi: event.note,
      name: NOTE_NAMES[event.note % 12],
      startBeat: started.tick / ticksPerQuarter,
      duration: Math.max(0, (event.tick - started.tick) / ticksPerQuarter),
      targetFreq: midiFrequency(event.note),
      isBacking: false,
      trackId: track.id,
      velocity: started.velocity / 127,
      releaseVelocity: event.velocity / 127,
      channel: track.channel,
      sourceOrder: started.order,
    })
  }

  projected.sort(
    (left, right) =>
      left.startBeat - right.startBeat || left.sourceOrder - right.sourceOrder,
  )
  return Object.freeze(
    projected.map(({ sourceOrder: _sourceOrder, ...note }) =>
      Object.freeze(note),
    ),
  )
}

function compareSourcePositions(
  left: { tick: number; sourceTrackIndex: number; order: number },
  right: { tick: number; sourceTrackIndex: number; order: number },
): number {
  return (
    left.tick - right.tick ||
    left.sourceTrackIndex - right.sourceTrackIndex ||
    left.order - right.order
  )
}

function projectTempoMap(
  project: PianoProject,
  ticksPerQuarter: number,
): CompiledPianoTempoMap {
  const events = [...project.tempoMap]
    .sort(compareSourcePositions)
    .map((event) => ({
      beat: event.tick / ticksPerQuarter,
      bpm: 60_000_000 / event.microsecondsPerQuarter,
    }))
  return compilePianoTempoMap(events)
}

/** Project one canonical score track into the shared performance vocabulary. */
export function pianoProjectToStage(project: PianoProject): PianoProjectStage {
  const ticksPerQuarter = pianoProjectTicksPerQuarter(project)
  const scoreTrack =
    project.scoreTrackId === null
      ? undefined
      : project.tracks.find((track) => track.id === project.scoreTrackId)
  const notes =
    scoreTrack === undefined
      ? []
      : pianoProjectTrackToStageNotes(scoreTrack, ticksPerQuarter)
  const tempoMap = projectTempoMap(project, ticksPerQuarter)

  return Object.freeze({
    title: project.name,
    notes: Object.freeze(notes),
    totalBeats: project.durationTicks / ticksPerQuarter,
    initialTempoBpm: tempoMap.initialTempoBpm,
    tempoMap,
  })
}
