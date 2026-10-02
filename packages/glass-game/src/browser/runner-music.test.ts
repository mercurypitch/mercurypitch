// Runner music tests — exact finite timing, safe previews and silence independent of gain automation.
import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse } from '../runner/contracts'
import { SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, SINGING_CURRENT_RESPONSIVE, } from '../runner/first-course'
import { runnerCourseFixture } from './__fixtures__/runner-course'
import { planRunnerPhraseGuides, renderRunnerCountIn, renderRunnerMusic, renderRunnerReference, RUNNER_BACKING_GAIN, RUNNER_MUSIC_SAMPLE_RATE, RUNNER_VOICE_GUARD_SECONDS, runnerVoiceSpans, } from './runner-music'

function measuredFrequency(samples: Float32Array, rate: number): number {
  const crossings: number[] = []
  for (let i = 1; i < samples.length; i++)
    if (samples[i - 1]! < 0 && samples[i]! >= 0)
      crossings.push(i - 1 - samples[i - 1]! / (samples[i]! - samples[i - 1]!))
  if (crossings.length < 2)
    throw new Error('The example has no sustained tone.')
  return ((crossings.length - 1) * rate) / (crossings.at(-1)! - crossings[0]!)
}

function recording() {
  const channels = [
    Float32Array.from({ length: 64 }, (_, index) => (index / 64) * 0.8),
  ]
  return {
    length: 64,
    sampleRate: 8,
    numberOfChannels: 1,
    getChannelData: (channel: number) => channels[channel]!,
  } as AudioBuffer
}

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
  it.each([
    [1.5, 1],
    [17, 1],
    [1, 17],
    [1, Number.NaN],
    [1, Number.POSITIVE_INFINITY],
  ])(
    'rejects an unsupported count-in before allocating PCM (%s beats, %s seconds per beat)',
    (beats, seconds) => {
      expect(() => renderRunnerCountIn(beats, seconds)).toThrow(
        'Runner count-in',
      )
    },
  )

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 181])(
    'rejects forged course duration %s before allocating either audio bus',
    (lengthCourseSeconds) => {
      expect(() =>
        renderRunnerMusic(
          { ...runnerCourseFixture(), lengthCourseSeconds },
          60,
        ),
      ).toThrow('Runner course audio')
    },
  )

  it.each([Number.NaN, -1, 181])(
    'rejects an invalid audio restart offset %s',
    (fromCourseSeconds) => {
      expect(() =>
        renderRunnerMusic(runnerCourseFixture(), 60, fromCourseSeconds),
      ).toThrow('Runner course audio')
    },
  )

  it('keeps comfortable-note reference and phrase examples at the exact calibrated pitch', () => {
    const course = runnerCourseFixture()
    const expected = 440 * 2 ** ((60 - 69) / 12)
    const reference = renderRunnerReference(60)
    const score = renderRunnerMusic(course, 60)
    const guide = score.guides[0]!
    const phrase = score.guideSamples.slice(
      Math.ceil((guide.start + 0.1) * score.sampleRate),
      Math.floor((guide.end - 0.2) * score.sampleRate),
    )

    for (const frequency of [
      measuredFrequency(
        reference.slice(
          RUNNER_MUSIC_SAMPLE_RATE * 0.1,
          RUNNER_MUSIC_SAMPLE_RATE * 0.5,
        ),
        RUNNER_MUSIC_SAMPLE_RATE,
      ),
      measuredFrequency(phrase, score.sampleRate),
    ])
      expect(Math.abs(1200 * Math.log2(frequency / expected))).toBeLessThan(
        0.05,
      )
  })
  it.each(pacingVariants)(
    'renders the authored $name course exactly once with finite bounded samples',
    ({ course, bpms, duration }) => {
      const score = renderRunnerMusic(course, 60, 0, { music: recording() })
      expect(course.tempoSegments.map((segment) => segment.bpm)).toEqual(bpms)
      expect(score.guideSamples.length / score.sampleRate).toBeCloseTo(
        duration,
        4,
      )
      expect(score.backingSamples.length).toBe(
        Math.ceil(duration * score.sampleRate),
      )
      let peak = 0
      expect(score.guideSamples.every(Number.isFinite)).toBe(true)
      expect(score.backingSamples.every(Number.isFinite)).toBe(true)
      for (const value of score.guideSamples)
        peak = Math.max(peak, Math.abs(value))
      expect(peak).toBeGreaterThan(0.1)
      expect(peak).toBeLessThanOrEqual(0.9)
      expect(score.backingSamples[0]).toBe(0)
      expect(score.backingSamples.at(-1)).toBe(0)
      expect(score.guideSamples[0]).toBe(0)
      expect(score.guideSamples.at(-1)).toBe(0)
    },
  )

  it.each(pacingVariants)(
    'contains absolute silence in every $name protected capture window, including checkpoint renders',
    ({ course }) => {
      for (const checkpoint of course.checkpoints) {
        const score = renderRunnerMusic(course, 60, checkpoint.courseSeconds, {
          music: recording(),
          ambience: recording(),
        })
        for (const guard of runnerVoiceSpans(course)) {
          const start = Math.max(
            0,
            Math.floor(
              (guard.start - checkpoint.courseSeconds) * score.sampleRate,
            ),
          )
          const end = Math.min(
            score.backingSamples.length,
            Math.ceil(
              (guard.end - checkpoint.courseSeconds) * score.sampleRate,
            ),
          )
          for (const samples of [score.backingSamples, score.guideSamples])
            expect(
              samples
                .slice(start, Math.max(start, end))
                .some((sample) => sample !== 0),
            ).toBe(false)
        }
        expect(score.backingSamples.every(Number.isFinite)).toBe(true)
        expect(score.guideSamples.every(Number.isFinite)).toBe(true)
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
    const backing = { music: recording() }
    const low = renderRunnerMusic(course, 48, 0, backing)
    const high = renderRunnerMusic(course, 60, 0, backing)
    const guide = low.guides[0]!
    const middle = Math.floor((guide.start + 0.3) * low.sampleRate)
    expect(low.guideSamples.slice(middle, middle + 100)).not.toEqual(
      high.guideSamples.slice(middle, middle + 100),
    )
    const after = Math.ceil((guide.end + 1) * low.sampleRate)
    expect(low.backingSamples.slice(after, after + 1000)).toEqual(
      high.backingSamples.slice(after, after + 1000),
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
        score.guideSamples.slice(start, end).some((sample) => sample !== 0),
      ).toBe(false)
    }
  })

  it('keeps the approved recording at its original rate across tempo changes and resumes at course phase', () => {
    const course = runnerCourseFixture()
    const music = recording()
    const full = renderRunnerMusic(course, 60, 0, { music })
    const checkpoint = course.checkpoints[1]!
    const resumed = renderRunnerMusic(course, 60, checkpoint.courseSeconds, {
      music,
    })

    // 39 and 41 course seconds straddle the tempo change. The eight-second
    // recording continues at its own rate, so these are source frames 56 and 8.
    expect(full.backingSamples[39 * full.sampleRate]).toBeCloseTo(
      music.getChannelData(0)[56]! * RUNNER_BACKING_GAIN,
      6,
    )
    expect(full.backingSamples[41 * full.sampleRate]).toBeCloseTo(
      music.getChannelData(0)[8]! * RUNNER_BACKING_GAIN,
      6,
    )
    expect(resumed.backingSamples[resumed.sampleRate]).toBeCloseTo(
      full.backingSamples[41 * full.sampleRate]!,
      6,
    )
    expect(resumed.backingSamples[3 * resumed.sampleRate]).toBeCloseTo(
      full.backingSamples[43 * full.sampleRate]!,
      6,
    )
  })

  it('adds no ongoing synthesized percussion when approved backing is absent', () => {
    const course = runnerCourseFixture()
    const score = renderRunnerMusic(course, 60)
    const guide = score.guides[0]!

    expect(score.backingSamples.some((sample) => sample !== 0)).toBe(false)
    expect(
      score.guideSamples
        .slice(Math.ceil(guide.end * score.sampleRate))
        .some((sample) => sample !== 0),
    ).toBe(false)
    expect(
      score.guideSamples
        .slice(
          Math.ceil(guide.start * score.sampleRate),
          Math.floor(guide.end * score.sampleRate),
        )
        .some((sample) => sample !== 0),
    ).toBe(true)
  })

  it('merges overlapping scoring spans so a release never reopens another target guard', () => {
    const original = runnerCourseFixture()
    const target = original.targets[0]!
    const course = {
      ...original,
      targets: [
        target,
        {
          ...target,
          id: 'overlap',
          protectedFromCourseSeconds: target.protectedUntilCourseSeconds - 0.2,
          protectedUntilCourseSeconds: target.protectedUntilCourseSeconds + 1,
        },
      ],
    }

    expect(runnerVoiceSpans(course)).toEqual([
      {
        start: target.protectedFromCourseSeconds - RUNNER_VOICE_GUARD_SECONDS,
        end: target.protectedUntilCourseSeconds + 1.3,
      },
    ])
  })
})
