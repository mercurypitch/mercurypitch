// Recorded memory playback — local decoded audio with cancellation and a soft release.
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import type { MusicalMemoryPlayback } from '../core/musical-memory'
import { MEMORY_MAX_BYTES, MEMORY_MAX_SECONDS } from '../core/musical-memory'

const RELEASE_MS = 120

function createOutput() {
  let source: AudioBufferSourceNode | undefined
  let ended = false
  let retiring = false
  let releaseDeadline = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let resolveFinished!: () => void
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  const lease = acquireSharedAudioContext('glass-musical-memory', {
    prepareToSuspend: () => {
      void stop()
      return Math.max(0, releaseDeadline - Date.now())
    },
  })
  let context: AudioContext | null
  let gain: GainNode | undefined
  let unlocked: Promise<boolean>
  try {
    context = lease.ensure()
    gain = context?.createGain()
    if (context && gain) gain.connect(context.destination)
    unlocked = context ? lease.unlock() : Promise.resolve(false)
  } catch (error) {
    gain?.disconnect()
    lease.release()
    throw error
  }

  function finish(): void {
    if (ended) return
    ended = true
    clearTimeout(timer)
    releaseDeadline = 0
    if (source) {
      source.onended = null
      try {
        source.stop()
      } catch {
        /* Already ended. */
      }
      source.disconnect()
    }
    gain?.disconnect()
    context?.removeEventListener('statechange', changed)
    lease.release()
    resolveFinished()
  }

  function stop(): Promise<void> {
    if (ended || retiring) return finished
    retiring = true
    if (!source || !context || !gain || context.state !== 'running') {
      finish()
      return finished
    }
    const at = context.currentTime
    gain.gain.cancelScheduledValues(at)
    gain.gain.setTargetAtTime(0, at, RELEASE_MS / 5000)
    releaseDeadline = Date.now() + RELEASE_MS
    try {
      source.stop(at + RELEASE_MS / 1000)
    } catch {
      /* Already ended. */
    }
    timer = setTimeout(finish, RELEASE_MS)
    return finished
  }

  function changed(): void {
    if (source && context?.state !== 'running') finish()
  }
  context?.addEventListener('statechange', changed)
  return {
    context,
    unlocked,
    stop,
    finished,
    start(buffer: AudioBuffer): boolean {
      if (ended || retiring || !context || !gain || context.state !== 'running')
        return false
      source = context.createBufferSource()
      source.buffer = buffer
      source.connect(gain)
      source.onended = finish
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(1, context.currentTime + 0.018)
      source.start()
      return true
    },
  }
}

export function createBrowserMemoryPlayback(): MusicalMemoryPlayback {
  let current: ReturnType<typeof createOutput> | undefined
  let disposed = false
  let generation = 0
  const pending = new Set<ReturnType<typeof createOutput>>()

  function stop(): Promise<void> {
    generation++
    current = undefined
    return Promise.all([...pending].map((output) => output.stop())).then(
      () => undefined,
    )
  }
  return {
    play(audio, onEnded, beforePlayback) {
      const settledAudio = Promise.resolve(audio).then(
        (value) => ({ kind: 'ready' as const, value }),
        () => ({ kind: 'failed' as const }),
      )
      const settledBeforePlayback = Promise.resolve(beforePlayback).then(
        () => true,
        () => false,
      )
      if (
        disposed ||
        (audio instanceof Blob &&
          (!audio.size || audio.size > MEMORY_MAX_BYTES))
      )
        return Promise.resolve(false)
      const previous = stop()
      const run = ++generation
      let output: ReturnType<typeof createOutput>
      try {
        output = createOutput()
      } catch {
        return Promise.resolve(false)
      }
      current = output
      pending.add(output)
      void output.finished.then(() => {
        pending.delete(output)
        if (current === output) current = undefined
        onEnded?.()
      })
      return (async () => {
        let timeout: ReturnType<typeof setTimeout> | undefined
        try {
          const decode = async (): Promise<AudioBuffer | null> => {
            if (!(await output.unlocked) || !output.context) return null
            const settled = await settledAudio
            if (settled.kind === 'failed') return null
            const resolvedAudio = settled.value
            if (
              !resolvedAudio.size ||
              resolvedAudio.size > MEMORY_MAX_BYTES ||
              run !== generation ||
              disposed
            )
              return null
            const bytes = await resolvedAudio.arrayBuffer()
            if (run !== generation || disposed) return null
            return output.context.decodeAudioData(bytes)
          }
          const buffer = await Promise.race([
            decode(),
            output.finished.then(() => null),
            new Promise<null>((resolve) => {
              timeout = setTimeout(() => resolve(null), 5000)
            }),
          ])
          const [, playbackReady] = await Promise.all([
            previous,
            settledBeforePlayback,
          ])
          if (
            !buffer ||
            !playbackReady ||
            run !== generation ||
            disposed ||
            !Number.isFinite(buffer.duration) ||
            buffer.duration > MEMORY_MAX_SECONDS + 0.5
          ) {
            void output.stop()
            return false
          }
          if (output.start(buffer)) return true
        } catch {
          /* Unsupported codecs leave the saved local take untouched. */
        } finally {
          clearTimeout(timeout)
        }
        void output.stop()
        return false
      })()
    },
    stop,
    dispose() {
      disposed = true
      void stop()
    },
  }
}
