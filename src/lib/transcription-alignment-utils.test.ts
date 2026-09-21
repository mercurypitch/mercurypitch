// ============================================================
// Alignment note-source selection
// ============================================================
//
// The ladder decides which evidence a word alignment runs against, and it is
// ordered rather than merely prioritised: the realtime rung allocates, so it
// must not be computed when an offline series already has notes. That is
// asserted here with a spy, because a reordering would otherwise be invisible
// — the returned notes are identical either way.

import { describe, expect, it } from 'vitest'
import type { MergedNote } from '@/lib/midi-generator'
import type { AlignmentPitchPoint } from '@/lib/transcription-alignment-utils'
import { emptyAlignmentResult, selectAlignmentNotes, } from '@/lib/transcription-alignment-utils'

const note = (midi: number, startSec: number, endSec: number): MergedNote => ({
  midi,
  noteName: `n${midi}`,
  startSec,
  endSec,
})

/**
 * A run of identical readings, which merges into one sustained note.
 *
 * `map` is instrumented rather than the module being mocked: mapping is the
 * allocation the ladder's ordering exists to avoid, so `mapped` is a direct
 * record of whether the realtime rung was reached. Reading `.length` is not
 * enough to count as reached — the ladder checks that on every call.
 */
function history(
  frequency: number,
  count = 6,
): AlignmentPitchPoint[] & {
  mapped: boolean
} {
  const readings = Array.from({ length: count }, (_, i) => ({
    frequency,
    noteName: 'A4',
    time: i * 0.05,
  })) as AlignmentPitchPoint[] & { mapped: boolean }
  readings.mapped = false
  const realMap = readings.map.bind(readings)
  readings.map = ((...args: Parameters<typeof realMap>) => {
    readings.mapped = true
    return realMap(...args)
  }) as typeof readings.map
  return readings
}

const base = {
  preferDenoised: true,
  segmentedNotes: [] as MergedNote[],
  mergedNotes: [] as MergedNote[],
  realtimePitchHistory: [] as AlignmentPitchPoint[],
}

describe('selectAlignmentNotes', () => {
  it('prefers the denoised series when it is preferred and has notes', () => {
    const segmentedNotes = [note(60, 0, 1)]
    expect(
      selectAlignmentNotes({
        ...base,
        segmentedNotes,
        mergedNotes: [note(62, 0, 1)],
      }),
    ).toEqual({ notes: segmentedNotes, noteSource: 'denoised' })
  })

  it('ignores the denoised series when it is not preferred', () => {
    const mergedNotes = [note(62, 0, 1)]
    expect(
      selectAlignmentNotes({
        ...base,
        preferDenoised: false,
        segmentedNotes: [note(60, 0, 1)],
        mergedNotes,
      }),
    ).toEqual({ notes: mergedNotes, noteSource: 'raw-offline' })
  })

  it('falls back to the raw offline series when denoised is empty', () => {
    const mergedNotes = [note(62, 0, 1)]
    expect(selectAlignmentNotes({ ...base, mergedNotes })).toEqual({
      notes: mergedNotes,
      noteSource: 'raw-offline',
    })
  })

  it('falls back to realtime history when neither offline series has notes', () => {
    const result = selectAlignmentNotes({
      ...base,
      realtimePitchHistory: history(440),
    })

    expect(result.noteSource).toBe('raw-realtime')
    expect(result.notes.length).toBeGreaterThan(0)
    expect(result.notes[0].midi).toBe(69)
  })

  it('reports none when there is no evidence at all', () => {
    expect(selectAlignmentNotes(base)).toEqual({
      notes: [],
      noteSource: 'none',
    })
  })

  it('reports none when realtime history merges to nothing', () => {
    expect(selectAlignmentNotes({ ...base, realtimePitchHistory: [] })).toEqual(
      { notes: [], noteSource: 'none' },
    )
  })

  it('does not touch realtime history when an offline series already won', () => {
    const behindDenoised = history(440)
    selectAlignmentNotes({
      ...base,
      segmentedNotes: [note(60, 0, 1)],
      realtimePitchHistory: behindDenoised,
    })
    expect(behindDenoised.mapped).toBe(false)

    const behindRawOffline = history(440)
    selectAlignmentNotes({
      ...base,
      mergedNotes: [note(62, 0, 1)],
      realtimePitchHistory: behindRawOffline,
    })
    expect(behindRawOffline.mapped).toBe(false)

    // ...and does reach it once nothing else is available.
    const only = history(440)
    selectAlignmentNotes({ ...base, realtimePitchHistory: only })
    expect(only.mapped).toBe(true)
  })
})

describe('emptyAlignmentResult', () => {
  it('is an empty result, and a fresh object each call', () => {
    const a = emptyAlignmentResult()
    expect(a).toEqual({
      alignedWords: [],
      totalWords: 0,
      mappedWords: 0,
      unmappedWords: 0,
      accuracy: 0,
      debugEntries: [],
    })
    expect(emptyAlignmentResult()).not.toBe(a)
  })
})
