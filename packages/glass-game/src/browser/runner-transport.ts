// Runner transport — one shared capture clock, scheduled count-in and finite music with cancellable release tails.
import type { SharedAudioLease } from '@irchiinnuss/audio-io'
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import type { CompiledRunnerCourse } from '../runner/contracts'
import type { RunnerAudioSchedule, RunnerAudioTransport, RunnerBackingAvailability, } from '../runner/session-contracts'
import { clampRunnerAudioPreferences, RUNNER_AUDIO_DEFAULTS, } from '../runner/session-contracts'
import type { RunnerBackingAssets } from './runner-music'
import { createRunnerBackingCache, loadRunnerBacking, renderRunnerCountIn, renderRunnerMusic, renderRunnerReference, RUNNER_JUDGE_GAIN, RUNNER_MUSIC_SAMPLE_RATE, runnerVoiceSpans, } from './runner-music'
import { RUNNER_FALLBACK_SHATTER_PROFILE, runnerShatterSafeSeconds, } from './runner-shatter-window'
import { createShatterBufferCache, prepareShatterBuffers, } from './shatter-buffer-cache'
import { createShatterPlayer } from './shatter-player'

const FLOOR = 0.0001
const RELEASE_SECONDS = 0.24
let nextTransport = 0

/** A tracked target envelope also supports browsers without cancelAndHoldAtTime. */
function level(param: AudioParam, initial: number, at: number) {
  let from = initial,
    target = initial,
    since = at,
    constant = 0.02
  param.setValueAtTime(initial, at)
  return (value: number, now: number, seconds: number): void => {
    const current =
      target + (from - target) * Math.exp(-Math.max(0, now - since) / constant)
    if (typeof param.cancelAndHoldAtTime === 'function')
      param.cancelAndHoldAtTime(now)
    else {
      param.cancelScheduledValues(now)
      param.setValueAtTime(current, now)
    }
    from = current
    target = value
    since = now
    constant = seconds / 5
    param.setTargetAtTime(value, now, constant)
  }
}

