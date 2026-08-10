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

function projectScoreNotes(
  track: PianoProjectTrack,
  ticksPerQuarter: number,
): PianoProjectStageNote[] {
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
  return projected.map(({ sourceOrder: _sourceOrder, ...note }) =>
    Object.freeze(note),
  )
}

function initialTempoBpm(project: PianoProject): number {
  const firstTempo = project.tempoMap[0]
  return firstTempo === undefined
    ? 120
    : 60_000_000 / firstTempo.microsecondsPerQuarter
}

/** Project one canonical score track into the shared performance vocabulary. */
export function pianoProjectToStage(project: PianoProject): PianoProjectStage {
  const ticksPerQuarter = pianoProjectTicksPerQuarter(project)
  const scoreTrack =
    project.scoreTrackId === null
      ? undefined
      : project.tracks.find((track) => track.id === project.scoreTrackId)
  const notes = Object.freeze(
    scoreTrack === undefined
      ? []
      : projectScoreNotes(scoreTrack, ticksPerQuarter),
  )

  return Object.freeze({
    title: project.name,
    notes,
    totalBeats: project.durationTicks / ticksPerQuarter,
    initialTempoBpm: initialTempoBpm(project),
  })
}
