// Runner music tests — exact finite timing, safe previews and silence independent of gain automation.
import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse } from '../runner/contracts'
import { SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, SINGING_CURRENT_RESPONSIVE, } from '../runner/first-course'
import { runnerCourseFixture } from './__fixtures__/runner-course'
import { planRunnerPhraseGuides, renderRunnerMusic, RUNNER_VOICE_GUARD_SECONDS, runnerVoiceSpans, } from './runner-music'

const pacingVariants: readonly {
  name: string
  course: CompiledRunnerCourse
  bpms: readonly number[]
  duration: number
}[] = [
  {
    name: 'current',
    course: SINGING_CURRENT_CURRENT,
    bpms: [96, 108, 116],
    duration: 90.88122605363984,
  },
  {
    name: 'learning',
    course: SINGING_CURRENT_LEARNING,
    bpms: [84, 96, 104],
    duration: 102.63736263736264,
  },
]

describe('runner score', () => {
  it.each(pacingVariants)(
    'renders the authored $name course exactly once with finite bounded samples',
    ({ course, bpms, duration }) => {
      const score = renderRunnerMusic(course, 60)
      expect(course.tempoSegments.map((segment) => segment.bpm)).toEqual(bpms)
      expect(score.samples.length / score.sampleRate).toBeCloseTo(duration, 4)
      expect(score.samples.length).toBe(Math.ceil(duration * score.sampleRate))
      let peak = 0
      expect(score.samples.every(Number.isFinite)).toBe(true)
      for (const value of score.samples) peak = Math.max(peak, Math.abs(value))
      expect(peak).toBeGreaterThan(0.1)
      expect(peak).toBeLessThanOrEqual(0.9)
      expect(score.samples[0]).toBe(0)
      expect(score.samples.at(-1)).toBe(0)
    },
  )

  it.each(pacingVariants)(
    'contains absolute silence in every $name protected capture window, including checkpoint renders',
    ({ course }) => {
      for (const checkpoint of course.checkpoints) {
        const score = renderRunnerMusic(course, 60, checkpoint.courseSeconds)
        for (const guard of runnerVoiceSpans(course)) {
          const start = Math.max(
            0,
            Math.floor(
              (guard.start - checkpoint.courseSeconds) * score.sampleRate,
            ),
          )
          const end = Math.min(
            score.samples.length,
            Math.ceil(
              (guard.end - checkpoint.courseSeconds) * score.sampleRate,
            ),
          )
          expect(
            score.samples
              .slice(start, Math.max(start, end))
              .some((sample) => sample !== 0),
          ).toBe(false)
        }
        expect(score.samples.every(Number.isFinite)).toBe(true)
      }
    },
  )

  it.each(pacingVariants)(
    'keeps complete $name previews at the authored rhythm outside singing and certified movement',
    ({ course }) => {
      const guides = planRunnerPhraseGuides(course)
      expect(guides.length).toBeGreaterThan(0)
      for (const guide of guides) {
        expect(guide.end - guide.start).toBeCloseTo(
          guide.target.endCourseSeconds - guide.target.onsetCourseSeconds,
          10,
        )
        expect(guide.end).toBeLessThan(guide.target.protectedFromCourseSeconds)
        const forbidden = [
          ...runnerVoiceSpans(course),
          ...course.obstacles.flatMap((obstacle) =>
            obstacle.certifiedActions.map((action) => ({
              start: action.launchOpenCourseSeconds,
              end: action.landingCloseCourseSeconds,
            })),
          ),
        ]
        expect(
          forbidden.some(
            (span) => guide.start < span.end && guide.end > span.start,
          ),
        ).toBe(false)
      }
    },
  )

  it('transposes the preview while leaving the accompaniment unchanged and skips partial restart previews', () => {
    const course = runnerCourseFixture()
    const low = renderRunnerMusic(course, 48)
    const high = renderRunnerMusic(course, 60)
    const guide = low.guides[0]!
    const middle = Math.floor((guide.start + 0.3) * low.sampleRate)
    expect(low.samples.slice(middle, middle + 100)).not.toEqual(
      high.samples.slice(middle, middle + 100),
    )
    const after = Math.ceil((guide.end + 1) * low.sampleRate)
    expect(low.samples.slice(after, after + 1000)).toEqual(
      high.samples.slice(after, after + 1000),
    )
    expect(renderRunnerMusic(course, 60, guide.start + 0.1).guides).toEqual([])
  })

  it('keeps responsive previews short, visible, and wholly ahead of the acoustic guard', () => {
    const guides = planRunnerPhraseGuides(SINGING_CURRENT_RESPONSIVE)
    expect(guides.map((guide) => guide.target.id)).toEqual(
      SINGING_CURRENT_RESPONSIVE.targets.map((target) => target.id),
    )
    for (const guide of guides) {
      expect(guide.end - guide.start).toBeCloseTo(
        guide.target.previewDurationSeconds,
        10,
      )
      expect(guide.target.previewDurationSeconds).toBeLessThan(
        guide.target.endCourseSeconds - guide.target.onsetCourseSeconds,
      )
      expect(guide.start).toBeGreaterThanOrEqual(
        guide.target.visibleFromCourseSeconds,
      )
      expect(guide.end).toBeLessThanOrEqual(
        guide.target.protectedFromCourseSeconds -
          RUNNER_VOICE_GUARD_SECONDS -
          0.1 +
          1e-9,
      )
    }
    for (const checkpoint of SINGING_CURRENT_RESPONSIVE.checkpoints) {
      expect(
        guides
          .filter((guide) => guide.start >= checkpoint.courseSeconds - 1e-9)
          .map((guide) => guide.target.id),
      ).toEqual(
        SINGING_CURRENT_RESPONSIVE.targets
          .filter(
            (target) =>
              target.onsetCourseSeconds > checkpoint.courseSeconds + 1e-9,
          )
          .map((target) => target.id),
      )
    }

    const score = renderRunnerMusic(SINGING_CURRENT_RESPONSIVE, 60)
    for (const guard of runnerVoiceSpans(SINGING_CURRENT_RESPONSIVE)) {
      const start = Math.floor(guard.start * score.sampleRate)
      const end = Math.ceil(guard.end * score.sampleRate)
      expect(
        score.samples.slice(start, end).some((sample) => sample !== 0),
      ).toBe(false)
    }
  })
})
