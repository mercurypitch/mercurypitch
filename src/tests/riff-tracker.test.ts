// ============================================================
// Riff Tracker Tests — scoring, capture debounce & melody parse
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRiffTracker, octaveFoldedDistance, parseTargetMelody, RIFF_MIN_NOTE_GAP_MS, } from '@/features/guitar-practice/RiffTrackerState'
import { noteToMidi } from '@/lib/frequency-to-note'

// ── octaveFoldedDistance ───────────────────────────────────────

describe('octaveFoldedDistance', () => {
  it('is 0 for identical pitch classes', () => {
    expect(octaveFoldedDistance(60, 60)).toBe(0)
    expect(octaveFoldedDistance(60, 72)).toBe(0) // C4 vs C5 → same class
  })

  it('is 1 for a semitone apart', () => {
    expect(octaveFoldedDistance(60, 61)).toBe(1)
    expect(octaveFoldedDistance(61, 60)).toBe(1)
  })

  it('is 6 for a tritone (max octave-folded distance)', () => {
    expect(octaveFoldedDistance(60, 66)).toBe(6) // C vs F#
  })

  it('folds an octave (and beyond) back to 0', () => {
    expect(octaveFoldedDistance(48, 60)).toBe(0)
    expect(octaveFoldedDistance(40, 64)).toBe(0) // two octaves
  })

  it('takes the shorter way around the circle', () => {
    // C (0) vs B (11): direct diff is 11, folded is 1.
    expect(octaveFoldedDistance(60, 71)).toBe(1)
  })
})

// ── parseTargetMelody (via noteToMidi) ─────────────────────────

describe('parseTargetMelody', () => {
  it('parses plain MIDI numbers', () => {
    expect(parseTargetMelody('64, 67, 69')).toEqual([64, 67, 69])
  })

  it('parses note names (sharps + octaves)', () => {
    expect(parseTargetMelody('E4, G4, A4')).toEqual([
      noteToMidi('E4'),
      noteToMidi('G4'),
      noteToMidi('A4'),
    ])
    expect(parseTargetMelody('C#4 F#4')).toEqual([61, 66])
  })

  it('handles flats (dropped by the old hand-rolled parser)', () => {
    // Bb3 == A#3 == 58, Eb4 == D#4 == 63.
    expect(parseTargetMelody('Bb3, Eb4')).toEqual([58, 63])
  })

  it('handles two-digit octaves (dropped by the old \\d parser)', () => {
    // C10 == MIDI 132; A0 == 21 (lowest piano note).
    expect(parseTargetMelody('C10, A0')).toEqual([132, 21])
  })

  it('mixes note names and MIDI, splitting on commas and/or spaces', () => {
    expect(parseTargetMelody('E4 64,  G#3')).toEqual([64, 64, 56])
  })

  it('skips empty tokens and unparseable garbage', () => {
    expect(parseTargetMelody('E4, , zzz, 67')).toEqual([64, 67])
    expect(parseTargetMelody('')).toEqual([])
  })

  it('rejects out-of-range MIDI numbers', () => {
    expect(parseTargetMelody('200, 60, -5')).toEqual([60])
  })
})

// ── scoreRiff ──────────────────────────────────────────────────

/** Build a tracker, record `midis` (bypassing the debounce), score it. */
function scoreWith(
  recorded: number[],
  targets: number[],
): ReturnType<typeof createRiffTracker> {
  const tracker = createRiffTracker()
  tracker.setTargetMelody(targets)
  tracker.startRecording()
  // Space notes out beyond the debounce window so all are captured.
  let t = 0
  const nowSpy = vi.spyOn(performance, 'now')
  for (const m of recorded) {
    nowSpy.mockReturnValue(t)
    tracker.addNote(m, 440, 0.9)
    t += RIFF_MIN_NOTE_GAP_MS + 10
  }
  nowSpy.mockRestore()
  tracker.stopRecording()
  tracker.scoreRiff()
  return tracker
}

