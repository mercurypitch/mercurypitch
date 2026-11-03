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
  /**
   * The consumer holding an input of its own (acquireFrom) while its stream is
   * open; null (or absent) otherwise. It is not one of `consumers`, and the
   * shared stream's `active` says nothing about it.
   */
  scoped?: string | null
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

/**
 * Consumer ids that hold the device without any UI of their own.
 *
 * The mic sentinel's live-without-ui check skips these: a hold whose whole job
 * is to keep the device open BETWEEN surfaces has no icon it could disagree
 * with, and flagging it would put a false desync in the one diagnostic bug
 * reports are asked for. A phantom hold on a dead stream is still reported —
 * that check is about the hold, not the UI.
 */
export const BACKGROUND_HOLD_IDS: readonly string[] = ['routine']
// One automatic retry when the OS briefly reports the device as unavailable
// (typically a previous handle that has not finished releasing yet).
const BUSY_RETRY_DELAY_MS = 250

/**
 * The error name openDevice throws where the page cannot ask for a microphone
 * at all: no navigator.mediaDevices, as on an insecure origin, in some
 * embedded views and in some television browsers. Reaching through it anyway
 * threw a TypeError whose raw text became the copy.
 */
const NO_CAPTURE = 'NoCaptureError'

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
    case NO_CAPTURE:
      // A retry cannot help, so it is a missing device, not a busy one.
      return {
        kind: 'no-device',
        message: 'This browser cannot use a microphone.',
      }
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

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop?.()
}

function heldElsewhere(): MicError {
  return {
    kind: 'held-elsewhere',
    message:
      'Another MercuryPitch tab is using your microphone. Use it here instead to move it over.',
  }
}

/** An input of its own asked for again, or let go, before its open ran. */
function superseded(): MicError {
  return { kind: 'unknown', message: 'The input changed before it opened.' }
}

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

/** A consumer's hold on an input of its own (acquireFrom), on a stream of its own. */
interface ScopedHold {
  readonly consumerId: string
  /** The input asked for; null for the system default, or once it was gone. */
  deviceId: string | null
  /** Its input was gone, so its stream is the default's. */
  missing: boolean
  stream: MediaStream | null
}

export class MicManager {
  private stream: MediaStream | null = null
  private readonly consumers = new Set<string>()
  private error: MicError | null = null
  private preferredDeviceId: string | null = null
  // One consumer can hold an input of its own (acquireFrom): the Studio
  // records from the input picked for it on a stream of its own, so the
  // shared stream, and every consumer on it, stays on the app's input.
  private scoped: ScopedHold | null = null
  // The browser-resolved id for the current route. Keep it after teardown so
  // calibration and compensation still address the same physical input while
  // the system-default choice is closed; clear it when the requested route
  // changes and refresh it on the next successful open.
  private resolvedDeviceId: string | null = null
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

  /** True while the shared stream is open and held. An input of its own is {@link isCapturing}. */
  isActive(): boolean {
    return this.stream !== null && this.consumers.size > 0
  }

  /** True while any capture is open and held: the shared stream, or an input of its own. */
  isCapturing(): boolean {
    return this.isActive() || this.scoped?.stream != null
  }

  /** The consumer on an input of its own and its stream, while that stream is open. */
  getScopedHold(): { consumerId: string; stream: MediaStream } | null {
    const hold = this.scoped
    return hold?.stream != null
      ? { consumerId: hold.consumerId, stream: hold.stream }
      : null
  }

