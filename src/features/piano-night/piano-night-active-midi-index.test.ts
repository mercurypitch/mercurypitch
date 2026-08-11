// ============================================================
// Piano Night active MIDI index tests — overlaps, boundaries, and seek rebuilds
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PianoPerformanceNote } from '@/features/piano/runtime/piano-performance-contract'
import { createPianoNightActiveMidiIndex } from './piano-night-active-midi-index'

function note(
  id: string,
  midi: number,
  startBeat: number,
  duration: number,
): PianoPerformanceNote {
  return {
    id,
    midi,
    name: id,
    startBeat,
    duration,
    targetFreq: 440,
  }
}

describe('createPianoNightActiveMidiIndex', () => {
  it('applies note-on inclusively and note-off exclusively', () => {
    const index = createPianoNightActiveMidiIndex([
      note('first', 60, 2, 2),
      note('second', 64, 3, 0.5),
    ])

    expect([...index.atBeat(1.999)]).toEqual([])
    expect([...index.atBeat(2)]).toEqual([60])
    expect([...index.atBeat(3)]).toEqual([60, 64])
    expect([...index.atBeat(3.5)]).toEqual([60])
    expect([...index.atBeat(4)]).toEqual([])
  })

  it('retains a MIDI pitch until every overlapping voice releases', () => {
    const index = createPianoNightActiveMidiIndex([
      note('held', 60, 0, 4),
      note('overlap', 60, 2, 4),
    ])

    expect([...index.atBeat(3)]).toEqual([60])
    expect([...index.atBeat(4)]).toEqual([60])
    expect([...index.atBeat(6)]).toEqual([])
  })

  it('rebuilds after a backward seek', () => {
    const index = createPianoNightActiveMidiIndex([
      note('first', 60, 1, 2),
      note('later', 67, 8, 2),
    ])

    expect([...index.atBeat(9)]).toEqual([67])
    expect([...index.atBeat(2)]).toEqual([60])
    expect([...index.atBeat(8)]).toEqual([67])
  })
})
