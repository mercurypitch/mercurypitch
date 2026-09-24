// Melody reference output — schedules the compiled contour on the shared audio clock.

import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import type { CompiledMelody } from '../core/melody-contour'
import { melodyMidiToFrequency, sampleMelodyAtTime, } from '../core/melody-contour'
import type { MelodyReferencePlayer } from '../core/melody-reference'

const FLOOR = 0.0001
const OUTPUT_GAIN = 0.07
const ATTACK_SECONDS = 0.025
const PHRASE_RELEASE_SECONDS = 0.08
const QUIET_TAIL_SECONDS = 0.3
const RELEASE_MS = 240
const CURVE_SAMPLES_PER_SECOND = 120

interface ReferenceGraph {
  oscillator: OscillatorNode
  envelope: GainNode
}

interface PitchedRun {
  startSeconds: number
  endSeconds: number
}

function pitchedRuns(melody: CompiledMelody): PitchedRun[] {
  const runs: PitchedRun[] = []
  let current: PitchedRun | null = null
  for (const segment of melody.segments) {
    if (segment.kind !== 'landing' && segment.kind !== 'glide') {
      if (current !== null) runs.push(current)
      current = null
      continue
    }
    if (current === null)
      current = {
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
      }
    else current.endSeconds = segment.endSeconds
  }
  if (current !== null) runs.push(current)
  return runs
}

function runFrequencies(melody: CompiledMelody, run: PitchedRun): Float32Array {
  const duration = run.endSeconds - run.startSeconds
  const count = Math.max(2, Math.ceil(duration * CURVE_SAMPLES_PER_SECOND) + 1)
  return Float32Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1)
    const time = Math.min(
      run.endSeconds - 1e-8,
      run.startSeconds + ratio * duration,
    )
    const point = sampleMelodyAtTime(melody, time)
    if (point.midi === null)
      throw new Error('A pitched melody run contains an unexpected silence.')
    return melodyMidiToFrequency(point.midi)
  })
}

/**
 * Create a one-shot reference player. Construction reaches ensure()/unlock()
 * synchronously, so callers can preserve the tap gesture before awaiting mic
 * permission or an audio-silencing handoff.
 */
