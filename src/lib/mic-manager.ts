// ── MicManager ───────────────────────────────────────────────────────
// Single, reference-counted owner of the capture microphone for the app's
// analysis features (pitch detection, scoring, live visualisation). Every
// feature that needs the mic — guitar practice, piano, singing, vocal
// analysis, exercises, recording, the stem mixer — acquires the shared stream
// from here instead of calling getUserMedia itself.
//
// Why this exists: each page used to open its own MediaStream. Switching pages
// tore one stream down and opened another, and that re-open raced the OS device
// release — surfacing intermittently as "microphone access denied" even though
// permission was granted. With one ref-counted owner, overlapping consumers
// share a single device handle and a short linger bridges page-to-page handoff,
// so the hardware is never thrashed.
//
// Out of scope by design: the jam/WebRTC microphone (lib/jam/service.ts). It
// needs call-tuned constraints (echo cancellation) and owns its own
// MediaStreamTrack for the peer connection, so it manages its own stream.

import type { MicLockRecord } from './mic-lock'
import { claimMicLock, micLockStatus, releaseMicLock, requestMicHandoff, setMicYieldHandler, } from './mic-lock'

export type MicErrorKind =
  | 'permission-denied'
  | 'device-busy'
  | 'no-device'
  /** Another MercuryPitch tab holds the mic. Offer a hand-off, not a retry. */
  | 'held-elsewhere'
  | 'unknown'

export interface MicError {
  kind: MicErrorKind
  message: string
}

export interface MicState {
  /** True while the device is open and at least one consumer holds it. */
  active: boolean
  /** Last acquisition error, or null after a successful acquire. */
  error: MicError | null
  /** Ids of the consumers currently holding the mic. */
  consumers: readonly string[]
  /** Set when another MercuryPitch tab is holding the mic; null otherwise. */
  blockedBy: MicLockRecord | null
}

type Listener = (state: MicState) => void

// Analysis-grade capture: the raw signal, so the pitch detector sees the true
// waveform. Echo cancellation / noise suppression / AGC would distort pitch and
// must stay off for every analysis consumer.
const ANALYSIS_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
}

// Keep the device open briefly after the last consumer releases, so navigating
// between two mic pages reuses the handle instead of closing and re-opening it
// (the re-open races the OS device release and reads as a spurious "busy").
const LINGER_MS = 2000
// One automatic retry when the OS briefly reports the device as unavailable
// (typically a previous handle that has not finished releasing yet).
const BUSY_RETRY_DELAY_MS = 250

function classifyError(err: unknown): MicError {
  const name = (err as { name?: string } | null | undefined)?.name
  const rawMessage = (err as { message?: string } | null | undefined)?.message
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        kind: 'permission-denied',
        message:
          'Microphone access was denied. Allow microphone access in your browser to continue.',
      }
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return {
        kind: 'device-busy',
        message: 'The microphone is in use by another app or browser tab.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { kind: 'no-device', message: 'No microphone was found.' }
    default:
      return {
        kind: 'unknown',
        message:
          rawMessage !== undefined && rawMessage.length > 0
            ? rawMessage
            : 'The microphone is unavailable.',
      }
  }
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Audio input devices (mics, line/instrument inputs e.g. an audio interface).
 *  Labels are only populated once mic permission has been granted. */
export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator.mediaDevices?.enumerateDevices !== 'function') return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === 'audioinput')
}

/** Audio output devices, for routing playback (where supported). */
export async function listAudioOutputs(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator.mediaDevices?.enumerateDevices !== 'function') return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === 'audiooutput')
}

export class MicManager {
  private stream: MediaStream | null = null
  private readonly consumers = new Set<string>()
  private error: MicError | null = null
  private preferredDeviceId: string | null = null
  private readonly listeners = new Set<Listener>()
  // Serialises acquire/release so a teardown fully settles before the next
  // open — the core guard against the re-open race.
  private queue: Promise<unknown> = Promise.resolve()
  private lingerTimer: ReturnType<typeof setTimeout> | null = null
  private blockedBy: MicLockRecord | null = null
  private readonly runGuards = new Map<string, () => boolean>()

  /** Subscribe to mic state changes. Fires immediately with the current state.
   *  Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** The shared capture stream, or null when the device is closed. */
  getStream(): MediaStream | null {
    return this.stream
  }

  isActive(): boolean {
    return this.stream !== null && this.consumers.size > 0
  }

  getConsumers(): readonly string[] {
    return [...this.consumers]
  }

  /** Last device acquisition error. Consumers use this to preserve the
   * browser's useful "busy"/permission distinction after a boolean start API
   * reports failure. Cleared by the next successful acquire. */
  getError(): MicError | null {
    return this.error
  }

