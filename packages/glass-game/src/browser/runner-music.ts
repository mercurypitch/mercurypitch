// Runner score — approved recordings at their original rate and calibrated previews, prepared with hard scoring silence.
import { fetchAssetBytes } from '@irchiinnuss/mobile-runtime/asset-fetch'
import type { CompiledRunnerCourse, CompiledRunnerTarget, } from '../runner/contracts'
import { runnerNoteMidiAt } from '../runner/pitch'
import { RUNNER_MAXIMUM_COUNT_IN_BEATS, RUNNER_MAXIMUM_COUNT_IN_SECONDS,RUNNER_MAXIMUM_COURSE_SECONDS,  } from '../runner/resource-limits'
import { repairMuseumLoop } from './museum-loop'

export const RUNNER_MUSIC_SAMPLE_RATE = 24_000
export const RUNNER_VOICE_GUARD_SECONDS = 0.35
export const RUNNER_JUDGE_GAIN = 0.0001
export const RUNNER_BACKING_GAIN = 0.45
export const RUNNER_AMBIENCE_BLEND = 0.12
export const RUNNER_BACKING_ASSETS = [
  'audio-m03-loop',
  'audio-a02-loop',
] as const

export interface RunnerBackingAssets {
  readonly music?: AudioBuffer
  readonly ambience?: AudioBuffer
}

/** Two approved buffers and at most one uncancellable native decode per asset. */
export function createRunnerBackingCache() {
  return {
    buffers: new Map<string, { url: string; buffer: AudioBuffer }>(),
    decoding: new Map<string, Promise<void>>(),
  }
}

function cancellable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new Error('Runner backing cancelled.'))
    signal.addEventListener('abort', cancel, { once: true })
    void work.then(
      (value) => {
        signal.removeEventListener('abort', cancel)
        if (signal.aborted) cancel()
        else resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', cancel)
        reject(error)
      },
    )
    if (signal.aborted) cancel()
  })
}

export async function loadRunnerBacking(
  context: AudioContext,
  assetUrl: (id: string) => string,
  signal: AbortSignal,
  cache: ReturnType<typeof createRunnerBackingCache>,
): Promise<RunnerBackingAssets> {
  async function load(id: string): Promise<AudioBuffer | undefined> {
    try {
      const url = assetUrl(id)
      const cached = cache.buffers.get(id)
      if (cached?.url === url && !signal.aborted) return cached.buffer
      // A cancelled decode cannot be stopped by Web Audio. Wait for its slot
      // rather than starting more native decoders on repeated Start presses.
      while (cache.decoding.has(id))
        await cancellable(cache.decoding.get(id)!, signal)
      if (signal.aborted) return undefined
      const shared = cache.buffers.get(id)
      if (shared?.url === url) return shared.buffer
      const bytes = await cancellable(fetchAssetBytes(url, { signal }), signal)
      while (cache.decoding.has(id))
        await cancellable(cache.decoding.get(id)!, signal)
      if (signal.aborted) return undefined
      const ready = cache.buffers.get(id)
      if (ready?.url === url) return ready.buffer
      const decoding = context.decodeAudioData(bytes)
      const slot = decoding.then(
        () => undefined,
        () => undefined,
      )
      cache.decoding.set(id, slot)
      void slot.then(() => {
        if (cache.decoding.get(id) === slot) cache.decoding.delete(id)
      })
      const decoded = await cancellable(decoding, signal)
      if (signal.aborted) return undefined
      const repaired = repairMuseumLoop(context, decoded)
      cache.buffers.set(id, { url, buffer: repaired })
      return repaired
    } catch {
      // Backing is optional. Its availability is published to the sound panel.
      return undefined
    }
  }
  const [music, ambience] = await Promise.all(RUNNER_BACKING_ASSETS.map(load))
  return { music, ambience }
}

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
  const spans = course.targets
    .map((target) => ({
      start: Math.max(
        0,
        target.protectedFromCourseSeconds - RUNNER_VOICE_GUARD_SECONDS,
      ),
      end: Math.min(
        course.lengthCourseSeconds,
        target.protectedUntilCourseSeconds + 0.3,
      ),
    }))
    .sort((a, b) => a.start - b.start)
  const merged: Span[] = []
  for (const span of spans) {
    const previous = merged.at(-1)
    if (previous && previous.end >= span.start)
      previous.end = Math.max(previous.end, span.end)
    else merged.push({ ...span })
  }
  return merged
}

