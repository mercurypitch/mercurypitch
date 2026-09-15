// Museum output — independently owned looping graphs with the shared 240 ms suspension release.
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import type { MuseumAudioPreferences } from '../host'

const FLOOR = 0.0001
export const MUSEUM_RELEASE_MS = 240

/** Track the scheduled value for browsers without cancelAndHoldAtTime. */
function gainEnvelope(param: AudioParam, initial: number, at: number) {
  let from = initial
  let target = initial
  let since = at
  let seconds = 1
  let exponential = false
  param.setValueAtTime(initial, at)

  function value(now: number): number {
    const elapsed = Math.max(0, now - since)
    return exponential
      ? from * (target / from) ** Math.min(1, elapsed / seconds)
      : target + (from - target) * Math.exp(-elapsed / seconds)
  }
  return (
    next: number,
    now: number,
    duration: number,
    attack = false,
  ): void => {
    const current = value(now)
    if (typeof param.cancelAndHoldAtTime === 'function')
      param.cancelAndHoldAtTime(now)
    else {
      param.cancelScheduledValues(now)
      param.setValueAtTime(current, now)
    }
    from = current
    target = next
    since = now
    seconds = attack ? duration : duration / 5
    exponential = attack
    if (attack) param.exponentialRampToValueAtTime(next, now + duration)
    else param.setTargetAtTime(next, now, seconds)
  }
}

export function createMuseumOutput(onInterrupted: () => void) {
  let closed = false
  let releasing = false
  let unlocking = true
  let deadline = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let resolveFinished!: () => void
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  const sources: AudioBufferSourceNode[] = []
  const nodes: GainNode[] = []
  const volumes: ReturnType<typeof gainEnvelope>[] = []
  const durations: number[] = []
  const offsets: number[] = []
  let startedAt = 0
  let releasedAt: number | undefined
  const lease = acquireSharedAudioContext('glass-museum-music', {
    prepareToSuspend: () => {
      onInterrupted()
      release()
      return Math.max(0, deadline - Date.now())
    },
  })
  const context = lease.ensure()
  const bus = context?.createGain()
  const envelope =
    context && bus
      ? gainEnvelope(bus.gain, FLOOR, context.currentTime)
      : undefined
  bus?.connect(context!.destination)

  function finish(): void {
    if (closed) return
    closed = true
    clearTimeout(timer)
    deadline = 0
    for (const source of sources) {
      source.onended = null
      try {
        source.stop()
      } catch {
        /* Already stopped. */
      }
      source.disconnect()
    }
    for (const node of nodes) node.disconnect()
    bus?.disconnect()
    context?.removeEventListener('statechange', changed)
    lease.release()
    resolveFinished()
  }

  function release(): Promise<void> {
    if (releasing || closed) return finished
    releasing = true
    releasedAt = context?.currentTime
    if (!context || context.state !== 'running' || !sources.length) {
      finish()
      return finished
    }
    envelope?.(0, context.currentTime, 0.18)
    deadline = Date.now() + MUSEUM_RELEASE_MS
    for (const source of sources) {
      try {
        source.stop(context.currentTime + MUSEUM_RELEASE_MS / 1000)
      } catch {
        /* Ended. */
      }
    }
    timer = setTimeout(finish, MUSEUM_RELEASE_MS)
    return finished
  }

  function changed(): void {
    if (context?.state === 'running' || closed) return
    // The previous last lease may have queued suspend() just before this fresh
    // gesture queued resume(). No source exists yet; let that unlock settle.
    // Explicit native/page suspension still cancels via prepareToSuspend, and
    // an actual interruption is terminal even during startup.
    if (unlocking && context?.state === 'suspended' && sources.length === 0)
      return
    onInterrupted()
    // A frozen audio clock cannot finish its scheduled tail; discard it now.
    finish()
  }
  context?.addEventListener('statechange', changed)
  // Start reaches this call before its first await, preserving the user gesture.
  const unlocked = (context ? lease.unlock() : Promise.resolve(false)).then(
    (available) => {
      unlocking = false
      return available
    },
  )
  return {
    context,
    unlocked,
    finished,
    isClosed: () => closed || releasing,
    remainingRelease: () => Math.max(0, deadline - Date.now()),
    playheads: () =>
      durations.map(
        (duration, index) =>
          (offsets[index] +
            Math.max(
              0,
              (releasedAt ?? context?.currentTime ?? startedAt) - startedAt,
            )) %
          duration,
      ),
    release,
    play(
      buffers: readonly AudioBuffer[],
      preferences: MuseumAudioPreferences,
      startingOffsets: readonly number[] = [],
    ): boolean {
      if (
        !context ||
        !bus ||
        closed ||
        releasing ||
        context.state !== 'running'
      )
        return false
      const at = context.currentTime
      startedAt = at
      for (const [index, buffer] of buffers.entries()) {
        const source = context.createBufferSource()
        const level = context.createGain()
        const volume = gainEnvelope(
          level.gain,
          index === 0 ? preferences.musicVolume : preferences.ambienceVolume,
          at,
        )
        source.buffer = buffer
        source.loop = true
        const duration = buffer.length / buffer.sampleRate
        const offset = (startingOffsets[index] ?? 0) % duration
        durations.push(duration)
        offsets.push(offset)
        source.connect(level).connect(bus)
        sources.push(source)
        nodes.push(level)
        volumes.push(volume)
        source.start(at, offset)
      }
      envelope?.(1, at, 0.6, true)
      return true
    },
    setVolumes(preferences: MuseumAudioPreferences): void {
      if (!context || closed || releasing) return
      volumes[0]?.(preferences.musicVolume, context.currentTime, 0.12)
      volumes[1]?.(preferences.ambienceVolume, context.currentTime, 0.12)
    },
  }
}
