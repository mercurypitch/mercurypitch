// Musical memory scorecard checks — persisted facts stay distinct from unavailable comparisons.

import { describe, expect, it } from 'vitest'
import type { MusicalMemory } from '../core/musical-memory'
import { describeMusicalMemory } from './musical-memory-scorecard'

function memory(patch: Partial<MusicalMemory> = {}): MusicalMemory {
  return {
    version: 1,
    levelId: 'echo-curator-audition',
    melodyId: 'sunlit-steps',
    melodyVersion: 1,
    title: 'Echo Curator memory',
    recordedAt: Date.UTC(2026, 8, 27),
    rootMidi: 58,
    pace: 1,
    transposeSemitones: 2,
    durationSeconds: 5.4,
    audio: new Blob(['voice'], { type: 'audio/webm' }),
    ...patch,
  }
}

describe('musical memory scorecard', () => {
  it('derives note count, effective starting note and exact Merc comparison', () => {
    expect(describeMusicalMemory(memory())).toMatchObject({
      melodyTitle: 'Sunlit steps',
      noteCount: 5,
      startingNote: 'C4',
      pace: '1×',
      duration: '5s',
      merc: {
        kind: 'voice',
        variant: {
          melodyId: 'sunlit-steps',
          rootMidi: 60,
          pace: 1,
        },
      },
    })
  })

  it('does not claim a Merc match for an unavailable key or unknown revision', () => {
    expect(describeMusicalMemory(memory({ rootMidi: 61 })).merc).toBeNull()
    expect(describeMusicalMemory(memory({ melodyVersion: 99 }))).toMatchObject({
      melodyTitle: 'Echo Curator memory',
      noteCount: null,
      merc: null,
    })
  })

  it('formats bounded local durations readably', () => {
    expect(
      describeMusicalMemory(memory({ durationSeconds: 1.2 })).duration,
    ).toBe('1s')
    expect(
      describeMusicalMemory(memory({ durationSeconds: 45 })).duration,
    ).toBe('45s')
  })
})
