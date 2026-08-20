// ============================================================
// An authored score on the recording's clock
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEFAULT_BASS_TUNING } from '@/lib/guitar/instrument-tuning'
import type { ScoreAlignment } from '@/lib/transcription/score-alignment'
import { createScoreToAudioClock } from '@/lib/transcription/score-alignment'
import type { StemTranscription } from '@/lib/transcription/stem-transcription'
import type { GuitarNightReferenceSource } from './reference-port'
import { ALIGNMENT_TOLERANCE_SECONDS, alignmentFromMarks, alignScoreToRecording, scorableNotesFromTrack, scorableNotesFromTranscription, scoreOnRecording, scoreSpanSeconds, } from './score-on-recording'

/** A bass line: one note a beat, so a second at 60 BPM. */
function bassSource(
  bpm = 60,
  overrides: Partial<GuitarNightReferenceSource> = {},
): GuitarNightReferenceSource {
  const notes = Array.from({ length: 40 }, (_, index) => ({
    midi: 40 + (index % 5),
    startBeat: index,
    duration: 1,
  }))
  return {
    id: 'song-bass',
    name: 'Bass Study',
    bpm,
    scoreTrackId: 'track-bass',
    tracks: [
      {
        id: 'track-bass',
        name: 'Bass',
        instrumentName: 'Electric Bass',
        noteCount: notes.length,
        notes,
      },
    ],
    ...overrides,
  }
}

/**
 * The same line heard in a recording that runs a shade fast, so the two clocks
 * really do drift rather than merely being offset.
 */
function heardLine(
  scale = 1,
  offsetSeconds = 0,
  count = 40,
): StemTranscription {
  return {
    coverage: 0.8,
    analysedSeconds: count * scale + offsetSeconds,
    notes: Array.from({ length: count }, (_, index) => ({
      midi: 40 + (index % 5),
      noteName: 'E1',
      startSeconds: index * scale + offsetSeconds,
      durationSeconds: 0.5 * scale,
      confidence: 0.9,
    })),
  }
}

const anchored = (
  ...anchors: Array<[audioSeconds: number, scoreSeconds: number]>
): ScoreAlignment => ({
  source: 'measured',
  anchors: anchors.map(([audioSeconds, scoreSeconds]) => ({
    audioSeconds,
    scoreSeconds,
  })),
})

describe('scorableNotesFromTrack', () => {
  it('puts written beats onto the score s own seconds', () => {
    const notes = scorableNotesFromTrack(
      bassSource(120),
      bassSource(120).tracks[0],
    )
    expect(notes[0]).toEqual({ midi: 40, startSeconds: 0 })
    expect(notes[2].startSeconds).toBeCloseTo(1, 10)
  })

  it('follows the score s tempo map, not just its opening tempo', () => {
    const source = bassSource(60, {
      tempoChanges: [
        { beat: 0, usPerBeat: 1000000 },
        { beat: 4, usPerBeat: 500000 },
      ],
    })
    const notes = scorableNotesFromTrack(source, source.tracks[0])
    expect(notes[4].startSeconds).toBeCloseTo(4, 10)
    expect(notes[6].startSeconds).toBeCloseTo(5, 10)
  })

  it('leaves out a note placed nowhere real', () => {
    const source = bassSource()
    const broken = {
      ...source.tracks[0],
      notes: [
        { midi: Number.NaN, startBeat: 0, duration: 1 },
        { midi: 40, startBeat: Number.NaN, duration: 1 },
        { midi: 41, startBeat: 2, duration: 1 },
      ],
    }
    expect(scorableNotesFromTrack(source, broken)).toEqual([
      { midi: 41, startSeconds: 2 },
    ])
  })
})

describe('scorableNotesFromTranscription', () => {
  it('takes heard notes as they are, already on the recording', () => {
    expect(scorableNotesFromTranscription(heardLine())[3]).toEqual({
      midi: 43,
      startSeconds: 3,
    })
  })
})