  getPreferredDevice(): string | null {
    return this.preferredDeviceId
  }

  /**
   * Choose which audio input device to capture from (e.g. a Focusrite
   * instrument input). Pass null/'' for the system default. If the device
   * changes while open, the current handle is dropped so the next acquire
   * reopens on the new device — consumers must re-acquire to re-wire (the
   * guitar controller restarts the mic for this).
   */
  async setPreferredDevice(deviceId: string | null): Promise<void> {
    const next = deviceId !== null && deviceId !== '' ? deviceId : null
    if (this.preferredDeviceId === next) return
    this.preferredDeviceId = next
    await this.enqueue(async () => {
      this.teardown()
    })
  }

  private buildConstraints(): MediaStreamConstraints {
    const base = ANALYSIS_CONSTRAINTS.audio as MediaTrackConstraints
    const audio: MediaTrackConstraints =
      this.preferredDeviceId !== null
        ? { ...base, deviceId: { exact: this.preferredDeviceId } }
        : { ...base }
    return { audio }
  }

  /**
   * Acquire the shared microphone for `consumerId`. Idempotent per id — calling
   * it twice for the same consumer keeps a single hold. Returns the shared
   * MediaStream, or rejects with a {@link MicError} if the device can't open.
   */
  async acquire(consumerId: string): Promise<MediaStream> {
    return this.enqueue(async () => {
      this.cancelLinger()

      // Arbitrate across tabs before touching the device. Only the first open
      // needs to ask: once we hold the stream we already hold the lock, and a
      // second consumer in this tab is exactly what the ref count is for.
      if (this.stream === null) {
        const claim = claimMicLock()
        if (claim.outcome === 'held-elsewhere') {
          this.blockedBy = claim.holder
          const micError: MicError = {
            kind: 'held-elsewhere',
            message:
              'Another MercuryPitch tab is using your microphone. Use it here instead to move it over.',
          }
          this.error = micError
          this.emit()
          throw micError
        }
        this.blockedBy = null
      }

      this.consumers.add(consumerId)

      if (this.stream !== null) {
        this.error = null
        this.emit()
        return this.stream
      }

      try {
        const stream = await this.openDevice()
        this.stream = stream
        this.attachEndedHandlers(stream)
        this.error = null
        this.emit()
        return stream
      } catch (err) {
        // The open failed, so this consumer doesn't actually hold a device —
        // and neither does this tab, so give the lock straight back.
        this.consumers.delete(consumerId)
        if (this.consumers.size === 0) releaseMicLock()
        const micError = classifyError(err)
        this.error = micError
        this.emit()
        throw micError
      }
    })
  }

  /**
   * Release `consumerId`'s hold. When the last consumer leaves, the device is
   * torn down after a short linger (so a quick page switch reuses it).
   */
  release(consumerId: string): void {
    void this.enqueue(async () => {
      if (!this.consumers.delete(consumerId)) return
      if (this.consumers.size === 0) this.scheduleLinger()
      this.emit()
    })
  }

