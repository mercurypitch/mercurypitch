// ============================================================
// Song runner pitch tests — half-open note routing and shared glide contours.
// ============================================================

import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT_CURRENT } from './first-course'
import { runnerNoteOffsetAt, runnerTargetMidiAt, runnerTargetNoteAt, } from './pitch'

describe('song runner pitch contour', () => {
  const arc = SINGING_CURRENT_CURRENT.targets.find(
    (target) => target.id === 'arc-diadem',
  )!

  it('holds separate notes and linearly interpolates glides', () => {
    const separate = arc.notes[0]!
    const glide = arc.notes[1]!
    expect(runnerNoteOffsetAt(separate, separate.startCourseSeconds)).toBe(0)
    expect(
      runnerNoteOffsetAt(
        glide,
        (glide.startCourseSeconds + glide.endCourseSeconds) / 2,
      ),
    ).toBeCloseTo(1, 12)
    expect(runnerNoteOffsetAt(glide, glide.endCourseSeconds)).toBe(2)
  })

  it('routes half-open note intervals and clamps presentation pitch at phrase ends', () => {
    const first = arc.notes[0]!
    const second = arc.notes[1]!
    expect(runnerTargetNoteAt(arc.notes, first.startCourseSeconds)?.index).toBe(
      0,
    )
    expect(runnerTargetNoteAt(arc.notes, first.endCourseSeconds)?.index).toBe(1)
    expect(runnerTargetNoteAt(arc.notes, arc.endCourseSeconds)).toBeUndefined()
    expect(
      runnerTargetMidiAt(arc.notes, first.startCourseSeconds - 1, 60),
    ).toBe(60)
    expect(runnerTargetMidiAt(arc.notes, arc.endCourseSeconds + 1, 60)).toBe(60)
    expect(second.startOffsetSemitones).toBe(first.endOffsetSemitones)
  })
})