export function createBrowserMelodyReference(
  melody: CompiledMelody,
): MelodyReferencePlayer {
  let disposed = false
  let finished = false
  let played = false
  let releaseDeadline = 0
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  const graphs = new Set<ReferenceGraph>()
  const pending = new Set<(error: Error) => void>()
  const lease = acquireSharedAudioContext('glass-melody-reference', {
    prepareToSuspend: () => {
      dispose()
      return Math.max(0, releaseDeadline - Date.now())
    },
  })
  const context = lease.ensure()
  const bus = context?.createGain() ?? null
  if (context && bus) {
    bus.gain.setValueAtTime(1, context.currentTime)
    bus.connect(context.destination)
  }
  const unlocked = context ? lease.unlock() : Promise.resolve(false)

  function retire(graph: ReferenceGraph): void {
    graph.oscillator.onended = null
    try {
      graph.oscillator.stop()
    } catch {
      /* Already ended. */
    }
    graph.oscillator.disconnect()
    graph.envelope.disconnect()
    graphs.delete(graph)
  }

  function finish(): void {
    if (finished) return
    finished = true
    clearTimeout(releaseTimer)
    releaseDeadline = 0
    for (const graph of [...graphs]) retire(graph)
    bus?.disconnect()
    context?.removeEventListener('statechange', changed)
    lease.release()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    for (const reject of [...pending])
      reject(new Error('The melody reference was cancelled.'))
    pending.clear()
    if (!context || !bus || context.state !== 'running' || graphs.size === 0) {
      finish()
      return
    }
    const at = context.currentTime
    bus.gain.cancelScheduledValues(at)
    bus.gain.setTargetAtTime(0, at, 0.036)
    for (const graph of graphs) {
      try {
        graph.oscillator.stop(at + RELEASE_MS / 1000)
      } catch {
        /* Already ended. */
      }
    }
    releaseDeadline = Date.now() + RELEASE_MS
    releaseTimer = setTimeout(finish, RELEASE_MS)
  }

  function changed(): void {
    if (!context || context.state === 'running') return
    dispose()
    finish()
  }
  context?.addEventListener('statechange', changed)

  function waitForUnlock(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let settled = false
      const done = (): void => {
        settled = true
        clearTimeout(timer)
        pending.delete(fail)
      }
      const fail = (error: Error): void => {
        if (settled) return
        done()
        reject(error)
      }
      const timer = setTimeout(() => {
        fail(new Error('Audio could not start. Tap again to try the melody.'))
        dispose()
      }, 4000)
      pending.add(fail)
      void unlocked.then((available) => {
        if (settled) return
        done()
        resolve(available)
      }, fail)
    })
  }

  function scheduleRun(run: PitchedRun, startedAt: number): void {
    if (!context || !bus) return
    const at = startedAt + run.startSeconds
    const until = startedAt + run.endSeconds
    const duration = run.endSeconds - run.startSeconds
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const curve = runFrequencies(melody, run)
    oscillator.type = 'sine'
    oscillator.frequency.setValueCurveAtTime(curve, at, duration)
    envelope.gain.setValueAtTime(FLOOR, at)
    envelope.gain.exponentialRampToValueAtTime(
      OUTPUT_GAIN,
      Math.min(until, at + ATTACK_SECONDS),
    )
    envelope.gain.setTargetAtTime(
      FLOOR,
      Math.max(at + ATTACK_SECONDS, until - PHRASE_RELEASE_SECONDS),
      PHRASE_RELEASE_SECONDS / 5,
    )
    oscillator.connect(envelope).connect(bus)
    const graph = { oscillator, envelope }
    graphs.add(graph)
    oscillator.onended = () => retire(graph)
    oscillator.start(at)
    oscillator.stop(until + PHRASE_RELEASE_SECONDS)
  }

  function waitForClock(
    startedAt: number,
    onProgress: ((timelineSeconds: number) => void) | undefined,
  ): Promise<void> {
    const until = startedAt + melody.durationSeconds + QUIET_TAIL_SECONDS
    return new Promise((resolve, reject) => {
      const remainingSeconds = Math.max(
        0,
        until - (context?.currentTime ?? until),
      )
      const deadline =
        Date.now() + Math.max(4000, (remainingSeconds + 2) * 1000)
      let timer: ReturnType<typeof setTimeout> | undefined
      const done = (): void => {
        clearTimeout(timer)
        pending.delete(fail)
      }
      const fail = (error: Error): void => {
        done()
        reject(error)
      }
      const check = (): void => {
        if (disposed || !context || context.state !== 'running') {
          fail(new Error('The melody reference stopped. Tap again to try it.'))
          return
        }
        onProgress?.(
          Math.max(
            0,
            Math.min(melody.durationSeconds, context.currentTime - startedAt),
          ),
        )
        if (context.currentTime >= until) {
          done()
          resolve()
          return
        }
        if (Date.now() >= deadline) {
          fail(
            new Error('Audio is not advancing. Tap again to try the melody.'),
          )
          dispose()
          return
        }
        timer = setTimeout(check, 25)
      }
      pending.add(fail)
      check()
    })
  }

  return {
    async play(onProgress) {
      if (played)
        throw new Error('A melody reference player can play only once.')
      played = true
      if (!context || !bus || disposed)
        throw new Error('The melody reference is unavailable.')
      const available = await waitForUnlock()
      if (!available || disposed || context.state !== 'running')
        throw new Error('Audio could not start. Tap again to try the melody.')
      const startedAt = context.currentTime + 0.035
      for (const run of pitchedRuns(melody)) scheduleRun(run, startedAt)
      await waitForClock(startedAt, onProgress)
    },
    stop: dispose,
    dispose,
  }
}