/** Keep each target's compiled preview duration; a crowded window omits it. */
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
    const duration = target.previewDurationSeconds
    let end =
      target.protectedFromCourseSeconds - RUNNER_VOICE_GUARD_SECONDS - 0.1
    const previous = result.at(-1)?.end ?? 0
    for (let attempt = 0; attempt <= forbidden.length; attempt++) {
      const start = end - duration
      if (
        start < previous ||
        start < 0 ||
        (target.completionPolicy === 'charge' &&
          start < target.visibleFromCourseSeconds)
      )
        break
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

export function renderRunnerCountIn(
  countInBeats: number,
  secondsPerBeat: number,
): Float32Array {
  const duration = countInBeats * secondsPerBeat
  if (
    !Number.isInteger(countInBeats) ||
    countInBeats < 1 ||
    countInBeats > RUNNER_MAXIMUM_COUNT_IN_BEATS ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > RUNNER_MAXIMUM_COUNT_IN_SECONDS
  )
    throw new Error('Runner count-in exceeds the supported audio budget.')
  const rate = RUNNER_MUSIC_SAMPLE_RATE
  const samples = new Float32Array(Math.ceil(duration * rate))
  for (let beat = 0; beat < countInBeats; beat++) {
    const first = Math.round(beat * secondsPerBeat * rate)
    for (let i = 0; i < rate * 0.055 && first + i < samples.length; i++) {
      const t = i / rate
      samples[first + i] =
        Math.sin(2 * Math.PI * (beat === 0 ? 1000 : 750) * t) *
        0.12 *
        (t < 0.003 ? 0.0001 * 10_000 ** (t / 0.003) : 1) *
        Math.exp(-t * 110)
    }
  }
  return samples
}

export function renderRunnerReference(midi: number): Float32Array {
  const rate = RUNNER_MUSIC_SAMPLE_RATE
  const samples = new Float32Array(rate * 0.8)
  const frequency = 440 * 2 ** ((midi - 69) / 12)
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate
    const gain =
      t < 0.09
        ? 0.0001 * 10_000 ** (t / 0.09)
        : t > 0.56
          ? Math.exp(-(t - 0.56) / 0.036)
          : 1
    samples[i] = 0.18 * Math.sin(2 * Math.PI * frequency * t) * gain
  }
  samples[samples.length - 1] = 0
  return samples
}

/** Finite PCM follows course seconds, with no tempo warping or fetching during play. */
export function renderRunnerMusic(
  course: CompiledRunnerCourse,
  comfortableMidi: number,
  fromCourseSeconds = 0,
  backing: RunnerBackingAssets = {},
): {
  readonly backingSamples: Float32Array
  readonly guideSamples: Float32Array
  readonly sampleRate: number
  readonly guides: readonly RunnerPhraseGuide[]
} {
  if (
    !Number.isFinite(course.lengthCourseSeconds) ||
    course.lengthCourseSeconds <= 0 ||
    course.lengthCourseSeconds > RUNNER_MAXIMUM_COURSE_SECONDS ||
    !Number.isFinite(fromCourseSeconds) ||
    fromCourseSeconds < 0 ||
    fromCourseSeconds > course.lengthCourseSeconds
  )
    throw new Error('Runner course audio exceeds the supported finite budget.')
  const rate = RUNNER_MUSIC_SAMPLE_RATE
  const duration = course.lengthCourseSeconds - fromCourseSeconds
  const length = Math.max(1, Math.ceil(duration * rate))
  const guideSamples = new Float32Array(length)
  const backingSamples = new Float32Array(length)
  const guards = runnerVoiceSpans(course)
  const guides = planRunnerPhraseGuides(course).filter(
    (guide) => guide.start >= fromCourseSeconds,
  )

  function add(
    at: number,
    length: number,
    amplitude: number,
    wave: (time: number) => number,
  ): void {
    const start = Math.max(0, Math.ceil((at - fromCourseSeconds) * rate))
    const end = Math.min(
      guideSamples.length,
      Math.floor((at + length - fromCourseSeconds) * rate),
    )
    for (let i = start; i < end; i++) {
      const time = i / rate + fromCourseSeconds - at
      guideSamples[i] += amplitude * wave(time) * edgeEnvelope(time, length)
    }
  }
  for (const [data, mix] of [
    [backing.music, RUNNER_BACKING_GAIN],
    [backing.ambience, RUNNER_BACKING_GAIN * RUNNER_AMBIENCE_BLEND],
  ] as const) {
    if (!data) continue
    const channels = Array.from(
      { length: data.numberOfChannels },
      (_, channel) => data.getChannelData(channel),
    )
    for (let i = 0; i < length; i++) {
      const position =
        ((fromCourseSeconds + i / rate) * data.sampleRate) % data.length
      const first = Math.floor(position)
      const blend = position - first
      for (const channel of channels)
        backingSamples[i] +=
          (mix / channels.length) *
          (channel[first]! * (1 - blend) +
            channel[(first + 1) % data.length]! * blend)
    }
  }
  const root = comfortableMidi + course.voice.comfortableRootOffsetSemitones
  for (const guide of guides) {
    const authoredDuration =
      guide.target.endCourseSeconds - guide.target.onsetCourseSeconds
    const previewScale = guide.target.previewDurationSeconds / authoredDuration
    for (const note of guide.target.notes) {
      const at =
        guide.start +
        (note.startCourseSeconds - guide.target.onsetCourseSeconds) *
          previewScale
      const length =
        (note.endCourseSeconds - note.startCourseSeconds) * previewScale
      let phase = 0
      add(at, length, 0.16, (time) => {
        const midi = runnerNoteMidiAt(
          note,
          note.startCourseSeconds + time / previewScale,
          root,
        )
        phase += (2 * Math.PI * 440 * 2 ** ((midi - 69) / 12)) / rate
        return Math.sin(phase) + 0.15 * Math.sin(phase * 2)
      })
    }
  }
  // Both buses are hard-zero in scoring windows even if gain automation fails.
  for (const samples of [backingSamples, guideSamples]) {
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
  }
  return { backingSamples, guideSamples, sampleRate: rate, guides }
}