export function createBrowserRunnerTransport(
  course: CompiledRunnerCourse,
  comfortableMidi: number,
  options: {
    assetUrl(id: string): string
    backingCache?: ReturnType<typeof createRunnerBackingCache>
    shatterCache?: ReturnType<typeof createShatterBufferCache>
    effectsMuted?(): boolean
  },
): RunnerAudioTransport {
  let lease: SharedAudioLease | null = null
  let context: AudioContext | null = null
  let disposed = false,
    finished = false,
    scheduled = false,
    unlocking = false,
    voiceActive = false,
    prepared = false
  let preferences = RUNNER_AUDIO_DEFAULTS
  let backing: RunnerBackingAssets = {}
  const backingCache = options.backingCache ?? createRunnerBackingCache()
  const shatterCache = options.shatterCache ?? createShatterBufferCache()
  let fracture: ReturnType<typeof createShatterPlayer> | null = null
  let epochSchedule: RunnerAudioSchedule | null = null
  const abort = new AbortController()
  let backingReady: Promise<RunnerBackingAvailability> | undefined
  let backingTimer: ReturnType<typeof setTimeout> | undefined
  let ready: Promise<boolean> | undefined
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  let master: GainNode | undefined,
    music: GainNode | undefined,
    examples: GainNode | undefined,
    voice: GainNode | undefined,
    guard: GainNode | undefined,
    guideGuard: GainNode | undefined
  let setMusic: ReturnType<typeof level> | undefined,
    setExamples: ReturnType<typeof level> | undefined,
    setVoice: ReturnType<typeof level> | undefined
  const sources = new Set<AudioBufferSourceNode>()
  const completions = new Map<AudioBufferSourceNode, () => void>()
  const listeners = new Set<() => void>()
  let resolveFinished!: () => void
  const completion = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  let openedAt = Infinity

  function finish(): void {
    if (finished) return
    finished = true
    abort.abort()
    clearTimeout(backingTimer)
    clearTimeout(releaseTimer)
    for (const source of sources) {
      source.onended = null
      try {
        source.stop()
      } catch {
        /* Already ended. */
      }
      source.disconnect()
      completions.get(source)?.()
    }
    sources.clear()
    completions.clear()
    for (const node of [master, music, examples, voice, guard, guideGuard])
      node?.disconnect()
    void fracture?.dispose()
    backing = {}
    context?.removeEventListener('statechange', changed)
    lease?.release()
    lease = null
    resolveFinished()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    abort.abort()
    clearTimeout(backingTimer)
    listeners.clear()
    const hasFracture = fracture?.active() ?? false
    void fracture?.dispose()
    if (
      !context ||
      context.state !== 'running' ||
      (sources.size === 0 && !hasFracture)
    ) {
      finish()
      return
    }
    const at = context.currentTime
    if (typeof master!.gain.cancelAndHoldAtTime === 'function')
      master!.gain.cancelAndHoldAtTime(at)
    else {
      master!.gain.cancelScheduledValues(at)
      master!.gain.setValueAtTime(
        at < openedAt
          ? FLOOR
          : FLOOR * 10_000 ** Math.min(1, (at - openedAt) / 0.09),
        at,
      )
    }
    master!.gain.setTargetAtTime(0, at, 0.18 / 5)
    for (const source of sources) {
      try {
        source.stop(at + RELEASE_SECONDS)
      } catch {
        /* Already ended. */
      }
    }
    releaseTimer = setTimeout(finish, RELEASE_SECONDS * 1000)
  }

  function interrupted(): void {
    if (disposed) return
    const callbacks = [...listeners]
    dispose()
    for (const callback of callbacks) callback()
  }

  function changed(): void {
    if (context?.state === 'running') return
    if (unlocking && context?.state === 'suspended' && sources.size === 0)
      return
    interrupted()
    finish()
  }

  function running(): AudioContext {
    if (!context || context.state !== 'running' || disposed)
      throw new Error('Runner audio is not ready.')
    return context
  }

  function buffer(samples: Float32Array, sampleRate: number): AudioBuffer {
    const value = running().createBuffer(1, samples.length, sampleRate)
    value.getChannelData(0).set(samples)
    return value
  }

  function source(
    data: AudioBuffer,
    at: number,
    output: AudioNode,
    completion?: () => void,
  ): void {
    const node = running().createBufferSource()
    node.buffer = data
    node.playbackRate.setValueAtTime(1, at)
    node.connect(output)
    sources.add(node)
    if (completion) completions.set(node, completion)
    node.onended = () => {
      node.disconnect()
      sources.delete(node)
      completions.get(node)?.()
      completions.delete(node)
    }
    node.start(at)
  }

  function open(at: number): void {
    openedAt = at
    master!.gain.cancelScheduledValues(at)
    master!.gain.setValueAtTime(FLOOR, at)
    master!.gain.exponentialRampToValueAtTime(1, at + 0.09)
  }
  return {
    finished: completion,
    unlock() {
      if (disposed) return Promise.resolve(false)
      if (ready) return ready
      unlocking = true
      lease = acquireSharedAudioContext(`song-runner:${++nextTransport}`, {
        prepareToSuspend: () => {
          interrupted()
          return finished ? 0 : RELEASE_SECONDS * 1000
        },
      })
      context = lease.ensure()
      if (!context) {
        dispose()
        return Promise.resolve(false)
      }
      master = context.createGain()
      music = context.createGain()
      examples = context.createGain()
      voice = context.createGain()
      guard = context.createGain()
      guideGuard = context.createGain()
      guard
        .connect(voice)
        .connect(music)
        .connect(master)
        .connect(context.destination)
      guideGuard.connect(examples).connect(master)
      master.gain.setValueAtTime(FLOOR, context.currentTime)
      setMusic = level(
        music.gain,
        preferences.musicMuted ? 0 : preferences.musicVolume,
        context.currentTime,
      )
      setExamples = level(
        examples.gain,
        preferences.guideVolume,
        context.currentTime,
      )
      setVoice = level(voice.gain, 1, context.currentTime)
      guard.gain.setValueAtTime(1, context.currentTime)
      guideGuard.gain.setValueAtTime(1, context.currentTime)
      fracture = createShatterPlayer({
        context,
        output: master,
        cache: shatterCache,
        volume: () =>
          options.effectsMuted?.() === true ? 0 : preferences.effectsVolume,
        seed: course.revision,
      })
      context.addEventListener('statechange', changed)
      ready = lease.unlock().then(
        (ok) => {
          unlocking = false
          if (!ok || context?.state !== 'running' || disposed) {
            dispose()
            return false
          }
          return true
        },
        () => {
          unlocking = false
          dispose()
          return false
        },
      )
      return ready
    },
    prepareBacking() {
      if (disposed) return Promise.resolve({ music: false, ambience: false })
      if (backingReady) return backingReady
      if (scheduled) throw new Error('Runner backing cannot load during a run.')
      const ctx = running()
      backingTimer = setTimeout(() => abort.abort(), 15_000)
      backingReady = Promise.all([
        loadRunnerBacking(ctx, options.assetUrl, abort.signal, backingCache),
        prepareShatterBuffers(
          shatterCache,
          ctx,
          options.assetUrl,
          course.targets.map(
            (target) => target.soundProfile ?? RUNNER_FALLBACK_SHATTER_PROFILE,
          ),
          abort.signal,
        ),
      ]).then(([assets]) => {
        clearTimeout(backingTimer)
        if (!disposed) {
          backing = assets
          prepared = true
        }
        return Object.freeze({
          music: !disposed && !!assets.music,
          ambience: !disposed && !!assets.ambience,
        })
      })
      return backingReady
    },
    currentAudioSeconds: () =>
      !disposed && context?.state === 'running' ? context.currentTime : null,
    schedule(checkpoint) {
      if (scheduled) throw new Error('Runner transport already has an epoch.')
      const ctx = running()
      if (!prepared) throw new Error('Runner backing is not prepared.')
      // Decode and render first, then anchor. Preparation cannot eat count-in.
      const score = renderRunnerMusic(
        course,
        comfortableMidi,
        checkpoint.courseSeconds,
        backing,
      )
      const musicBuffer = buffer(score.backingSamples, score.sampleRate)
      const guideBuffer = buffer(score.guideSamples, score.sampleRate)
      const tempo =
        course.tempoSegments.find(
          (segment) =>
            checkpoint.beat >= segment.startBeat &&
            checkpoint.beat < segment.endBeat,
        ) ?? course.tempoSegments.at(-1)!
      const secondsPerBeat = 60 / tempo.bpm
      const clicks = renderRunnerCountIn(
        checkpoint.countInBeats,
        secondsPerBeat,
      )
      const clickBuffer = clicks.length
        ? buffer(clicks, RUNNER_MUSIC_SAMPLE_RATE)
        : null
      const start = ctx.currentTime + 0.08
      const audioStart = start + checkpoint.countInBeats * secondsPerBeat
      open(ctx.currentTime)
      if (clickBuffer) source(clickBuffer, start, examples!)
      if (backing.music || backing.ambience)
        source(musicBuffer, audioStart, guard!)
      source(guideBuffer, audioStart, guideGuard!)
      for (const span of runnerVoiceSpans(course)) {
        if (span.end <= checkpoint.courseSeconds) continue
        const from =
          audioStart + Math.max(0, span.start - checkpoint.courseSeconds)
        const until = audioStart + span.end - checkpoint.courseSeconds
        // Guides finish 100 ms before capture; their fade must follow the
        // final note. Backing gets a longer fade so the listening window is clear.
        for (const [guarded, lead] of [
          [guard!, 0.35],
          [guideGuard!, 0.09],
        ] as const) {
          guarded.gain.setTargetAtTime(
            RUNNER_JUDGE_GAIN,
            Math.max(audioStart, from - lead),
            0.035,
          )
          guarded.gain.setValueAtTime(RUNNER_JUDGE_GAIN, from)
          guarded.gain.setTargetAtTime(1, until, 0.3 / 5)
        }
      }
      scheduled = true
      const result: RunnerAudioSchedule = {
        countInStartAudioSeconds: start,
        audioStartSeconds: audioStart,
        courseStartSeconds: checkpoint.courseSeconds,
        secondsPerBeat,
        countInBeats: checkpoint.countInBeats,
      }
      epochSchedule = result
      return result
    },
    hearReference(midi) {
      const ctx = running()
      if (scheduled || !Number.isFinite(midi)) return Promise.resolve()
      const samples = renderRunnerReference(midi)
      open(ctx.currentTime)
      return new Promise<void>((resolve) =>
        source(
          buffer(samples, RUNNER_MUSIC_SAMPLE_RATE),
          ctx.currentTime + 0.03,
          examples!,
          resolve,
        ),
      )
    },
    setMuted(value) {
      preferences = clampRunnerAudioPreferences(
        { musicMuted: value },
        preferences,
      )
      if (!disposed && context)
        setMusic?.(
          value ? 0 : preferences.musicVolume,
          context.currentTime,
          0.12,
        )
    },
    setPreferences(patch) {
      if (disposed) return
      const previous = preferences
      preferences = clampRunnerAudioPreferences(patch, previous)
      fracture?.setVolume()
      if (!context) return
      if (
        preferences.musicMuted !== previous.musicMuted ||
        preferences.musicVolume !== previous.musicVolume
      )
        setMusic?.(
          preferences.musicMuted ? 0 : preferences.musicVolume,
          context.currentTime,
          0.12,
        )
      if (preferences.guideVolume !== previous.guideVolume)
        setExamples?.(preferences.guideVolume, context.currentTime, 0.12)
    },
    setVoiceActive(active) {
      if (voiceActive === active) return
      voiceActive = active
      if (!disposed && context)
        setVoice?.(active ? 0.5 : 1, context.currentTime, active ? 0.06 : 0.3)
    },
    shatter(targetId, atCourseSeconds) {
      if (
        disposed ||
        !scheduled ||
        !epochSchedule ||
        context?.state !== 'running'
      )
        return
      const target = course.targets.find((item) => item.id === targetId)
      if (!target) return
      const now =
        epochSchedule.courseStartSeconds +
        context.currentTime -
        epochSchedule.audioStartSeconds
      // Old catch-up events must not create a late sound in a newer capture window.
      if (now < atCourseSeconds - 0.03 || now - atCourseSeconds > 0.15) return
      const safe = runnerShatterSafeSeconds(course, targetId, now)
      fracture?.play(
        target.soundProfile ?? RUNNER_FALLBACK_SHATTER_PROFILE,
        target.id,
        safe,
      )
    },
    subscribeInterruption(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose,
  }
}
