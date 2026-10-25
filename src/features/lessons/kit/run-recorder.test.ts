// ============================================================
// Lesson sound run recorder tests — the swap page tests make, as they make it
// ============================================================
//
// Page tests (Lessons 9, 10 and 12) swap kit/run.ts for the recorders in
// run-recorder.test-fixtures.ts and read what the page asked for from
// `runs`. So this file makes the same swap and holds the recorder to the
// kit's contract as a page meets it: each run recorded with its notes and
// options, a promise that says true only when the test ends it heard and
// false once stopped, `onNote` only on the test's word, and the kit's own
// `allOf` still joining recorded runs.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as RunModule from './run'
import { allOf, playLine, playNote, playNotes } from './run'
import { live, resetRuns, runs } from './run-recorder.test-fixtures'

vi.mock('./run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('./run-recorder.test-fixtures')).recordedRuns,
}))

/** What a run's promise has said so far: nothing while it runs. */
function outcome(done: Promise<boolean>): { heard?: boolean } {
  const seen: { heard?: boolean } = {}
  void done.then((heard) => {
    seen.heard = heard
  })
  return seen
}

afterEach(() => {
  resetRuns()
})

describe('the run recorder', () => {
  it('records each kind of run with what the page asked for, and sounds nothing', () => {
    // Arrange
    const tune = [
      { t: 0, midi: 50, dur: 1 },
      { t: 1, midi: 57, dur: 1 },
    ]
    const line = [{ t: 0, hz: 220 }]

    // Act
    playNotes(tune, { audible: true, kind: 'soft' })
    playNote(57, 0.6, { audible: false })
    playLine(line, { audible: true })

    // Assert
    expect(runs.map((r) => [r.kind, r.notes, r.points, r.o.audible])).toEqual([
      ['notes', tune, [], true],
      ['note', [{ t: 0, midi: 57, dur: 0.6 }], [], false],
      ['line', [], line, true],
    ])
    expect(runs[0]?.o.kind).toBe('soft')
  })

  it('says true only when the test ends a run heard, and false once the page stops it', async () => {
    // Arrange
    const heard = playNote(50, 1, { audible: true })
    const stopped = playNote(57, 1, { audible: true })
    const seenHeard = outcome(heard.done)
    const seenStopped = outcome(stopped.done)
    await Promise.resolve()
    expect([seenHeard.heard, seenStopped.heard]).toEqual([undefined, undefined])

    // Act
    runs[0]?.end(true)
    stopped.stop()
    await Promise.resolve()

    // Assert
    expect([seenHeard.heard, seenStopped.heard]).toEqual([true, false])
    expect(runs.map((r) => [r.over, r.stopped])).toEqual([
      [true, false],
      [true, true],
    ])
    expect(live()).toEqual([])
  })

  it("starts a note for the page's onNote only on the test's word", () => {
    // Arrange
    const onNote = vi.fn()
    const tune = [
      { t: 0, midi: 50, dur: 1 },
      { t: 1, midi: 57, dur: 1 },
    ]
    playNotes(tune, { audible: true, onNote })
    expect(onNote).not.toHaveBeenCalled()

    // Act
    runs[0]?.note(1)

    // Assert
    expect(onNote.mock.calls).toEqual([[tune[1], 1]])
  })

  it("lets the kit's own allOf join recorded runs, and stop them all", async () => {
    // Arrange
    const both = allOf([
      playNote(50, 1, { audible: true }),
      playNote(57, 1, { audible: true }),
    ])
    const seen = outcome(both.done)

    // Act
    both.stop()
    await Promise.resolve()
    await Promise.resolve()

    // Assert
    expect(seen.heard).toBe(false)
    expect(runs.map((r) => r.stopped)).toEqual([true, true])
  })
})