  private async openDevice(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia(this.buildConstraints())
    } catch (err) {
      // A saved device that's no longer present (interface unplugged, or a
      // different machine): the `exact` deviceId can't be satisfied. Drop it
      // and fall back to the system default instead of failing to open.
      const name = (err as { name?: string } | null)?.name
      if (name === 'OverconstrainedError' && this.preferredDeviceId !== null) {
        this.preferredDeviceId = null
        return navigator.mediaDevices.getUserMedia(this.buildConstraints())
      }
      // Retry once when the device is transiently busy (a previous handle that
      // is still releasing); other errors propagate immediately.
      if (classifyError(err).kind === 'device-busy') {
        await delay(BUSY_RETRY_DELAY_MS)
        return navigator.mediaDevices.getUserMedia(this.buildConstraints())
      }
      throw err
    }
  }

  private attachEndedHandlers(stream: MediaStream): void {
    // If the OS revokes the device mid-session (unplugged, taken by another
    // app), drop our reference so the next acquire re-opens cleanly.
    for (const track of stream.getTracks()) {
      track.addEventListener?.('ended', () => {
        if (this.stream === stream) this.teardown()
      })
    }
  }

  private scheduleLinger(): void {
    this.cancelLinger()
    this.lingerTimer = setTimeout(() => {
      this.lingerTimer = null
      if (this.consumers.size === 0) this.teardown()
    }, LINGER_MS)
  }

  private cancelLinger(): void {
    if (this.lingerTimer !== null) {
      clearTimeout(this.lingerTimer)
      this.lingerTimer = null
    }
  }

  private teardown(): void {
    if (this.stream !== null) {
      for (const track of this.stream.getTracks()) track.stop?.()
      this.stream = null
    }
    // The device is closed, so this tab no longer has any claim on it.
    releaseMicLock()
    this.emit()
  }

  /**
   * Drop every hold and close the device now, without the linger.
   *
   * Used when another tab asks for the mic and when this tab goes to the
   * background — cases where the point is precisely that we stop capturing.
   * Consumers find out through their existing `onMicLost` path, the same way
   * they learn about an OS revoke.
   */
  forceReleaseAll(): void {
    void this.enqueue(async () => {
      this.cancelLinger()
      this.consumers.clear()
      this.teardown()
    })
  }

  /**
   * Take the mic from whichever tab is holding it. Resolves true once this tab
   * holds the lock; false when the holder never answered, in which case the
   * caller must stay blocked rather than opening a second handle behind a live
   * one.
   */
  async takeOverFromOtherTab(): Promise<boolean> {
    const won = await requestMicHandoff()
    if (won) {
      this.blockedBy = null
      this.error = null
      this.emit()
    }
    return won
  }

  /** Set when another tab holds the mic, cleared once we do. */
  getBlockedBy(): MicLockRecord | null {
    return this.blockedBy
  }

  /**
   * Declare that this surface is mid-run, so the mic must not be taken from
   * underneath it — see {@link isRunInProgress}. Returns an unregister
   * function; call it when the run ends, not when the component unmounts, so
   * a run that outlives a route change is still protected.
   */
  registerRunGuard(id: string, isRunning: () => boolean): () => void {
    this.runGuards.set(id, isRunning)
    return () => {
      this.runGuards.delete(id)
    }
  }

  /**
   * True while any surface reports a run in progress: a take recording, an
   * exercise being scored, a challenge attempt. Nothing may release the mic
   * while this holds — a run interrupted halfway is worse than a mic left on.
   */
  isRunInProgress(): boolean {
    for (const isRunning of this.runGuards.values()) {
      try {
        if (isRunning()) return true
      } catch {
        // A guard that throws is a broken surface, not a licence to stop the
        // singer's run. Treat it as "busy" and let the next check settle it.
        return true
      }
    }
    return false
  }

  /** Run `task` after all previously-enqueued work, regardless of outcome. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private snapshot(): MicState {
    return {
      active: this.isActive(),
      error: this.error,
      consumers: [...this.consumers],
      blockedBy: micLockStatus() === 'other' ? this.blockedBy : null,
    }
  }

  private emit(): void {
    const snapshot = this.snapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}

/** App-wide microphone owner. Import this everywhere the mic is needed. */
export const micManager = new MicManager()

// When another tab asks for the mic, stop capturing before the lock moves —
// otherwise the hand-off hands over a name while this tab keeps the device.
setMicYieldHandler(() => {
  micManager.forceReleaseAll()
})

/**
 * How long a backgrounded tab may keep the microphone.
 *
 * Long enough to cover an alt-tab to check a lyric sheet or answer a message
 * and come straight back — re-opening the device on return is slower and
 * noisier than holding it. Short enough that a tab left behind is not still
 * showing a recording indicator minutes later, which is what this is for.
 */
const HIDDEN_RELEASE_GRACE_MS = 20_000
/** How often we re-check while hidden, so a run that ends in the background
 *  frees the mic promptly instead of waiting for the tab to come back. */
const HIDDEN_RECHECK_MS = 5000

if (typeof document !== 'undefined') {
  let graceTimer: ReturnType<typeof setTimeout> | null = null
  let recheckTimer: ReturnType<typeof setInterval> | null = null

  const stopWatching = (): void => {
    if (graceTimer !== null) {
      clearTimeout(graceTimer)
      graceTimer = null
    }
    if (recheckTimer !== null) {
      clearInterval(recheckTimer)
      recheckTimer = null
    }
  }

  const considerRelease = (): void => {
    if (!document.hidden) {
      stopWatching()
      return
    }
    if (!micManager.isActive()) return
    // Never mid-run. A take, a scored exercise or a challenge attempt owns the
    // mic until it finishes, however long the singer stays on another tab.
    if (micManager.isRunInProgress()) return
    console.info('[MicManager] Tab backgrounded — releasing the microphone')
    micManager.forceReleaseAll()
    stopWatching()
  }

  document.addEventListener('visibilitychange', () => {
    stopWatching()
    if (!document.hidden) return
    graceTimer = setTimeout(() => {
      graceTimer = null
      considerRelease()
      // A run still going when the grace expires must not buy the mic an
      // indefinite reprieve — keep checking until it ends or we come back.
      if (recheckTimer === null && document.hidden) {
        recheckTimer = setInterval(considerRelease, HIDDEN_RECHECK_MS)
      }
    }, HIDDEN_RELEASE_GRACE_MS)
  })
}
