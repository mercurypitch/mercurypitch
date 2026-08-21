// ============================================================
// The note tally means one thing on every ruler
// ============================================================
//
// "Notes hit" read 0 on every drill row in the operator console because three
// of the four sessionRecords write paths hard-coded the pair. Filling it in
// is only worth doing if the number means the same thing everywhere, so these
// pin the two ways it could quietly stop meaning that:
//
//   1. The line is CENTS, never a score. Drills map cents to a score with
//      their own slope, and staccato-precision and call-response divide that
//      slope by a difficulty factor — so a score threshold would make "hit"
//      easier on an easy setting without anyone noticing.
//   2. A tally that breaks notesHit <= notesTotal is a 400 from the worker's
//      evidence rule, and `saveSessionRecord` swallows that by design. The
//      run would then bank NOTHING — no record, no minutes, no streak, no
//      badges. Same silent-total-loss shape as CLAUDE-JOURNEY-007.

import { describe, expect, it } from 'vitest'
import { EMPTY_NOTE_TALLY, isNoteHit, NOTE_HIT_CENTS, noteTallyFromMetrics, tallyFromDeviations, } from '@/features/exercises/exercise-note-tally'
import { validateWrite } from '../../workers/db-worker/src/validation'

describe('isNoteHit', () => {
  it('draws the line at 25 cents, inclusive', () => {
    expect(NOTE_HIT_CENTS).toBe(25)
    expect(isNoteHit(0)).toBe(true)
    expect(isNoteHit(25)).toBe(true)
    expect(isNoteHit(25.01)).toBe(false)
    expect(isNoteHit(120)).toBe(false)
  })

  // A note that captured no voiced audio is a miss, not an absence. Treating
  // null as "no data, skip it" would let a singer who went quiet for half the
  // run finish at 100%.
  it('counts an unheard note as a miss, not as missing', () => {
    expect(isNoteHit(null)).toBe(false)
    expect(isNoteHit(Number.NaN)).toBe(false)
    expect(isNoteHit(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('tallyFromDeviations', () => {
  it('keeps every note presented in the denominator', () => {
    expect(tallyFromDeviations([4, 40, null, 25, 26])).toEqual({
      notesHit: 2,
      notesTotal: 5,
    })
  })

  it('reports the empty tally for a run with no notes', () => {
    expect(tallyFromDeviations([])).toEqual(EMPTY_NOTE_TALLY)
    expect(EMPTY_NOTE_TALLY).toEqual({ notesHit: 0, notesTotal: 0 })
  })

  it('can never produce a tally the worker rejects', () => {
    const cases: (number | null)[][] = [
      [],
      [null, null],
      [0, 0, 0],
      Array.from({ length: 40 }, (_, i) => i * 2),
    ]
    for (const deviations of cases) {
      const tally = tallyFromDeviations(deviations)
      expect(tally.notesHit).toBeLessThanOrEqual(tally.notesTotal)
      expect(
        validateWrite('sessionRecords', {
          score: 80,
          accuracy: 80,
          source: 'exercise',
          ...tally,
        }),
      ).toBeNull()
    }
  })
})

describe('noteTallyFromMetrics', () => {
  it('passes a drill tally straight through', () => {
    expect(
      noteTallyFromMetrics({ avgAccuracy: 80, notesHit: 7, notesTotal: 12 }),
    ).toEqual({ notesHit: 7, notesTotal: 12 })
  })

  // Each of these would be a 400 the client swallows, costing the singer the
  // entire run. "Not measured" is the only safe way to fail here.
  it('degrades to not-measured rather than posting a rejected row', () => {
    const rejected: (Record<string, number> | undefined)[] = [
      { notesHit: 5 }, // total missing
      { notesTotal: 5 }, // hits missing
      { notesHit: 9, notesTotal: 4 }, // more hits than notes
      { notesHit: -1, notesTotal: 4 },
      { notesHit: 1.5, notesTotal: 4 },
      undefined,
      {},
    ]
    for (const metrics of rejected) {
      expect(noteTallyFromMetrics(metrics)).toEqual(EMPTY_NOTE_TALLY)
    }
  })

  it('accepts the drills that legitimately have nothing to count', () => {
    // A sustained-pitch drill reports 0/0, which readers treat as "no note
    // data" via their notesTotal > 0 guards — not as a run that hit nothing.
    expect(noteTallyFromMetrics({ notesHit: 0, notesTotal: 0 })).toEqual(
      EMPTY_NOTE_TALLY,
    )
  })
})