describe('alignScoreToRecording', () => {
  it('finds a recording that simply starts late', () => {
    const result = alignScoreToRecording(
      bassSource(),
      'track-bass',
      heardLine(1, 2),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // The score sits two seconds ahead of the recording throughout.
    const first = result.fit.alignment.anchors[0]
    expect(first.scoreSeconds - first.audioSeconds).toBeCloseTo(-2, 1)
    expect(result.fit.driftSeconds).toBeLessThan(
      ALIGNMENT_TOLERANCE_SECONDS * 4,
    )
  })

  it('measures a recording that drifts against the score', () => {
    // The recording runs five percent slow, so it stretches away steadily.
    const result = alignScoreToRecording(
      bassSource(),
      'track-bass',
      heardLine(1.05),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fit.driftSeconds).toBeGreaterThan(1)
  })

  it('refuses a track that is not in the score', () => {
    expect(
      alignScoreToRecording(bassSource(), 'track-nope', heardLine()),
    ).toEqual({ ok: false, code: 'no-notes' })
  })

  it('refuses a recording nothing was heard in', () => {
    expect(
      alignScoreToRecording(bassSource(), 'track-bass', {
        coverage: 0,
        analysedSeconds: 30,
        notes: [],
      }),
    ).toEqual({ ok: false, code: 'no-notes' })
  })

  it('refuses a recording that never gets near the score in time', () => {
    // A tab of the intro against a stem of the outro. Nothing overlaps within
    // the drift the matcher is allowed, so no window aligns at all.
    const elsewhen: StemTranscription = {
      coverage: 0.8,
      analysedSeconds: 260,
      notes: Array.from({ length: 12 }, (_, index) => ({
        midi: 40 + (index % 5),
        noteName: 'E1',
        startSeconds: 200 + index,
        durationSeconds: 0.5,
        confidence: 0.9,
      })),
    }
    const short: GuitarNightReferenceSource = {
      ...bassSource(),
      tracks: [
        {
          ...bassSource().tracks[0],
          notes: [
            { midi: 40, startBeat: 0, duration: 1 },
            { midi: 41, startBeat: 1, duration: 1 },
          ],
        },
      ],
    }
    expect(alignScoreToRecording(short, 'track-bass', elsewhen)).toEqual({
      ok: false,
      code: 'no-anchors',
    })
  })

  it('ignores heard notes placed nowhere real', () => {
    const withRubbish: StemTranscription = {
      ...heardLine(),
      notes: [
        {
          midi: Number.NaN,
          noteName: '?',
          startSeconds: 1,
          durationSeconds: 0.5,
          confidence: 0.9,
        },
        ...heardLine().notes,
      ],
    }
    expect(
      alignScoreToRecording(bassSource(), 'track-bass', withRubbish).ok,
    ).toBe(true)
  })

  it('refuses a recording of a different song', () => {
    // Same length, nothing in common: the matcher still returns offsets, and
    // taking them would tell a player their timing is wrong when it is not.
    const elsewhere: StemTranscription = {
      coverage: 0.8,
      analysedSeconds: 40,
      notes: Array.from({ length: 40 }, (_, index) => ({
        midi: 70 + (index % 3),
        noteName: 'A#4',
        startSeconds: index * 0.37 + 0.11,
        durationSeconds: 0.2,
        confidence: 0.9,
      })),
    }
    expect(
      alignScoreToRecording(bassSource(), 'track-bass', elsewhere),
    ).toEqual({ ok: false, code: 'no-agreement' })
  })
})

describe('scoreOnRecording', () => {
  it('has nothing to place for a track the score does not have', () => {
    expect(scoreOnRecording(bassSource(), 'track-nope', anchored([0, 0]))).toBe(
      null,
    )
  })

  it('places written notes where the recording puts them', () => {
    // The score runs two seconds ahead: score second 2 is recording second 0.
    // So the third written note is the first one the recording contains, and
    // it opens the reference at zero.
    const reference = scoreOnRecording(
      bassSource(),
      'track-bass',
      anchored([0, 2], [10, 12]),
      { tuning: DEFAULT_BASS_TUNING },
    )
    expect(reference).not.toBeNull()
    expect(reference?.notes[0]).toMatchObject({ startBeat: 0, midi: 42 })
    expect(reference?.notes[1].startBeat).toBeCloseTo(1, 6)
  })

  it('stretches note lengths through the map, not just their starts', () => {
    // The recording runs at half the score s rate, so a one-second written
    // note lasts two seconds of recording.
    const reference = scoreOnRecording(
      bassSource(),
      'track-bass',
      anchored([0, 0], [10, 5]),
      { tuning: DEFAULT_BASS_TUNING },
    )
    expect(reference?.notes[0].duration).toBeCloseTo(2, 6)
  })

  it('drops notes the recording puts before it began', () => {
    const all = scoreOnRecording(bassSource(), 'track-bass', anchored([0, 0]))
    const shifted = scoreOnRecording(
      bassSource(),
      'track-bass',
      anchored([0, 5], [10, 15]),
    )
    expect(shifted?.notes.length).toBeLessThan(all?.notes.length ?? 0)
  })

  it('reads as a measured line, because there is no tempo left to claim', () => {
    const reference = scoreOnRecording(
      bassSource(),
      'track-bass',
      anchored([0, 0], [10, 10]),
    )
    expect(reference?.kind).toBe('measured')
    expect(reference?.tempoBpm).toBe(60)
  })

  it('keeps every part of the score selectable', () => {
    const reference = scoreOnRecording(
      bassSource(),
      'track-bass',
      anchored([0, 0], [10, 10]),
    )
    expect(reference?.tracks.map((track) => track.id)).toEqual(['track-bass'])
  })

  it('names the recording when it was given one', () => {
    expect(
      scoreOnRecording(bassSource(), 'track-bass', anchored([0, 0], [10, 10]), {
        recordingLabel: 'the bass stem',
        backingSessionId: 'session-7',
      }),
    ).toMatchObject({
      title: 'Bass Study on the bass stem',
      backingSessionId: 'session-7',
    })
  })

  it('says which score it is when it was not', () => {
    expect(
      scoreOnRecording(bassSource(), 'track-bass', anchored([0, 0], [10, 10]))
        ?.title,
    ).toBe('Bass Study on this recording')
  })

  it('leaves out a note placed nowhere real', () => {
    const source = bassSource()
    const broken: GuitarNightReferenceSource = {
      ...source,
      tracks: [
        {
          ...source.tracks[0],
          notes: [
            { midi: Number.NaN, startBeat: 0, duration: 1 },
            { midi: 40, startBeat: Number.POSITIVE_INFINITY, duration: 1 },
            { midi: 41, startBeat: 2, duration: 1 },
          ],
        },
      ],
    }
    const reference = scoreOnRecording(
      broken,
      'track-bass',
      anchored([0, 0], [10, 10]),
      { tuning: DEFAULT_BASS_TUNING },
    )
    expect(reference?.notes).toHaveLength(1)
  })

  it('follows the score s tempo map when placing it', () => {
    // Written at 60 BPM but doubling at beat four, so beat six is second five.
    // Aligned one to one, that is where the recording puts it too.
    const source = bassSource(60, {
      tempoChanges: [
        { beat: 0, usPerBeat: 1000000 },
        { beat: 4, usPerBeat: 500000 },
      ],
    })
    const reference = scoreOnRecording(
      source,
      'track-bass',
      anchored([0, 0], [10, 10]),
      { tuning: DEFAULT_BASS_TUNING },
    )
    expect(reference?.notes[6].startBeat).toBeCloseTo(5, 6)
  })

  it('keeps the setup the file authored, alongside the rows it drew on', () => {
    const source = bassSource()
    const authored: GuitarNightReferenceSource = {
      ...source,
      tracks: [
        {
          ...source.tracks[0],
          sourceTuning: [43, 38, 33, 28],
          sourceTuningName: 'Standard bass',
          sourceCapo: 0,
        },
      ],
    }
    const reference = scoreOnRecording(
      authored,
      'track-bass',
      anchored([0, 0], [10, 10]),
      { tuning: DEFAULT_BASS_TUNING },
    )
    expect(reference?.sourceTuning?.openMidi).toEqual([43, 38, 33, 28])
  })

  it('reads a score with no tempo map at its opening tempo', () => {
    const reference = scoreOnRecording(
      bassSource(120),
      'track-bass',
      anchored([0, 0], [10, 10]),
      { tuning: DEFAULT_BASS_TUNING },
    )
    // 120 BPM: two written beats a second, so note four lands at second two.
    expect(reference?.notes[4].startBeat).toBeCloseTo(2, 6)
  })
})

describe('a written score and its own recording', () => {
  it('round-trips: align, place, and the notes land where they were heard', () => {
    const source = bassSource()
    const heard = heardLine(1.02, 1.5)
    const result = alignScoreToRecording(source, 'track-bass', heard)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const reference = scoreOnRecording(
      source,
      'track-bass',
      result.fit.alignment,
      { tuning: DEFAULT_BASS_TUNING },
    )
    expect(reference).not.toBeNull()

    // Every placed note sits within a tolerance of the note actually heard at
    // that moment — which is the whole claim this feature makes.
    for (const note of reference?.notes ?? []) {
      const nearest = heard.notes.reduce((best, candidate) =>
        Math.abs(candidate.startSeconds - note.startBeat) <
        Math.abs(best.startSeconds - note.startBeat)
          ? candidate
          : best,
      )
      expect(Math.abs(nearest.startSeconds - note.startBeat)).toBeLessThan(
        ALIGNMENT_TOLERANCE_SECONDS * 3,
      )
    }
  })
})

describe('scoreSpanSeconds', () => {
  it('finds where the part starts and ends on the score s clock', () => {
    expect(scoreSpanSeconds(bassSource(), 'track-bass')).toEqual({
      firstSeconds: 0,
      lastSeconds: 39,
    })
  })

  it('reads the span through the score s tempo map', () => {
    const source = bassSource(120)
    expect(scoreSpanSeconds(source, 'track-bass')?.lastSeconds).toBeCloseTo(
      19.5,
      6,
    )
  })

  it('has no span for a track the score does not have', () => {
    expect(scoreSpanSeconds(bassSource(), 'track-nope')).toBeNull()
  })

  it('has no span for a part with nothing in it', () => {
    const source = bassSource()
    const empty: GuitarNightReferenceSource = {
      ...source,
      tracks: [{ ...source.tracks[0], noteCount: 0, notes: [] }],
    }
    expect(scoreSpanSeconds(empty, 'track-bass')).toBeNull()
  })
})

describe('alignmentFromMarks', () => {
  const span = { firstSeconds: 0, lastSeconds: 40 }

  it('has nothing to say before anything is marked', () => {
    expect(alignmentFromMarks(span, {})).toBeNull()
  })

  it('ignores a mark that is not a number', () => {
    expect(
      alignmentFromMarks(span, { firstAudioSeconds: Number.NaN }),
    ).toBeNull()
  })

  it('shifts the part when only its first note is marked', () => {
    const alignment = alignmentFromMarks(span, { firstAudioSeconds: 3 })
    expect(alignment?.anchors).toEqual([{ audioSeconds: 3, scoreSeconds: 0 }])
    expect(
      createScoreToAudioClock(alignment as ScoreAlignment)(10),
    ).toBeCloseTo(13, 6)
  })

  it('pins from the other end when only the last note is marked', () => {
    const alignment = alignmentFromMarks(span, { lastAudioSeconds: 44 })
    expect(alignment?.anchors).toEqual([{ audioSeconds: 44, scoreSeconds: 40 }])
  })

  it('fixes the rate as well when both ends are marked', () => {
    // The part is written across 40 seconds but takes 44 in the recording.
    const alignment = alignmentFromMarks(span, {
      firstAudioSeconds: 2,
      lastAudioSeconds: 46,
    })
    const toAudio = createScoreToAudioClock(alignment as ScoreAlignment)
    expect(toAudio(0)).toBeCloseTo(2, 6)
    expect(toAudio(20)).toBeCloseTo(24, 6)
    expect(toAudio(40)).toBeCloseTo(46, 6)
  })

  it('keeps the shift rather than stretching across two taps at once', () => {
    const alignment = alignmentFromMarks(span, {
      firstAudioSeconds: 3,
      lastAudioSeconds: 3.4,
    })
    expect(alignment?.anchors).toHaveLength(1)
  })

  it('keeps the shift when the part itself is too short to rate', () => {
    const alignment = alignmentFromMarks(
      { firstSeconds: 0, lastSeconds: 0.5 },
      { firstAudioSeconds: 3, lastAudioSeconds: 40 },
    )
    expect(alignment?.anchors).toHaveLength(1)
  })

  it('marks the result as somebody s decision, never a measurement', () => {
    expect(alignmentFromMarks(span, { firstAudioSeconds: 1 })?.source).toBe(
      'manual',
    )
    expect(alignmentFromMarks(span, { lastAudioSeconds: 1 })?.source).toBe(
      'manual',
    )
    expect(
      alignmentFromMarks(span, { firstAudioSeconds: 1, lastAudioSeconds: 41 })
        ?.source,
    ).toBe('manual')
  })
})
