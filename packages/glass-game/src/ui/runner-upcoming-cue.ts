// Runner preparation cue — resolved pitches and individual holds from the judged score.
import type { CompiledRunnerCourse, RunnerSnapshot } from '../runner/contracts'
import { runnerMidiName } from '../runner/notation'

export interface RunnerUpcomingCue {
  readonly targetId: string
  readonly notes: readonly {
    readonly pitch: string
    readonly duration: string
  }[]
  readonly label: 'Next glass' | 'This glass'
}

/** Visibility prepares a phrase; only the separate Sing cue opens scoring. */
export function runnerUpcomingCue(
  course: CompiledRunnerCourse,
  snapshot: Pick<
    RunnerSnapshot,
    'courseSeconds' | 'upcomingTargetIds' | 'activeTarget' | 'resolvedTargets'
  >,
  comfortableMidi: number,
): RunnerUpcomingCue | null {
  const visibleIds = new Set(snapshot.upcomingTargetIds)
  if (snapshot.activeTarget) visibleIds.add(snapshot.activeTarget.id)
  const resolvedIds = new Set(
    snapshot.resolvedTargets.map((target) => target.targetId),
  )
  const target = course.targets.find(
    (candidate) =>
      visibleIds.has(candidate.id) &&
      !resolvedIds.has(candidate.id) &&
      candidate.visibleFromCourseSeconds <= snapshot.courseSeconds &&
      candidate.settleAfterCourseSeconds >= snapshot.courseSeconds,
  )
  if (!target) return null
  const root = comfortableMidi + course.voice.comfortableRootOffsetSemitones
  return {
    targetId: target.id,
    label:
      snapshot.courseSeconds >= target.judgeOpenCourseSeconds
        ? 'This glass'
        : 'Next glass',
    notes: target.notes.map((note) => {
      const start = runnerMidiName(root + note.startOffsetSemitones).text
      const end = runnerMidiName(root + note.endOffsetSemitones).text
      const seconds =
        target.completionPolicy === 'charge'
          ? note.minimumReliableSeconds
          : note.endCourseSeconds - note.startCourseSeconds
      // Round upward, so the preparation cue never promises a shorter hold.
      const duration = (Math.ceil((seconds - 1e-9) * 10) / 10).toFixed(1)
      return {
        pitch: start === end ? start : `${start} → ${end}`,
        duration: `${duration}s`,
      }
    }),
  }
}
