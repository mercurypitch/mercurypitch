// ============================================================
// Piano performance scheduler — bounded score notes on the transport audio clock
// ============================================================
//
// The interval only fills a short Web Audio lookahead. Beat position always
// comes from the injected transport, and every discontinuity clears the score
// voices before a new generation is allowed to schedule.

import type { PianoAudioClockTransport } from './piano-audio-clock-transport'
import type { PianoFallbackSynth } from './piano-fallback-synth'
import type { PianoProjectStageNote } from './piano-project-stage'

export interface PianoPerformanceScheduler {
  start(): boolean
  refresh(): boolean
  stop(): void
  dispose(): void
}

export interface PianoPerformanceSchedulerOptions {
  transport: PianoAudioClockTransport
  notes: readonly PianoProjectStageNote[]
  synth: Pick<PianoFallbackSynth, 'noteOn' | 'noteOff'>
  scheduleAheadSeconds?: number
  schedulerIntervalMs?: number
  setInterval?: (callback: () => void, delayMs: number) => number
  clearInterval?: (id: number) => void
}

const DEFAULT_LOOKAHEAD_SECONDS = 0.16
const DEFAULT_INTERVAL_MS = 25

export function createPianoPerformanceScheduler(
  options: PianoPerformanceSchedulerOptions,
): PianoPerformanceScheduler {
  const scheduleAheadSeconds = Math.max(
    0.04,
    options.scheduleAheadSeconds ?? DEFAULT_LOOKAHEAD_SECONDS,
  )
  const schedulerIntervalMs = Math.max(
    10,
    options.schedulerIntervalMs ?? DEFAULT_INTERVAL_MS,
  )
  const startInterval =
    options.setInterval ??
    ((callback, delayMs) => window.setInterval(callback, delayMs))
  const cancelInterval =
    options.clearInterval ?? ((id) => window.clearInterval(id))
  const scheduledIds = new Set<string>()
  let interval: number | null = null
  let generation = 0
  let disposed = false

  const voiceId = (note: PianoProjectStageNote): string =>
    `score:${generation}:${String(note.id)}`

  const clearScheduled = (): void => {
    const context = options.transport.getAudioContext()
    const at = context?.currentTime
    for (const id of scheduledIds) options.synth.noteOff(id, at)
    scheduledIds.clear()
  }

  const cancelClock = (): void => {
    if (interval === null) return
    cancelInterval(interval)
    interval = null
  }

  const schedule = (): void => {
    if (disposed || options.transport.phase() !== 'playing') {
      cancelClock()
      return
    }
    const context = options.transport.getAudioContext()
    if (context === null || context.state === 'closed') {
      cancelClock()
      return
    }

    const beat = options.transport.timeline.playheadBeat()
    const beatsPerSecond =
      (options.transport.timeline.tempoBpm() / 60) * options.transport.speed()
    if (!(beatsPerSecond > 0)) return
    const horizonBeat = beat + scheduleAheadSeconds * beatsPerSecond
    const secondsPerBeat = 1 / beatsPerSecond

    for (const note of options.notes) {
      const id = voiceId(note)
      if (scheduledIds.has(id)) continue
      const endBeat = note.startBeat + note.duration
      if (note.startBeat > horizonBeat || endBeat <= beat) continue

      const startBeat = Math.max(beat, note.startBeat)
      const startsAt =
        context.currentTime + Math.max(0, startBeat - beat) * secondsPerBeat
      const endsAt =
        context.currentTime + Math.max(0.02, endBeat - beat) * secondsPerBeat
      const started = options.synth.noteOn({
        id,
        midi: note.midi,
        velocity: note.velocity,
        atContextTime: startsAt,
      })
      if (!started) continue
      options.synth.noteOff(id, endsAt)
      scheduledIds.add(id)
    }
  }

  const start = (): boolean => {
    if (disposed || options.transport.phase() !== 'playing') return false
    cancelClock()
    schedule()
    interval = startInterval(schedule, schedulerIntervalMs)
    return true
  }

  const stop = (): void => {
    generation += 1
    cancelClock()
    clearScheduled()
  }

  return {
    start,
    refresh() {
      stop()
      return start()
    },
    stop,
    dispose() {
      if (disposed) return
      stop()
      disposed = true
    },
  }
}