describe('scoreRiff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('awards exact-match points and the all-correct bonus', () =>
    createRoot((dispose) => {
      // 3 exact matches (25 each) + 25 all-correct bonus = 100.
      const tracker = scoreWith([64, 67, 69], [64, 67, 69])
      expect(tracker.noteResults()).toEqual(['correct', 'correct', 'correct'])
      expect(tracker.score()).toBe(3 * 25 + 25)
      dispose()
    }))

  it('awards near-match (1 semitone) points, no bonus if any miss', () =>
    createRoot((dispose) => {
      // First target off by 1 semitone (near = 15), second exact (25),
      // third has no available match (wrong). No all-correct bonus.
      const tracker = scoreWith([65, 67], [64, 67, 90])
      expect(tracker.noteResults()).toEqual(['correct', 'correct', 'wrong'])
      expect(tracker.score()).toBe(15 + 25)
      dispose()
    }))

  it('does not double-match a single recorded note (greedy, used set)', () =>
    createRoot((dispose) => {
      // One recorded C4 against two C targets — only the first can match.
      const tracker = scoreWith([60], [60, 60])
      expect(tracker.noteResults()).toEqual(['correct', 'wrong'])
      expect(tracker.score()).toBe(25) // one exact, no bonus
      dispose()
    }))

  it('is a no-op with an empty recording or empty target', () =>
    createRoot((dispose) => {
      const empty = createRiffTracker()
      empty.setTargetMelody([64, 67])
      empty.startRecording()
      empty.stopRecording()
      empty.scoreRiff()
      // scoreRiff returns early when there's nothing recorded: phase stays
      // 'reviewing' and score stays 0. (startRecording cleared noteResults,
      // and the early return never repopulates it.)
      expect(empty.phase()).toBe('reviewing')
      expect(empty.score()).toBe(0)
      expect(empty.noteResults()).toEqual([])
      dispose()
    }))

  it('matches octave-displaced notes as correct (octave-folded)', () =>
    createRoot((dispose) => {
      // Played an octave up from every target — still exact (dist 0).
      const tracker = scoreWith([76, 79], [64, 67])
      expect(tracker.noteResults()).toEqual(['correct', 'correct'])
      expect(tracker.score()).toBe(2 * 25 + 25)
      dispose()
    }))
})

// ── addNote debounce + phase gating ────────────────────────────

describe('addNote', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ignores notes when not recording', () =>
    createRoot((dispose) => {
      const tracker = createRiffTracker()
      tracker.addNote(60, 261, 0.9) // phase is 'idle'
      expect(tracker.recordedNotes()).toHaveLength(0)
      dispose()
    }))

  it('debounces the SAME pitch within RIFF_MIN_NOTE_GAP_MS', () =>
    createRoot((dispose) => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const tracker = createRiffTracker()
      tracker.startRecording() // recordingStartMs = 0

      nowSpy.mockReturnValue(10)
      tracker.addNote(60, 261, 0.9) // captured (t=10ms)

      nowSpy.mockReturnValue(10 + RIFF_MIN_NOTE_GAP_MS - 1)
      tracker.addNote(60, 261, 0.9) // same pitch, within gap → dropped

      expect(tracker.recordedNotes()).toHaveLength(1)

      nowSpy.mockReturnValue(10 + RIFF_MIN_NOTE_GAP_MS + 1)
      tracker.addNote(60, 261, 0.9) // same pitch, past gap → captured
      expect(tracker.recordedNotes()).toHaveLength(2)
      dispose()
    }))

  it('captures a DIFFERENT pitch immediately, even within the gap', () =>
    createRoot((dispose) => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const tracker = createRiffTracker()
      tracker.startRecording()

      nowSpy.mockReturnValue(5)
      tracker.addNote(60, 261, 0.9) // C4
      nowSpy.mockReturnValue(6) // 1ms later — inside the gap
      tracker.addNote(62, 294, 0.9) // D4 — different pitch → captured
      expect(tracker.recordedNotes()).toHaveLength(2)
      dispose()
    }))

  it('stamps notes with a time offset from recording start', () =>
    createRoot((dispose) => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(1000) // recordingStartMs = 1000
      const tracker = createRiffTracker()
      tracker.startRecording()

      nowSpy.mockReturnValue(1250)
      tracker.addNote(60, 261, 0.9)
      expect(tracker.recordedNotes()[0].timeMs).toBe(250)
      dispose()
    }))
})
