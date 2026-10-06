// Voice diagnostics — bounded lifecycle and capture-health facts for the local portable console.
import type { F0Stream } from '@irchiinnuss/pitch-engine'
import type { RunnerSessionState } from '../runner/session-contracts'

type VoiceStage = 'opening' | 'acquired' | 'capturing' | 'stopped'
type StopReason =
  | 'requested'
  | 'track-mute'
  | 'track-ended'
  | 'manager-released'
  | 'audio-interrupted'
  | 'start-failed'
export type VoiceStopReason = StopReason
let nextVoice = 0
let nextRunner = 0

/** Call only from the portable-console build gate; no audio or note identity is retained. */
export function createVoiceDiagnostics(
  read: () => {
    context: AudioContext | null
    tracks: readonly MediaStreamTrack[]
    stream: F0Stream | null
  },
) {
  const instance = ++nextVoice
  let timer: ReturnType<typeof setInterval> | undefined
  let reports = 0
  let previousFrames = 0
  let previousClock = 0
  let previousHealth = ''
  let closed = false
  const environment = () => {
    const { context, tracks } = read()
    const state = String(context?.state)
    return {
      clock: ['running', 'suspended', 'interrupted', 'closed'].includes(state)
        ? state
        : 'unavailable',
      page:
        typeof document === 'undefined'
          ? 'unknown'
          : document.visibilityState === 'hidden'
            ? 'hidden'
            : 'visible',
      tracks: Math.min(32, tracks.length),
      liveTracks: Math.min(
        32,
        tracks.filter((track) => track.readyState === 'live').length,
      ),
      mutedTracks: Math.min(32, tracks.filter((track) => track.muted).length),
    }
  }
  const report = (stage: VoiceStage, reason?: StopReason) => {
    if (closed) return
    console.info('[Glassworks microphone]', {
      instance,
      stage,
      ...environment(),
      ...(reason ? { reason } : {}),
    })
    if (stage === 'capturing' && timer === undefined) {
      const current = read()
      previousClock = current.context?.currentTime ?? 0
      previousFrames = current.stream?.frameCount() ?? 0
      timer = setInterval(sample, 2000)
    }
    if (stage === 'stopped') {
      closed = true
      clearInterval(timer)
    }
  }
  const sample = () => {
    const { context, stream } = read()
    if (closed || !context || !stream) return
    const frames = stream.frameCount()
    const latest = stream.latestCaptured()
    const clockAdvancing = context.currentTime > previousClock
    const framesSinceLast = Math.max(
      0,
      Math.min(10000, frames - previousFrames),
    )
    const signal =
      latest === null
        ? 'none'
        : latest.frame.f0 > 0
          ? 'pitched'
          : latest.frame.rms > 0
            ? 'unpitched'
            : 'silence'
    const captureAgeMs =
      latest === null
        ? null
        : Math.max(
            -1000,
            Math.min(
              60000,
              Math.round(
                (context.currentTime - latest.capturedAudioSeconds) * 1000,
              ),
            ),
          )
    const health = JSON.stringify([
      clockAdvancing,
      framesSinceLast > 0,
      signal,
      captureAgeMs === null ? null : Math.floor(captureAgeMs / 100),
    ])
    previousClock = context.currentTime
    previousFrames = frames
    if (health === previousHealth) return
    previousHealth = health
    console.info('[Glassworks microphone]', {
      instance,
      stage: 'capture-health',
      ...environment(),
      clockAdvancing,
      framesSinceLast,
      signal,
      captureAgeMs,
    })
    if (++reports >= 8) clearInterval(timer)
  }
  return { report }
}

/** Phase changes only; no course, selected note, score or captured observations. */
export function createRunnerLifecycleDiagnostics() {
  const instance = ++nextRunner
  let previous = ''
  let remaining = 24
  return (state: RunnerSessionState): void => {
    const next = JSON.stringify([
      state.phase,
      state.microphone,
      state.pauseReason,
      state.error?.code ?? null,
    ])
    if (next === previous || remaining <= 0) return
    previous = next
    remaining--
    console.info('[Glassworks runner]', {
      instance,
      phase: state.phase,
      microphone: state.microphone,
      pauseReason: state.pauseReason,
      errorCode: state.error?.code ?? null,
    })
  }
}
