// ============================================================
// Redo line — clearing a line and going back to the top of it
// ============================================================
//
// Reported as "doesn't seem to do anything", and it had three ways of looking
// exactly like that: it cleared the line ABOVE the one the operator had just
// clicked, it rewound to 0 s on a song with no canonical times, and in the
// word pass it rewound to where the line sat before pass 1 moved it.
//
// The button had no coverage at all, which is how all three survived.

import { beforeEach, describe, expect, it } from 'vitest'
import { preRollTarget } from '@/features/stem-mixer/lrc-gen-passes'
import { makeLrcGenHarness } from './helpers/lrc-gen-harness'

const LINES = ['hold on', 'soul mate', 'come home']
/** The times the song arrived with. */
const LINE_TIMES = [0, 10, 20]

const makeController = (sessionId = 'redo-line-test') =>
  makeLrcGenHarness({ lines: LINES, lineTimes: LINE_TIMES, sessionId })

describe('handleRedoCurrentLine', () => {
  let harness: ReturnType<typeof makeController>

  beforeEach(() => {
    localStorage.clear()
    harness = makeController()
    harness.gen.startLrcGen()
    harness.gen.setLrcTimingOffsetMs(0)
  })

  /** Pretend pass 1 mapped every line, a second later than the file claims. */
  const mapEveryLine = () => {
    harness.gen.setLrcGenLineTimes(() => LINE_TIMES.map((t) => t + 1))
    harness.gen.setLrcGenWordTimings(() =>
      Object.fromEntries(LINE_TIMES.map((t, i) => [i, [t + 1, t + 2]])),
    )
  }

  it('redoes the line the cursor is on, not the one above it', () => {
    mapEveryLine()
    // Clicking a mapped line to redo it parks the cursor at its word 0 —
    // which used to be read as "nothing here yet, step back one".
    harness.gen.focusGenWord(1, 0)

    harness.gen.handleRedoCurrentLine()
    expect(harness.gen.lrcGenLineIdx()).toBe(1)
    expect(harness.starts()[1]).toBeUndefined()
    // And the line above it, which is what used to be cleared, survives.
    expect(harness.starts()[0]).toBeDefined()
  })

  it('still steps back from the top of a line nothing has landed on', () => {
    // The original reason for the step-back: pass 1 has just advanced onto
    // line 1, so the line worth redoing is the one behind the cursor.
    harness.gen.setLrcGenLineTimes(() => [LINE_TIMES[0] + 1])
    harness.gen.setLrcGenWordTimings(() => ({ 0: [LINE_TIMES[0] + 1] }))
    harness.gen.focusGenWord(1, 0)

    harness.gen.handleRedoCurrentLine()
    expect(harness.gen.lrcGenLineIdx()).toBe(0)
    expect(harness.starts()[0]).toBeUndefined()
  })

  it('rewinds to the time the song arrived with in the line pass', () => {
    mapEveryLine()
    harness.gen.focusGenWord(2, 0)
    harness.gen.handleRedoCurrentLine()
    // The line is being re-timed from scratch, so the honest reference is
    // where it was before this session touched it.
    expect(harness.seeks().at(-1)).toBe(preRollTarget(LINE_TIMES[2]))
  })

  it('rewinds to the mapped start in the word pass, not the original', () => {
    mapEveryLine()
    harness.gen.setLrcGenPass('words')
    harness.gen.focusGenWord(2, 1)

    harness.gen.handleRedoCurrentLine()
    expect(harness.seeks().at(-1)).toBe(preRollTarget(LINE_TIMES[2] + 1))
  })

  it('keeps the settled line start when redoing inside the word pass', () => {
    mapEveryLine()
    harness.gen.setLrcGenPass('words')
    harness.gen.focusGenWord(2, 1)

    harness.gen.handleRedoCurrentLine()
    // Clearing it would silently undo pass 1 from a button labelled "redo
    // line". Word 1 onward goes; word 0 stays.
    expect(harness.starts()[2]).toEqual([LINE_TIMES[2] + 1])
    expect(harness.gen.lrcGenWordIdx()).toBe(1)
  })

  it('does not jump to the top of the song when there is no time to find', () => {
    // A song imported as plain text has no canonical times at all, and a
    // line-pass redo has just cleared the one this session made.
    const plain = makeLrcGenHarness({
      lines: LINES,
      sessionId: 'redo-plain-text',
      withoutCanonical: true,
    })
    plain.gen.startLrcGen()
    plain.gen.setLrcGenLineTimes(() => [5, 15, 25])
    plain.gen.focusGenWord(1, 0)

    const before = plain.seeks().length
    plain.gen.handleRedoCurrentLine()
    // It rewinds to the start this session mapped rather than to zero.
    expect(plain.seeks().slice(before)).toEqual([preRollTarget(15)])
    plain.dispose()
  })
})
