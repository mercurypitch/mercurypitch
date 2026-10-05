// Preparation cue tests — the UI describes the actual notes and charge, not a whole phrase hold.
import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from '../runner/first-course'
import { runnerUpcomingCue } from './runner-upcoming-cue'

const course = SINGING_CURRENT
const target = course.targets.find((item) => item.notes.length === 3)!
const snapshot = {
  courseSeconds: target.visibleFromCourseSeconds,
  upcomingTargetIds: [target.id],
  activeTarget: null,
  resolvedTargets: [],
}

describe('runner upcoming preparation', () => {
  it('shows every resolved pitch, octave and individual hold before judging opens', () => {
    const cue = runnerUpcomingCue(course, snapshot, 61)!
    expect(cue.label).toBe('Next glass')
    expect(cue.targetId).toBe(target.id)
    expect(cue.notes).toHaveLength(3)
    expect(cue.notes.map((note) => note.pitch)).toEqual(['C#4', 'D#4', 'C#4'])
    cue.notes.forEach((note, index) => {
      const seconds = target.notes[index]!.minimumReliableSeconds
      expect(Number.parseFloat(note.duration)).toBeGreaterThanOrEqual(seconds)
      expect(Number.parseFloat(note.duration) - seconds).toBeLessThan(0.1)
    })
  })
  it('does not leak the next target before its authored visibility window', () => {
    expect(
      runnerUpcomingCue(
        course,
        { ...snapshot, courseSeconds: target.visibleFromCourseSeconds - 0.01 },
        60,
      ),
    ).toBeNull()
    expect(
      runnerUpcomingCue(course, { ...snapshot, upcomingTargetIds: [] }, 60),
    ).toBeNull()
  })
  it('keeps preparation visible in the response window without relabeling it as a sing command', () => {
    expect(
      runnerUpcomingCue(
        course,
        { ...snapshot, courseSeconds: target.judgeOpenCourseSeconds },
        60,
      )?.label,
    ).toBe('This glass')
    expect(
      runnerUpcomingCue(
        course,
        { ...snapshot, courseSeconds: target.settleAfterCourseSeconds + 0.01 },
        60,
      ),
    ).toBeNull()
  })
  it('removes a settled wall and takes the next visible wall in course order', () => {
    const first = course.targets[0]!
    const second = course.targets[1]!
    const cue = runnerUpcomingCue(
      course,
      {
        courseSeconds: second.visibleFromCourseSeconds,
        upcomingTargetIds: [first.id, second.id],
        activeTarget: null,
        resolvedTargets: [{ targetId: first.id } as never],
      },
      60,
    )
    expect(cue?.targetId).toBe(second.id)
  })
})
