// Museum microphone session — one owned stream, raw capture timestamps and late-start cleanup.
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import type { CapturedPitchFrame, F0Stream } from '@irchiinnuss/pitch-engine'
import { createF0Stream, micManager } from '@irchiinnuss/pitch-engine'
import type { PitchObservation } from '../contracts'
import type { GlassVoiceSession } from '../host'

let nextSession = 0
export function createBrowserVoice(): GlassVoiceSession {
  const id = `glass-adventure:${++nextSession}`
  const lease = acquireSharedAudioContext(id)
  let stream: F0Stream | null = null
  let holding = false
  let stopped = false
  let starting: Promise<void> | null = null
  const stoppedListeners = new Set<() => void>()
  const releaseMic = (): void => {
    if (holding) micManager.release(id)
    holding = false
  }
  const stop = (): void => {
    if (stopped) return
    stopped = true
    lease.peek()?.removeEventListener('statechange', changed)
    stream?.dispose()
    stream = null
    stoppedListeners.clear()
    releaseMic()
    lease.release()
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
    start() {
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
      // Both acquisitions begin inside the Start gesture. A cancelled permission
      // request may still succeed later, but it only releases this session's id.
      const microphone = micManager.acquire(id)
      starting = (async () => {
        try {
          const acquired = await microphone
          holding = true
          if (stopped) {
            releaseMic()
            return
          }
          const available = await unlocked
          if (stopped) {
            releaseMic()
            return
          }
          if (!available || ctx.state !== 'running')
            throw new Error('Audio could not start. Tap Start to try again.')
          stream = createF0Stream(ctx, acquired)
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
      if (!stream || stopped) return () => undefined
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
  }
}
