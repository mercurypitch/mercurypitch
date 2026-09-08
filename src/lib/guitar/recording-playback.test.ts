// Audition preserves evidence timing and keeps tone selection separate from saved/room settings.
import { describe, expect, it } from 'vitest'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from './guitar-electric-amp'
import { recordingPlaybackAmp, recordingPlaybackNotes, } from './recording-playback'
import type { GuitarPracticeScore } from './recording-types'

const draft = {
  recording: { id: 'take', sampleRate: 48000 },
  notes: [{ midi: 28, startFrame: 1234, endFrame: 12345 }],
} as GuitarRecordingDraft
describe('recording audition evidence', () => {
  it('retains raw fractional seconds and out-of-neck pitches', () => {
    expect(recordingPlaybackNotes(draft, null)).toEqual([
      { midi: 28, startSeconds: 1234 / 48000, endSeconds: 12345 / 48000 },
    ])
  })
  it('uses current corrections without requiring acceptance or guitar fingering', () => {
    const corrections = {
      recordingId: 'take',
      bpm: 83,
      notes: [
        { midi: 30, startBeat: 0.13, endBeat: 0.91, string: null, fret: null },
      ],
    } as GuitarPracticeScore
    expect(recordingPlaybackNotes(draft, corrections)).toEqual([
      {
        midi: 30,
        startSeconds: (0.13 * 60) / 83,
        endSeconds: (0.91 * 60) / 83,
      },
    ])
    expect(
      recordingPlaybackNotes(draft, { ...corrections, recordingId: 'another' }),
    ).toEqual(recordingPlaybackNotes(draft, null))
  })
  it('rejects malformed pitch/time without rewriting otherwise valid notes', () => {
    const corrections = {
      recordingId: 'take',
      bpm: 120,
      notes: [
        { midi: 60, startBeat: 0.73, endBeat: 0.98 },
        { midi: 128, startBeat: 0, endBeat: 1 },
        { midi: 60, startBeat: NaN, endBeat: 1 },
        { midi: 60, startBeat: 2, endBeat: 1 },
        { midi: 60, startBeat: -1, endBeat: 1 },
      ],
    } as GuitarPracticeScore
    expect(recordingPlaybackNotes(draft, corrections)).toEqual([
      { midi: 60, startSeconds: 0.365, endSeconds: 0.49 },
    ])
  })
  it('auditions corrected chord notes at simultaneous attacks and independent releases', () => {
    const corrections = {
      recordingId: 'take',
      bpm: 120,
      notes: [
        { midi: 40, startBeat: 0.13, endBeat: 4 },
        { midi: 47, startBeat: 0.13, endBeat: 1 },
        { midi: 52, startBeat: 0.51, endBeat: 2 },
      ],
    } as GuitarPracticeScore
    expect(recordingPlaybackNotes(draft, corrections)).toEqual([
      { midi: 40, startSeconds: 0.065, endSeconds: 2 },
      { midi: 47, startSeconds: 0.065, endSeconds: 0.5 },
      { midi: 52, startSeconds: 0.255, endSeconds: 1 },
    ])
  })
  it('returns independent current, bypass and saved starting tones', () => {
    const current = Object.freeze({
      ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
      enabled: true,
      drive: 0.95,
    })
    const saved = Object.freeze({ ...current, drive: 0.2 })
    expect(recordingPlaybackAmp('current-amp', current, saved)?.drive).toBe(
      0.95,
    )
    expect(recordingPlaybackAmp('clean', current, saved)?.enabled).toBe(false)
    expect(recordingPlaybackAmp('saved-amp', current, saved)?.drive).toBe(0.2)
    expect(recordingPlaybackAmp('saved-amp', current, null)).toBeNull()
    expect(
      recordingPlaybackAmp('current-amp', { ...current, enabled: false }, saved)
        ?.enabled,
    ).toBe(false)
    expect(current.enabled).toBe(true)
    expect(saved.drive).toBe(0.2)
  })
})
