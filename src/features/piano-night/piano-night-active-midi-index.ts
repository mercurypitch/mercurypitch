// ============================================================
// Piano Night active MIDI index — boundary-driven score lookup without frame scans
// ============================================================
//
// Forward playback consumes each note boundary once. A backward seek rebuilds
// deterministically, keeping the index independent from transport ownership.

import type { PianoPerformanceNote } from '@/features/piano/runtime/piano-performance-contract'

interface MidiBoundary {
  beat: number
  midi: number
  delta: -1 | 1
}

export interface PianoNightActiveMidiIndex {
  atBeat: (beat: number) => ReadonlySet<number>
}

export function createPianoNightActiveMidiIndex(
  notes: readonly PianoPerformanceNote[],
): PianoNightActiveMidiIndex {
  const boundaries: MidiBoundary[] = []
  for (const note of notes) {
    if (!(note.duration > 0)) continue
    boundaries.push({ beat: note.startBeat, midi: note.midi, delta: 1 })
    boundaries.push({
      beat: note.startBeat + note.duration,
      midi: note.midi,
      delta: -1,
    })
  }
  boundaries.sort(
    (left, right) => left.beat - right.beat || left.delta - right.delta,
  )

  const voiceCounts = new Map<number, number>()
  const activeMidis = new Set<number>()
  let nextBoundary = 0
  let previousBeat = Number.NEGATIVE_INFINITY

  const reset = (): void => {
    voiceCounts.clear()
    activeMidis.clear()
    nextBoundary = 0
    previousBeat = Number.NEGATIVE_INFINITY
  }

  const atBeat = (beat: number): ReadonlySet<number> => {
    const boundedBeat = Number.isFinite(beat) ? Math.max(0, beat) : 0
    if (boundedBeat < previousBeat) reset()

    while (
      nextBoundary < boundaries.length &&
      boundaries[nextBoundary].beat <= boundedBeat
    ) {
      const boundary = boundaries[nextBoundary]
      const nextCount = (voiceCounts.get(boundary.midi) ?? 0) + boundary.delta
      if (nextCount <= 0) {
        voiceCounts.delete(boundary.midi)
        activeMidis.delete(boundary.midi)
      } else {
        voiceCounts.set(boundary.midi, nextCount)
        activeMidis.add(boundary.midi)
      }
      nextBoundary += 1
    }

    previousBeat = boundedBeat
    return activeMidis
  }

  return { atBeat }
}
