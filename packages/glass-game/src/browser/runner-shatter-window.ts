// Runner fracture guard — earned one-shots end before another target's protected capture.
import type { CompiledRunnerCourse } from '../runner/contracts'

export const RUNNER_FALLBACK_SHATTER_PROFILE = Object.freeze({
  form: 'panel',
  size: 'large',
  material: 'frosted-glass',
} as const)

export function runnerShatterSafeSeconds(
  course: Pick<CompiledRunnerCourse, 'targets' | 'lengthCourseSeconds'>,
  completedTargetId: string,
  nowCourseSeconds: number,
): number {
  if (!Number.isFinite(nowCourseSeconds)) return 0
  let until = Math.min(course.lengthCourseSeconds, nowCourseSeconds + 4)
  for (const target of course.targets) {
    if (target.id === completedTargetId) continue
    const from = Math.max(0, target.protectedFromCourseSeconds - 0.35)
    const end = target.protectedUntilCourseSeconds + 0.3
    if (nowCourseSeconds >= from && nowCourseSeconds < end) return 0
    if (from > nowCourseSeconds) until = Math.min(until, from - 0.03)
  }
  return Math.max(0, until - nowCourseSeconds)
}