  /** Whether this tab has any device open, and so holds the cross-tab lock. */
  private holdsDevice(): boolean {
    return this.stream !== null || this.scoped?.stream != null
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

  getResolvedDevice(): string | null {
    return this.resolvedDeviceId
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
    this.resolvedDeviceId = null
    await this.enqueue(async () => {
      this.teardown()
    })
  }

  /**
   * Acquire for `consumerId` from an input of its own, `deviceId` (null for
   * the system default), on a stream of its own for as long as it holds it.
   * The shared stream and every consumer on it stay on the app's input
   * (setPreferredDevice). A device that is gone opens the default instead,
   * and `missing` says so. One consumer holds an input of its own at a time:
   * a later acquireFrom ends the earlier hold, and the state's `scoped` says
   * so. A browser that keeps one capture at a time ends the shared stream as
   * this one opens; its consumers hear that through the 'ended' path, as
   * from an unplugged device, not as silence.
   */
  acquireFrom(
    consumerId: string,
    deviceId: string | null,
  ): Promise<{ stream: MediaStream; missing: boolean }> {
    const hold: ScopedHold = {
      consumerId,
      deviceId: deviceId !== null && deviceId !== '' ? deviceId : null,
      missing: false,
      stream: null,
    }
    // Taken now, not when the open runs: a release called before this call
    // ends only the hold it saw (release), never this one.
    const previous = this.scoped
    this.scoped = hold
    return this.enqueue(async () => {
      if (previous !== null && previous !== hold) this.endScoped(previous)
      if (this.scoped !== hold) throw superseded()
      if (!this.holdsDevice()) {
        const claim = claimMicLock()
        if (claim.outcome === 'held-elsewhere') {
          this.scoped = null
          this.blockedBy = claim.holder
          this.error = heldElsewhere()
          this.emit()
          throw this.error
        }
        this.blockedBy = null
      }
      let stream: MediaStream
      try {
        stream = await this.openDevice(hold.deviceId, () => {
          hold.deviceId = null
          hold.missing = true
        })
      } catch (err) {
        if (this.scoped === hold) this.scoped = null
        if (!this.holdsDevice()) releaseMicLock()
        this.error = classifyError(err)
        this.emit()
        throw this.error
      }
      if (this.scoped !== hold) {
        // Released while it opened.
        stopTracks(stream)
        if (!this.holdsDevice()) releaseMicLock()
        throw superseded()
      }
      hold.stream = stream
      for (const track of stream.getTracks()) {
        track.addEventListener?.('ended', () => {
          if (hold.stream !== stream) return
          hold.stream = null
          if (this.scoped === hold) this.scoped = null
          if (!this.holdsDevice()) releaseMicLock()
          this.emit()
        })
      }
      this.error = null
      this.emit()
      return { stream, missing: hold.missing }
    })
  }

  /** Close a hold on an input of its own; its consumer sees `scoped` go. */
  private endScoped(hold: ScopedHold): void {
    if (this.scoped === hold) this.scoped = null
    if (hold.stream !== null) {
      stopTracks(hold.stream)
      hold.stream = null
    }
    if (!this.holdsDevice()) releaseMicLock()
  }

  private buildConstraints(deviceId: string | null): MediaStreamConstraints {
    const base = ANALYSIS_CONSTRAINTS.audio as MediaTrackConstraints
    const audio: MediaTrackConstraints =
      deviceId !== null
        ? { ...base, deviceId: { exact: deviceId } }
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
      // needs to ask: once we hold a stream we already hold the lock, and a
      // second consumer in this tab is exactly what the ref count is for.
      if (!this.holdsDevice()) {
        const claim = claimMicLock()
        if (claim.outcome === 'held-elsewhere') {
          this.blockedBy = claim.holder
          const micError = heldElsewhere()
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
        const stream = await this.openDevice(this.preferredDeviceId, () => {
          this.preferredDeviceId = null
        })
        this.stream = stream
        const reportedDeviceId = stream
          .getAudioTracks?.()[0]
          ?.getSettings?.()
          .deviceId?.trim()
        this.resolvedDeviceId =
          reportedDeviceId !== undefined && reportedDeviceId.length > 0
            ? reportedDeviceId
            : this.preferredDeviceId
        this.attachEndedHandlers(stream)
        this.error = null
        this.emit()
        return stream
      } catch (err) {
        // The open failed, so this consumer doesn't actually hold a device —
        // and neither does this tab, so give the lock straight back.
        this.consumers.delete(consumerId)
        if (this.consumers.size === 0 && !this.holdsDevice()) releaseMicLock()
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
    // The input of its own held now, not the one held when the release runs:
    // an acquireFrom called after this, as a re-arm on another input is, has
    // a hold of its own that this release must leave open.
    const hold = this.scoped?.consumerId === consumerId ? this.scoped : null
    void this.enqueue(async () => {
      if (hold !== null) {
        // Not shared, so it closes now, without the linger.
        this.endScoped(hold)
        this.emit()
      }
      if (!this.consumers.delete(consumerId)) return
      if (this.consumers.size === 0) this.scheduleLinger()
      this.emit()
    })
  }

  /** Open `deviceId` (null for the default); `gone` hears when it fell back to the default. */
  private async openDevice(
    deviceId: string | null,
    gone: () => void,
  ): Promise<MediaStream> {
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      const err = new Error('navigator.mediaDevices.getUserMedia is missing')
      err.name = NO_CAPTURE
      throw err
    }
    try {
      return await navigator.mediaDevices.getUserMedia(
        this.buildConstraints(deviceId),
      )
    } catch (err) {
      // A saved device that's no longer present (interface unplugged, or a
      // different machine): the `exact` deviceId can't be satisfied. Drop it
      // and fall back to the system default instead of failing to open.
      const name = (err as { name?: string } | null)?.name
      if (name === 'OverconstrainedError' && deviceId !== null) {
        gone()
        return navigator.mediaDevices.getUserMedia(this.buildConstraints(null))
      }
      // Retry once when the device is transiently busy (a previous handle that
      // is still releasing); other errors propagate immediately.
      if (classifyError(err).kind === 'device-busy') {
        await delay(BUSY_RETRY_DELAY_MS)
        return navigator.mediaDevices.getUserMedia(
          this.buildConstraints(deviceId),
        )
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
      stopTracks(this.stream)
      this.stream = null
    }
    // With no device open, this tab no longer has any claim on one.
    if (!this.holdsDevice()) releaseMicLock()
    this.emit()
  }

  /**
   * Drop every hold and close the device now, without the linger.
   *
   * Used when another tab asks for the mic and when this tab goes to the
   * background — cases where the point is precisely that we stop capturing.
   * Consumers find out through their existing `onMicLost` path, the same way
   * they learn about an OS revoke.
   *
   * Resolves once the device is actually closed, not once the close is queued.
   * The cross-tab handoff waits on this before releasing the lock: an open
   * that is still in flight sits ahead of us on the queue, and releasing the
   * lock first would let the other tab open a second handle behind it.
   */
  forceReleaseAll(): Promise<void> {
    return this.enqueue(async () => {
      this.cancelLinger()
      this.consumers.clear()
      if (this.scoped !== null) this.endScoped(this.scoped)
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

  /**
   * Give back a completed handoff when its requesting surface disappeared
   * before acquiring. The queue makes this safe beside a new local consumer:
   * an established or in-flight open wins and keeps the tab's lock.
   */
  releaseTakeoverIfUnused(): Promise<void> {
    return this.enqueue(async () => {
      if (this.holdsDevice() || this.consumers.size > 0) return
      releaseMicLock()
      this.emit()
    })
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
      scoped: this.getScopedHold()?.consumerId ?? null,
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
// Returning the promise is what makes "before" true: mic-lock waits on it.
setMicYieldHandler(() => micManager.forceReleaseAll())

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

  // There is nothing left to watch for once the tab is visible again or the
  // mic is closed — by us, by a consumer letting go, or by the OS. Saying so
  // in one place is what stops the re-check ticking in a background tab that
  // has not held a microphone for an hour.
  const nothingLeftToWatch = (): boolean =>
    !document.hidden || !micManager.isCapturing()

  /** 'settled' when there is nothing more to do; 'waiting' while a run holds
   *  the mic and we should look again shortly. */
  const considerRelease = (): 'settled' | 'waiting' => {
    if (nothingLeftToWatch()) {
      stopWatching()
      return 'settled'
    }
    // Never mid-run. A take, a scored exercise or a challenge attempt owns the
    // mic until it finishes, however long the singer stays on another tab.
    if (micManager.isRunInProgress()) return 'waiting'
    console.info('[MicManager] Tab backgrounded — releasing the microphone')
    void micManager.forceReleaseAll()
    stopWatching()
    return 'settled'
  }

  document.addEventListener('visibilitychange', () => {
    stopWatching()
    if (!document.hidden) return
    graceTimer = setTimeout(() => {
      graceTimer = null
      // A run still going when the grace expires must not buy the mic an
      // indefinite reprieve — keep checking until it ends or we come back.
      // Only then: a grace that ended by releasing the mic has nothing left
      // to poll, and an interval started anyway would tick in a background
      // tab for as long as the singer left it there.
      if (considerRelease() === 'waiting' && recheckTimer === null) {
        recheckTimer = setInterval(considerRelease, HIDDEN_RECHECK_MS)
      }
    }, HIDDEN_RELEASE_GRACE_MS)
  })
}
