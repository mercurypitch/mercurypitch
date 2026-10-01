// Runner score — finite tempo-locked accompaniment and exact phrase previews outside voice and movement windows.
import type { CompiledRunnerCourse, CompiledRunnerTarget, } from '../runner/contracts'
import { runnerNoteMidiAt } from '../runner/pitch'
import { runnerBeatToSeconds } from '../runner/tempo'

export const RUNNER_MUSIC_SAMPLE_RATE = 24_000
export const RUNNER_VOICE_GUARD_SECONDS = 0.35
export const RUNNER_JUDGE_GAIN = 0.0001

interface Span {
  start: number
  end: number
}
export interface RunnerPhraseGuide extends Span {
  readonly target: CompiledRunnerTarget
}

export function runnerVoiceSpans(
  course: CompiledRunnerCourse,
): readonly Span[] {
  return course.targets.map((target) => ({
    start: Math.max(
      0,
      target.protectedFromCourseSeconds - RUNNER_VOICE_GUARD_SECONDS,
    ),
    end: Math.min(
      course.lengthCourseSeconds,
      target.protectedUntilCourseSeconds + 0.3,
    ),
  }))
}

/** Keep the complete authored rhythm; a crowded window omits a preview, never speeds it up. */
export function planRunnerPhraseGuides(
  course: CompiledRunnerCourse,
): readonly RunnerPhraseGuide[] {
  const forbidden = [
    ...runnerVoiceSpans(course),
    ...course.obstacles.flatMap((obstacle) =>
      obstacle.certifiedActions.map((action) => ({
        start: Math.max(0, action.launchOpenCourseSeconds - 0.1),
        end: action.landingCloseCourseSeconds + 0.1,
      })),
    ),
  ]
  const result: RunnerPhraseGuide[] = []
  for (const target of course.targets) {
    const duration = target.endCourseSeconds - target.onsetCourseSeconds
    let end =
      target.protectedFromCourseSeconds - RUNNER_VOICE_GUARD_SECONDS - 0.1
    const previous = result.at(-1)?.end ?? 0
    for (let attempt = 0; attempt <= forbidden.length; attempt++) {
      const start = end - duration
      if (start < previous || start < 0) break
      const conflict = forbidden
        .filter((span) => start < span.end && end > span.start)
        .sort((a, b) => b.start - a.start)
        .at(0)
      if (conflict) {
        end = conflict.start - 0.1
        continue
      }
      result.push({ target, start, end })
      break
    }
  }
  return result
}

function edgeEnvelope(
  seconds: number,
  duration: number,
  attack = 0.008,
): number {
  if (seconds < attack) return 0.0001 * 10_000 ** (seconds / attack)
  const release = Math.min(0.18, duration / 3)
  return seconds > duration - release
    ? Math.exp((-12 * (seconds - duration + release)) / release)
    : 1
}

/** PCM is generated before count-in, with no fetch/decode or timer-driven note scheduling during play. */
export function renderRunnerMusic(
  course: CompiledRunnerCourse,
  comfortableMidi: number,
  fromCourseSeconds = 0,
): {
  readonly samples: Float32Array
  readonly sampleRate: number
  readonly guides: readonly RunnerPhraseGuide[]
} {
  const rate = RUNNER_MUSIC_SAMPLE_RATE
  const duration = course.lengthCourseSeconds - fromCourseSeconds
  const samples = new Float32Array(Math.max(1, Math.ceil(duration * rate)))
  const guards = runnerVoiceSpans(course)
  const guides = planRunnerPhraseGuides(course).filter(
    (guide) => guide.start >= fromCourseSeconds,
  )
  let random = course.seed >>> 0 || 1

  function noise(): number {
    random ^= random << 13
    random ^= random >>> 17
    random ^= random << 5
    return (random >>> 0) / 0x80000000 - 1
  }

  function add(
    at: number,
    length: number,
    amplitude: number,
    wave: (time: number) => number,
  ): void {
    const start = Math.max(0, Math.ceil((at - fromCourseSeconds) * rate))
    const end = Math.min(
      samples.length,
      Math.floor((at + length - fromCourseSeconds) * rate),
    )
    for (let i = start; i < end; i++) {
      const time = i / rate + fromCourseSeconds - at
      samples[i] += amplitude * wave(time) * edgeEnvelope(time, length)
    }
  }
  for (let beat = 0; beat < course.lengthBeats; beat += 0.5) {
    const at = runnerBeatToSeconds(course.tempoSegments, beat)
    if (at < fromCourseSeconds - 0.5) continue
    const onBeat = Number.isInteger(beat)
    if (onBeat) {
      add(
        at,
        0.18,
        beat % 4 === 0 ? 0.13 : 0.075,
        (time) =>
          Math.sin(
            2 * Math.PI * (45 * time + (24 * (1 - Math.exp(-time * 35))) / 35),
          ) * Math.exp(-time * 20),
      )
    }
    add(
      at,
      0.055,
      onBeat ? 0.022 : 0.032,
      (time) => noise() * Math.exp(-time * 45),
    )
    if (beat % 4 === 0) {
      const midi = [36, 41, 33, 43][Math.floor(beat / 4) % 4]!
      const frequency = 440 * 2 ** ((midi - 69) / 12)
      add(
        at,
        0.42,
        0.065,
        (time) =>
          (Math.sin(2 * Math.PI * frequency * time) +
            0.13 * Math.sin(4 * Math.PI * frequency * time)) *
          Math.exp(-time * 3),
      )
    }
  }
  const root = comfortableMidi + course.voice.comfortableRootOffsetSemitones
  for (const guide of guides) {
    for (const note of guide.target.notes) {
      const at =
        guide.start + note.startCourseSeconds - guide.target.onsetCourseSeconds
      const length = note.endCourseSeconds - note.startCourseSeconds
      let phase = 0
      add(at, length, 0.16, (time) => {
        const midi = runnerNoteMidiAt(
          note,
          note.startCourseSeconds + time,
          root,
        )
        phase += (2 * Math.PI * 440 * 2 ** ((midi - 69) / 12)) / rate
        return Math.sin(phase) + 0.15 * Math.sin(phase * 2)
      })
    }
  }
  // Silence is authored into the buffer too: a gain automation regression must
  // not turn our own backing or preview into valid pitch evidence.
  for (const guard of guards) {
    const start = Math.min(
      samples.length,
      Math.max(0, Math.floor((guard.start - fromCourseSeconds) * rate)),
    )
    const end = Math.max(
      0,
      Math.min(
        samples.length,
        Math.ceil((guard.end - fromCourseSeconds) * rate),
      ),
    )
    const fade = Math.round(0.09 * rate)
    for (let i = Math.max(0, start - fade); i < start; i++)
      samples[i] *= Math.exp((-10 * (i - start + fade)) / fade)
    samples.fill(0, start, Math.max(start, end))
    for (let i = end; i < Math.min(samples.length, end + fade); i++)
      samples[i] *= 0.0001 * 10_000 ** ((i - end) / fade)
  }
  for (let i = 0; i < samples.length; i++) {
    const at = i / rate
    samples[i] =
      Math.max(-0.9, Math.min(0.9, samples[i]!)) *
      edgeEnvelope(at, duration, 0.09)
  }
  samples[0] = 0
  samples[samples.length - 1] = 0
  return { samples, sampleRate: rate, guides }
}
