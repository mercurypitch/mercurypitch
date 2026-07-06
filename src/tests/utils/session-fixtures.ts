// ============================================================
// Session-history test fixtures
// ============================================================
// Builders for the persisted `SessionResult` shape, shared across the
// tests that read it (accuracy heatmap, weakness analyzer, note-accuracy
// projection). Kept in ONE place so a `SessionResult` / `NoteResult`
// shape change edits a single fixture instead of drifting across copies —
// the same decoupling the projection under test provides for the app.

import { setSessionResults } from '@/stores/practice-session-store'

/**
 * Prepend a session whose single practice item carries the given per-note
 * `(midi, avgCents)` results — the minimal slice the accuracy heatmap and
 * weakness analyzer consume. Prepended (newest-first) to match how the
 * store records real sessions, so tests relying on iteration order behave
 * like production.
 */
export function seedSessionWithNotes(
  noteResults: { midi: number; avgCents: number }[],
): void {
  setSessionResults((prev) => [
    {
      name: 'Test',
      score: 60,
      itemsCompleted: noteResults.length,
      sessionName: 'Test',
      completedAt: Date.now(),
      practiceItemResult: [
        {
          score: 60,
          noteCount: noteResults.length,
          avgCents: 25,
          itemsCompleted: noteResults.length,
          name: 'Test',
          mode: 'once',
          completedAt: Date.now(),
          noteResult: noteResults.map((n) => ({
            item: {
              id: 0,
              note: { midi: n.midi, name: 'C', octave: 4, freq: 261 },
              duration: 1,
              startBeat: 0,
            },
            pitchFreq: 261,
            pitchCents: n.avgCents,
            time: 100,
            rating: 'good' as const,
            avgCents: n.avgCents,
            targetNote: 'C4',
          })),
        },
      ],
    },
    ...prev,
  ])
}
