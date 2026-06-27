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

export type MicErrorKind =
  | 'permission-denied'
  | 'device-busy'
  | 'no-device'
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
        // The open failed, so this consumer doesn't actually hold a device.
        this.consumers.delete(consumerId)
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
    this.emit()
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
    }
  }

  private emit(): void {
    const snapshot = this.snapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}

/** App-wide microphone owner. Import this everywhere the mic is needed. */
export const micManager = new MicManager()
