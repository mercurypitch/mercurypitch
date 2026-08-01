// ============================================================
// Voice session — mic + AudioContext + f0 stream, as one unit
// ============================================================
//
// Opening a microphone for pitch analysis in a browser is not one
// call. It is a specific sequence with several failure modes that all
// look like "it just doesn't work", and every one of them was found
// the hard way in the Voice Mirror:
//
//   • iOS Safari requires the AudioContext to be created inside the
//     user gesture, so open() must be called straight from a handler.
//   • On iOS WebKit, createMediaStreamSource emits pure silence when
//     the context's sample rate doesn't match the mic route — which
//     happens whenever the context pre-dates getUserMedia. The fix is
//     to rebuild the graph with a context created AFTER capture is
//     live, which is what a dead-zero probe triggers here.
//   • A merely QUIET input is usually the wrong device (the default
//     is some monitor mic across the room), not a broken graph. It
//     sails past a dead-zero check, so a flow that only tests for
//     zero happily runs its whole script against an inaudible input.
//   • A denied permission must tear the AudioContext down. Without
//     that, every retry leaks one and the browser's hardware-context
//     cap eventually blocks the retry button itself.
//
// This module is the single home for that sequence. It owns the audio
// graph; the caller owns the script (what to record, and for how long).
//
// NOTE: src/features/mirror/MirrorApp.tsx still carries its own copy
// of this lifecycle — it is a 1600-line shipped flow on a live funnel,
// so migrating it is tracked as a follow-up rather than bundled into
// the onboarding work. New callers should use this module.

import type { MicError } from './mic-manager'
import { listAudioInputs, micManager } from './mic-manager'
import type { F0Stream, PitchFrame } from './pitch-f0-stream'
import { createF0Stream } from './pitch-f0-stream'

/**
 * A live mic never reads exactly zero — room noise floors around 1e-3.
 * Dead zeros mean the capture graph itself is broken (the iOS WebKit
 * case) or the mic is muted at the OS level.
 */
const SILENCE_RMS = 1e-6

/**
 * Below this peak during the probe, treat the input as unusable and
 * offer the device picker rather than starting the flow.
 */
const QUIET_RMS = 0.004

/** Long enough for someone to say "ahh", short enough not to stall. */
const PROBE_MS = 900

export type ProbeResult = 'ok' | 'silent' | 'no-session'

/**
 * Opening returns a result rather than throwing: micManager rejects with
 * a plain `MicError` object, not an Error subclass, so a rethrow would be
 * a throw-literal and every caller would need the same cast to read the
 * message back out.
 */
export type OpenResult = { ok: true } | { ok: false; message: string }

const DEFAULT_DENIED_MESSAGE =
  'Microphone access was blocked. You can allow it in your browser settings and try again.'

