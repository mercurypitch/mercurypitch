// Runner music tests — exact finite timing, safe previews and silence independent of gain automation.
import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from '../runner/first-course'
import { runnerCourseFixture } from './__fixtures__/runner-course'
import { planRunnerPhraseGuides, renderRunnerMusic, runnerVoiceSpans, } from './runner-music'

describe('runner score', () => {
  it('renders the authored 96/108/116 course exactly once with finite bounded samples', () => {
    const score = renderRunnerMusic(SINGING_CURRENT, 60)
    expect(SINGING_CURRENT.tempoSegments.map((segment) => segment.bpm)).toEqual(
      [96, 108, 116],
    )
    expect(score.samples.length / score.sampleRate).toBeCloseTo(90.881226, 4)
    let peak = 0
    expect(score.samples.every(Number.isFinite)).toBe(true)
    for (const value of score.samples) peak = Math.max(peak, Math.abs(value))
    expect(peak).toBeGreaterThan(0.1)
    expect(peak).toBeLessThanOrEqual(0.9)
    expect(score.samples[0]).toBe(0)
    expect(score.samples.at(-1)).toBe(0)
  })

  it('contains absolute silence in every protected capture window, including checkpoint renders', () => {
    for (const checkpoint of SINGING_CURRENT.checkpoints) {
      const score = renderRunnerMusic(
        SINGING_CURRENT,
        60,
        checkpoint.courseSeconds,
      )
      for (const guard of runnerVoiceSpans(SINGING_CURRENT)) {
        const start = Math.max(
          0,
          Math.floor(
            (guard.start - checkpoint.courseSeconds) * score.sampleRate,
          ),
        )
        const end = Math.min(
          score.samples.length,
          Math.ceil((guard.end - checkpoint.courseSeconds) * score.sampleRate),
        )
        expect(
          score.samples
            .slice(start, Math.max(start, end))
            .some((sample) => sample !== 0),
        ).toBe(false)
      }
      expect(score.samples.every(Number.isFinite)).toBe(true)
    }
  })

  it('keeps complete previews at the authored rhythm outside singing and certified movement', () => {
    const guides = planRunnerPhraseGuides(SINGING_CURRENT)
    expect(guides.length).toBeGreaterThan(0)
    for (const guide of guides) {
      expect(guide.end - guide.start).toBeCloseTo(
        guide.target.endCourseSeconds - guide.target.onsetCourseSeconds,
        10,
      )
      expect(guide.end).toBeLessThan(guide.target.protectedFromCourseSeconds)
      const forbidden = [
        ...runnerVoiceSpans(SINGING_CURRENT),
        ...SINGING_CURRENT.obstacles.flatMap((obstacle) =>
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
  })

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
})
