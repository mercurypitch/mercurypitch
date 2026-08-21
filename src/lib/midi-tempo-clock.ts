// MIDI tempo clock — parser-free beat/second conversion for live rooms.

export interface MidiTempoClockChange {
  readonly beat: number
  /** Microseconds per quarter note. */
  readonly usPerBeat: number
}

export interface MidiTempoClockSource {
  readonly bpm: number
  readonly tempoChanges?: readonly MidiTempoClockChange[]
  /** Accepted for whole-song object literals; timing itself does not read it. */
  readonly tracks?: readonly unknown[]
}

interface TempoAnchor {
  readonly beat: number
  readonly seconds: number
  readonly usPerBeat: number
}

function tempoAnchors(song: MidiTempoClockSource): TempoAnchor[] {
  const changes = [...(song.tempoChanges ?? [])].sort(
    (left, right) => left.beat - right.beat,
  )
  const opening = 60_000_000 / Math.max(1, song.bpm)
  if (changes.length === 0 || (changes[0]?.beat ?? 0) > 0) {
    changes.unshift({ beat: 0, usPerBeat: opening })
  }

  // Seconds elapsed at each change, accumulated at the tempo in force before it.
  const anchors: TempoAnchor[] = [
    { beat: 0, seconds: 0, usPerBeat: changes[0]?.usPerBeat ?? opening },
  ]
  for (let index = 1; index < changes.length; index += 1) {
    const change = changes[index]
    const previous = anchors[index - 1]
    if (change === undefined || previous === undefined) continue
    anchors.push({
      beat: change.beat,
      seconds:
        previous.seconds +
        ((change.beat - previous.beat) * previous.usPerBeat) / 1e6,
      usPerBeat: change.usPerBeat,
    })
  }
  return anchors
}

/** Build one reusable authored-beat to elapsed-seconds converter. */
export function createBeatClock(
  song: MidiTempoClockSource,
): (beat: number) => number {
  const anchors = tempoAnchors(song)

  return (beat: number): number => {
    let anchor = anchors[0]
    if (anchor === undefined) return 0
    // Tempo maps are normally short, so a linear scan is cheaper than a
    // branchy search and keeps this first-paint helper tiny.
    for (const candidate of anchors) {
      if (candidate.beat <= beat) anchor = candidate
      else break
    }
    return anchor.seconds + ((beat - anchor.beat) * anchor.usPerBeat) / 1e6
  }
}

/** Build the inverse elapsed-seconds to authored-beat converter. */
export function createSecondsToBeatClock(
  song: MidiTempoClockSource,
): (seconds: number) => number {
  const anchors = tempoAnchors(song)

  return (seconds: number): number => {
    let anchor = anchors[0]
    if (anchor === undefined) return 0
    for (const candidate of anchors) {
      if (candidate.seconds <= seconds) anchor = candidate
      else break
    }
    return anchor.beat + ((seconds - anchor.seconds) * 1e6) / anchor.usPerBeat
  }
}