export interface VoiceSession {
  /**
   * Acquire the mic and build the audio graph. MUST be called directly
   * inside a user gesture (iOS Safari). On failure it has already
   * cleaned up, so the caller can retry immediately.
   */
  open: () => Promise<OpenResult>
  /**
   * Is the input actually audible? Rebuilds the graph once on a
   * dead-zero reading before giving up, and retries once when merely
   * quiet so the singer gets a second beat to speak up.
   */
  probe: () => Promise<ProbeResult>
  /** Record for `seconds` and return the raw frames. */
  record: (seconds: number) => Promise<PitchFrame[]>
  /** Most recent frame — raw, for numbers. */
  latest: () => PitchFrame | null
  /** Most recent frame — smoothed, for ribbons and live visuals. */
  latestSmoothed: () => PitchFrame | null
  /** Input level 0–1, for a mic meter. */
  level: () => number
  /** The live AudioContext, for reference-tone playback. */
  context: () => AudioContext | null
  /** True between a successful open() and close(). */
  isOpen: () => boolean
  /** Available inputs, for the device picker. */
  devices: () => Promise<MediaDeviceInfo[]>
  /** Switch capture to another input and re-probe it. */
  useDevice: (deviceId: string) => Promise<ProbeResult>
  /** Release everything. Safe to call more than once. */
  close: () => void
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export function createVoiceSession(consumerId: string): VoiceSession {
  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null
  let opening = false

  function teardownAudio(): void {
    f0?.dispose()
    f0 = null
    micManager.release(consumerId)
    void audioContext?.close().catch(() => undefined)
    audioContext = null
  }

  async function buildGraph(): Promise<void> {
    audioContext = new AudioContext()
    if (audioContext.state === 'suspended') await audioContext.resume()
    const stream = await micManager.acquire(consumerId)
    f0 = createF0Stream(audioContext, stream)
  }

  /**
   * Rebuild with a context created AFTER capture is live — the iOS
   * WebKit sample-rate mismatch fix. The MediaStream is kept; only the
   * context and analyser graph are replaced.
   */
  async function rebuildAudio(): Promise<void> {
    f0?.dispose()
    f0 = null
    void audioContext?.close().catch(() => undefined)
    audioContext = null
    const stream = micManager.getStream()
    if (stream === null) return
    audioContext = new AudioContext()
    if (audioContext.state === 'suspended') await audioContext.resume()
    f0 = createF0Stream(audioContext, stream)
  }

  async function probeLevel(ms: number): Promise<number> {
    if (f0 === null) return 0
    f0.startTask()
    await sleep(ms)
    // Drain the probe frames so they can't leak into the next take.
    f0.takeFrames()
    return f0?.maxLevel() ?? 0
  }

  return {
    async open(): Promise<OpenResult> {
      if (opening) return { ok: false, message: DEFAULT_DENIED_MESSAGE }
      opening = true
      try {
        await buildGraph()
        return { ok: true }
      } catch (err) {
        // Tear down before returning: a leaked AudioContext per denial
        // eventually trips the browser's hardware-context cap, which
        // makes "Try again" fail for reasons the user cannot see.
        teardownAudio()
        const message = (err as MicError | null)?.message
        return {
          ok: false,
          message:
            message !== undefined && message !== ''
              ? message
              : DEFAULT_DENIED_MESSAGE,
        }
      } finally {
        opening = false
      }
    },

    async probe(): Promise<ProbeResult> {
      if (f0 === null) return 'no-session'
      const level = await probeLevel(PROBE_MS)
      if (level > QUIET_RMS) return 'ok'
      // Dead zero = broken graph; rebuild before re-probing. Merely
      // quiet = likely the wrong device, and the retry gives the singer
      // one more beat before we offer the picker.
      if (level <= SILENCE_RMS) await rebuildAudio()
      return (await probeLevel(PROBE_MS)) > QUIET_RMS ? 'ok' : 'silent'
    },

    async record(seconds: number): Promise<PitchFrame[]> {
      if (f0 === null) return []
      f0.startTask()
      await sleep(seconds * 1000)
      // f0 may have been torn down while awaiting (unmount mid-take).
      return f0?.takeFrames() ?? []
    },

    latest: () => f0?.latest() ?? null,
    latestSmoothed: () => f0?.latestSmoothed() ?? null,
    level: () => f0?.latestLevel() ?? 0,
    context: () => audioContext,
    isOpen: () => f0 !== null,

    async devices(): Promise<MediaDeviceInfo[]> {
      try {
        return await listAudioInputs()
      } catch {
        // Enumeration unavailable — the picker simply doesn't render.
        return []
      }
    },

    async useDevice(deviceId: string): Promise<ProbeResult> {
      try {
        await micManager.setPreferredDevice(deviceId === '' ? null : deviceId)
        await micManager.acquire(consumerId)
        await rebuildAudio()
        if (f0 === null) return 'no-session'
        return (await probeLevel(PROBE_MS)) > QUIET_RMS ? 'ok' : 'silent'
      } catch {
        return 'silent'
      }
    },

    close(): void {
      teardownAudio()
    },
  }
}
