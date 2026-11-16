// Studio MIDI file reader for tests — a Standard MIDI File's bytes read back through the app's own strict parser (parseMidiProject), track by track, with its notes paired the way a player pairs them.
//
// A player ends a pitch's sounding note at its next note-off, whatever
// note-on it meant, so a file is only unambiguous when each pitch sounds
// once at a time on a channel. The reader holds a file to that: a note-on of
// a pitch already sounding, a note-off of one silent, or a note never ended
// throws, so a test reading a file the Studio wrote fails on any of them.
import { parseMidiProject } from '@/features/piano-project/parse-midi-project'

export interface StudioMidiReadNote {
  readonly channel: number
  readonly pitch: number
  readonly startTick: number
  readonly endTick: number
  readonly velocity: number
  readonly releaseVelocity: number
}

/** One MTrk chunk, in the file's order. */
export interface StudioMidiReadTrack {
  /** Its first track-name event, decoded as UTF-8. */
  readonly name: string | null
  /** Its End of Track's tick. */
  readonly endTick: number
  readonly programs: readonly {
    readonly tick: number
    readonly channel: number
    readonly program: number
  }[]
  /** By start, then pitch. */
  readonly notes: readonly StudioMidiReadNote[]
}

export interface StudioMidiRead {
  readonly format: number
  readonly ppq: number
  readonly tempos: readonly {
    readonly tick: number
    readonly microsecondsPerQuarter: number
  }[]
  readonly meters: readonly {
    readonly tick: number
    readonly numerator: number
    readonly denominator: number
  }[]
  readonly tracks: readonly StudioMidiReadTrack[]
}

/** The parser keeps a text event's bytes as Latin-1 characters; the Studio writes UTF-8. */
function utf8(text: string): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Uint8Array.from(text, (char) => char.charCodeAt(0)),
  )
}

/** `bytes` read back, every MTrk in order, its notes paired one sounding at a time per pitch and channel. */
export function readStudioMidiFile(bytes: Uint8Array): StudioMidiRead {
  const project = parseMidiProject(bytes, {
    id: 'read-back',
    name: 'read-back',
    fileName: 'read-back.mid',
    sha256: '0'.repeat(64),
    importedAt: '2026-11-16T00:00:00.000Z',
  })
  const ends = project.metaEvents.filter(
    (event) => event.type === 'end-of-track',
  )
  const tracks = ends.map((end) => {
    const index = end.sourceTrackIndex
    const named = project.metaEvents.find(
      (event) =>
        event.sourceTrackIndex === index &&
        event.type === 'text' &&
        event.kind === 'track-name',
    )
    const events = project.tracks
      .filter((track) => track.sourceTrackIndex === index)
      .flatMap((track) => track.events)
      .sort((a, b) => a.tick - b.tick || a.order - b.order)
    const sounding = new Map<string, { tick: number; velocity: number }>()
    const notes: StudioMidiReadNote[] = []
    const programs: { tick: number; channel: number; program: number }[] = []
    for (const event of events) {
      if (event.type === 'program-change') {
        programs.push({
          tick: event.tick,
          channel: event.channel,
          program: event.program,
        })
        continue
      }
      if (event.type !== 'note-on' && event.type !== 'note-off') continue
      const key = `${event.channel}:${event.note}`
      const held = sounding.get(key)
      if (event.type === 'note-on') {
        if (held !== undefined)
          throw new Error(
            `Track ${index} strikes pitch ${event.note} on channel ${event.channel} at tick ${event.tick} while it sounds from ${held.tick}.`,
          )
        sounding.set(key, { tick: event.tick, velocity: event.velocity })
        continue
      }
      if (held === undefined)
        throw new Error(
          `Track ${index} ends pitch ${event.note} on channel ${event.channel} at tick ${event.tick}, which is not sounding.`,
        )
      sounding.delete(key)
      notes.push({
        channel: event.channel,
        pitch: event.note,
        startTick: held.tick,
        endTick: event.tick,
        velocity: held.velocity,
        releaseVelocity: event.velocity,
      })
    }
    if (sounding.size > 0)
      throw new Error(
        `Track ${index} never ends ${[...sounding.keys()].join(', ')}.`,
      )
    return {
      name: named?.type === 'text' ? utf8(named.text) : null,
      endTick: end.tick,
      programs,
      notes: notes.sort(
        (a, b) => a.startTick - b.startTick || a.pitch - b.pitch,
      ),
    }
  })
  return {
    format: project.source.kind === 'midi' ? project.source.format : -1,
    ppq: project.source.kind === 'midi' ? project.source.ticksPerQuarter : -1,
    tempos: project.tempoMap.map((tempo) => ({
      tick: tempo.tick,
      microsecondsPerQuarter: tempo.microsecondsPerQuarter,
    })),
    meters: project.timeSignatures.map((meter) => ({
      tick: meter.tick,
      numerator: meter.numerator,
      denominator: meter.denominator,
    })),
    tracks,
  }
}
