// Museum microphone session — one owned stream, raw capture timestamps and late-start cleanup.
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import type { CapturedPitchFrame, F0Stream } from '@irchiinnuss/pitch-engine'
import { createF0Stream, micManager } from '@irchiinnuss/pitch-engine'
import type { PitchObservation } from '../contracts'
import type { GlassVoiceInputSettings, GlassVoicePreparation, GlassVoiceSession, GlassVoiceTake, } from '../host'
import { createBrowserVoiceTake } from './voice-take'

let nextSession = 0
let nextPreparation = 0

export function prepareBrowserVoiceGesture(): GlassVoicePreparation {
  const lease = acquireSharedAudioContext(
    `glass-adventure:voice-preparation:${++nextPreparation}`,
  )
  let released = false
  // unlock() reaches AudioContext construction and resume() before its first
  // await, so keep this call directly in the originating gameplay gesture.
  const ready = lease.unlock()
  return {
    ready,
    release() {
      if (released) return
      released = true
      lease.release()
    },
  }
}

export function createBrowserVoice(
  options: {
    prepareMicrophone?(): Promise<void>
    microphoneOpened?(): void
  } = {},
): GlassVoiceSession {
  const id = `glass-adventure:${++nextSession}`
  const lease = acquireSharedAudioContext(id)
  let stream: F0Stream | null = null
  let holding = false
  let stopped = false
  let starting: Promise<void> | null = null
  let microphoneStream: MediaStream | null = null
  let take: GlassVoiceTake | null = null
  let tracks: readonly MediaStreamTrack[] = []
  let settings: GlassVoiceInputSettings | null = null
  const stoppedListeners = new Set<() => void>()
  const releaseMic = (): void => {
    if (holding) micManager.release(id)
    holding = false
  }
  const stop = (): void => {
    if (stopped) return
    stopped = true
    take?.discard()
    take = null
    microphoneStream = null
    for (const track of tracks) {
      track.removeEventListener('mute', trackInterrupted)
      track.removeEventListener('ended', trackInterrupted)
    }
    tracks = []
    settings = null
    lease.peek()?.removeEventListener('statechange', changed)
    stream?.dispose()
    stream = null
    stoppedListeners.clear()
    releaseMic()
    lease.release()
  }

  function trackInterrupted(): void {
    if (stopped) return
    const listeners = [...stoppedListeners]
    stop()
    for (const listener of listeners) listener()
  }

  function changed(): void {
    const ctx = lease.peek()
    if (stopped || !stream || !ctx || ctx.state === 'running') return
    const listeners = [...stoppedListeners]
    stop()
    for (const listener of listeners) listener()
  }
  const observation = (
    captured: CapturedPitchFrame,
    nowMs: number,
  ): PitchObservation | null => {
    const ctx = lease.peek()
    if (!ctx || ctx.state !== 'running' || stopped) return null
    return {
      sequence: captured.sequence,
      captureSeconds: captured.capturedAudioSeconds,
      capturedAtMs:
        nowMs -
        Math.max(0, ctx.currentTime - captured.capturedAudioSeconds) * 1000,
      midi:
        captured.frame.f0 > 0
          ? 69 + 12 * Math.log2(captured.frame.f0 / 440)
          : null,
      confidence: captured.frame.conf,
    }
  }
  return {
    inputSettings: () => settings,
    start(beforeCapture = Promise.resolve()) {
      if (stopped)
        return Promise.reject(new Error('This microphone session has ended.'))
      if (starting !== null) return starting
      const ctx = lease.ensure()
      if (!ctx) {
        stopped = true
        lease.release()
        return Promise.reject(
          new Error('This browser cannot open audio. Try Safari or Chrome.'),
        )
      }
      const unlocked = lease.unlock()
      // Observe failures immediately even while a permission prompt is pending.
      const quiet = beforeCapture.then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      )
      // Unlock Web Audio above in the gesture, then serialize the remembered
      // route ahead of acquisition. A cancelled preparation must not open a mic.
      const microphone = options.prepareMicrophone
        ? Promise.resolve()
            .then(() => (stopped ? undefined : options.prepareMicrophone?.()))
            .then(() => (stopped ? null : micManager.acquire(id)))
        : micManager.acquire(id)
      starting = (async () => {
        try {
          const acquired = await microphone
          if (acquired === null) return
          holding = true
          if (stopped) {
            releaseMic()
            return
          }
          options.microphoneOpened?.()
          const available = await unlocked
          if (stopped) {
            releaseMic()
            return
          }
          if (!available || ctx.state !== 'running')
            throw new Error('Audio could not start. Tap Start to try again.')
          const silence = await quiet
          if (stopped) {
            releaseMic()
            return
          }
          if (!silence.ok) throw silence.error
          if (ctx.state !== 'running')
            throw new Error('Audio was interrupted. Tap Start to try again.')
          tracks = acquired.getAudioTracks()
          if (
            tracks.length === 0 ||
            tracks.some((track) => track.muted || track.readyState === 'ended')
          )
            throw new Error(
              'The microphone input was interrupted. Choose an input and try again.',
            )
          const actual = tracks[0]!.getSettings()
          settings = Object.freeze({
            ...(Number.isFinite(actual.sampleRate) &&
            actual.sampleRate! > 0 &&
            actual.sampleRate! <= 384000
              ? { sampleRate: actual.sampleRate }
              : {}),
            ...(Number.isInteger(actual.channelCount) &&
            actual.channelCount! > 0 &&
            actual.channelCount! <= 32
              ? { channelCount: actual.channelCount }
              : {}),
            ...(typeof actual.echoCancellation === 'boolean'
              ? { echoCancellation: actual.echoCancellation }
              : {}),
            ...(typeof actual.noiseSuppression === 'boolean'
              ? { noiseSuppression: actual.noiseSuppression }
              : {}),
            ...(typeof actual.autoGainControl === 'boolean'
              ? { autoGainControl: actual.autoGainControl }
              : {}),
          })
          for (const track of tracks) {
            track.addEventListener('mute', trackInterrupted)
            track.addEventListener('ended', trackInterrupted)
          }
          stream = createF0Stream(ctx, acquired)
          microphoneStream = acquired
          stream.startTask()
          ctx.addEventListener('statechange', changed)
        } catch (error) {
          stop()
          throw error
        }
      })()
      return starting
    },
    latest(nowMs) {
      const captured = stream?.latestCaptured()
      return captured ? observation(captured, nowMs) : null
    },
    subscribe(listener, onStopped) {
      if (!stream || stopped) {
        if (stopped) onStopped?.()
        return () => undefined
      }
      if (onStopped) stoppedListeners.add(onStopped)
      const unsubscribe = stream.subscribeCaptured((capture) => {
        const nowMs = performance.now()
        const frame = observation(capture, nowMs)
        if (frame) listener(frame, nowMs)
      })
      return () => {
        unsubscribe()
        if (onStopped) stoppedListeners.delete(onStopped)
      }
    },
    stop,
    startRecording() {
      if (stopped || microphoneStream === null || stream === null)
        throw new Error('Open the microphone before recording a musical take.')
      take?.discard()
      const recording = createBrowserVoiceTake(microphoneStream)
      take = recording
      return {
        isRecording: () => recording.isRecording?.() ?? false,
        finish() {
          if (take === recording) take = null
          return recording.finish()
        },
        discard() {
          if (take === recording) take = null
          recording.discard()
        },
      }
    },
  }
}
