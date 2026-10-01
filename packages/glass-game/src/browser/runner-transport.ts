// Runner transport — one shared capture clock, scheduled count-in and finite music with cancellable release tails.
import type { SharedAudioLease } from '@irchiinnuss/audio-io'
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import type { CompiledRunnerCourse } from '../runner/contracts'
import type { RunnerAudioSchedule, RunnerAudioTransport, } from '../runner/session-contracts'
import { renderRunnerMusic, RUNNER_JUDGE_GAIN, runnerVoiceSpans, } from './runner-music'

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
): RunnerAudioTransport {
  let lease: SharedAudioLease | null = null
  let context: AudioContext | null = null
  let disposed = false,
    finished = false,
    scheduled = false,
    unlocking = false,
    muted = false
  let ready: Promise<boolean> | undefined
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  let master: GainNode | undefined,
    mute: GainNode | undefined,
    voice: GainNode | undefined,
    guard: GainNode | undefined
  let setMute: ReturnType<typeof level> | undefined,
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
    for (const node of [master, mute, voice, guard]) node?.disconnect()
    context?.removeEventListener('statechange', changed)
    lease?.release()
    lease = null
    resolveFinished()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    listeners.clear()
    if (!context || context.state !== 'running' || sources.size === 0) {
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
      mute = context.createGain()
      voice = context.createGain()
      guard = context.createGain()
      guard
        .connect(voice)
        .connect(mute)
        .connect(master)
        .connect(context.destination)
      master.gain.setValueAtTime(FLOOR, context.currentTime)
      setMute = level(mute.gain, muted ? 0 : 0.65, context.currentTime)
      setVoice = level(voice.gain, 1, context.currentTime)
      guard.gain.setValueAtTime(1, context.currentTime)
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
    currentAudioSeconds: () =>
      !disposed && context?.state === 'running' ? context.currentTime : null,
    schedule(checkpoint) {
      if (scheduled) throw new Error('Runner transport already has an epoch.')
      const ctx = running()
      // Generate first, then anchor. Synthesis time cannot eat the count-in.
      const score = renderRunnerMusic(
        course,
        comfortableMidi,
        checkpoint.courseSeconds,
      )
      const music = buffer(score.samples, score.sampleRate)
      const tempo =
        course.tempoSegments.find(
          (segment) =>
            checkpoint.beat >= segment.startBeat &&
            checkpoint.beat < segment.endBeat,
        ) ?? course.tempoSegments.at(-1)!
      const secondsPerBeat = 60 / tempo.bpm
      const start = ctx.currentTime + 0.08
      const audioStart = start + checkpoint.countInBeats * secondsPerBeat
      const clickRate = 24_000
      const clicks = new Float32Array(
        Math.ceil(checkpoint.countInBeats * secondsPerBeat * clickRate),
      )
      for (let beat = 0; beat < checkpoint.countInBeats; beat++) {
        const first = Math.round(beat * secondsPerBeat * clickRate)
        for (
          let i = 0;
          i < clickRate * 0.055 && first + i < clicks.length;
          i++
        ) {
          const t = i / clickRate
          clicks[first + i] =
            Math.sin(2 * Math.PI * (beat === 0 ? 1000 : 750) * t) *
            0.12 *
            (t < 0.003 ? FLOOR * 10_000 ** (t / 0.003) : 1) *
            Math.exp(-t * 110)
        }
      }
      open(ctx.currentTime)
      if (clicks.length) source(buffer(clicks, clickRate), start, mute!)
      source(music, audioStart, guard!)
      for (const span of runnerVoiceSpans(course)) {
        if (span.end <= checkpoint.courseSeconds) continue
        const from =
          audioStart + Math.max(0, span.start - checkpoint.courseSeconds)
        const until = audioStart + span.end - checkpoint.courseSeconds
        guard!.gain.setTargetAtTime(
          RUNNER_JUDGE_GAIN,
          Math.max(audioStart, from - 0.35),
          0.035,
        )
        guard!.gain.setValueAtTime(RUNNER_JUDGE_GAIN, from)
        guard!.gain.setTargetAtTime(1, until, 0.3 / 5)
      }
      scheduled = true
      const result: RunnerAudioSchedule = {
        countInStartAudioSeconds: start,
        audioStartSeconds: audioStart,
        courseStartSeconds: checkpoint.courseSeconds,
        secondsPerBeat,
        countInBeats: checkpoint.countInBeats,
      }
      return result
    },
    hearReference(midi) {
      const ctx = running()
      if (scheduled || !Number.isFinite(midi)) return Promise.resolve()
      const rate = 24_000,
        duration = 0.8
      const samples = new Float32Array(rate * duration)
      const frequency = 440 * 2 ** ((midi - 69) / 12)
      for (let i = 0; i < samples.length; i++) {
        const t = i / rate
        const gain =
          t < 0.09
            ? FLOOR * 10_000 ** (t / 0.09)
            : t > 0.56
              ? Math.exp(-(t - 0.56) / 0.036)
              : 1
        samples[i] = 0.18 * Math.sin(2 * Math.PI * frequency * t) * gain
      }
      samples[samples.length - 1] = 0
      open(ctx.currentTime)
      return new Promise<void>((resolve) =>
        source(buffer(samples, rate), ctx.currentTime + 0.03, master!, resolve),
      )
    },
    setMuted(value) {
      muted = value
      if (!disposed && context)
        setMute?.(value ? 0 : 0.65, context.currentTime, 0.12)
    },
    setVoiceActive(active) {
      if (!disposed && context)
        setVoice?.(active ? 0.5 : 1, context.currentTime, active ? 0.06 : 0.3)
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
