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

import type { MicError } from './mic-errors'
import { classifyError, heldElsewhere, NO_CAPTURE, superseded, } from './mic-errors'
import type { MicLockRecord } from './mic-lock'
import { claimMicLock, micLockStatus, releaseMicLock, requestMicHandoff, setMicYieldHandler, } from './mic-lock'

export type { MicError, MicErrorKind } from './mic-errors'

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
 * How long the track of an input of its own may stay muted before it counts
 * as gone. A browser that keeps one capture at a time (WebKit) mutes the
 * earlier track, rather than ending it, as another opens: a take would go on
 * recording silence with nothing said.
 */
const MUTED_INPUT_LOST_MS = 500

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop?.()
}

/** The input a stream is on, as the browser names it; null where it does not say. */
function trackDeviceId(stream: MediaStream): string | null {
  const id = stream.getAudioTracks?.()[0]?.getSettings?.().deviceId?.trim()
  return id !== undefined && id.length > 0 ? id : null
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

/**
 * A hold on an input of its own (acquireFrom), and the one way to end it:
 * a release names the hold it ends, so a late one from a hold a later
 * acquireFrom replaced cannot end the newer hold.
 */
export interface MicInputHold {
  readonly stream: MediaStream
  /** Its input was gone, so its stream is the default's. */
  readonly missing: boolean
  /** Let the input go; nothing once a later acquireFrom or a loss ended it. */
  release(): void
}

/** A consumer's hold on an input of its own (acquireFrom), on a stream of its own. */
interface ScopedHold {
  readonly consumerId: string
  /** The input asked for; null for the system default, or once it was gone. */
  deviceId: string | null
  /** Its input was gone, so its stream is the default's. */
  missing: boolean
  stream: MediaStream | null
  /** It records from the shared stream: its input is the app's. */
  shared: boolean
  /** Takes its listeners off its track when it ends. */
  readonly watch: AbortController
  /** A mute under way on its track, which loses the hold at MUTED_INPUT_LOST_MS. */
  muted: ReturnType<typeof setTimeout> | null
}

export class MicManager {
  private stream: MediaStream | null = null
  private readonly consumers = new Set<string>()
  private error: MicError | null = null
  private preferredDeviceId: string | null = null
  // One consumer can hold an input of its own (acquireFrom): the Studio
  // records from the input picked for it, on a stream of its own when that
  // is not the app's, so the shared stream, and every consumer on it, stays
  // on the app's input.
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
      // An input of its own recording from the shared stream keeps it, as a
      // stream of its own now; the app's consumers open the new input when
      // they next acquire, as they would after a teardown.
      const hold = this.scoped
      if (
        hold?.shared === true &&
        hold.stream !== null &&
        hold.stream === this.stream
      ) {
        hold.shared = false
        this.stream = null
        this.emit()
        return
      }
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
   * from an unplugged device, not as silence. The hold ends through its own
   * release, never through release(consumerId).
   *
   * On the app's own input, the one the shared stream asks for or is on (the
   * default for both, say), it records from the shared stream instead of
   * opening a second capture, which such a browser would mute one of. Its
   * track muted for MUTED_INPUT_LOST_MS counts as gone, as an unplug does.
   */
  acquireFrom(
    consumerId: string,
    deviceId: string | null,
  ): Promise<MicInputHold> {
    const hold: ScopedHold = {
      consumerId,
      deviceId: deviceId !== null && deviceId !== '' ? deviceId : null,
      missing: false,
      stream: null,
      shared: false,
      watch: new AbortController(),
      muted: null,
    }
    // Taken now, not when the open runs, so a release queued before this
    // call finds its hold replaced and leaves this one be (releaseHold).
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
      hold.shared = this.onSharedRoute(hold.deviceId)
      let stream: MediaStream
      try {
        stream = hold.shared
          ? await this.openShared(() => (hold.missing = true))
          : await this.openDevice(hold.deviceId, () => {
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
      if (this.scoped !== hold) this.dropOpened(hold, stream)
      hold.stream = stream
      this.watchHold(hold, stream)
      this.error = null
      this.emit()
      return {
        stream,
        missing: hold.missing,
        release: () => this.releaseHold(hold),
      }
    })
  }

  /** Give back what `hold`'s open got, after it was let go while it opened; its caller hears it was superseded. */
  private dropOpened(hold: ScopedHold, stream: MediaStream): never {
    if (hold.shared) this.lingerIfUnheld()
    else stopTracks(stream)
    if (!this.holdsDevice()) releaseMicLock()
    throw superseded()
  }

  /** End `hold` while it is the input of its own; a later acquireFrom or a loss ended it otherwise. */
  private releaseHold(hold: ScopedHold): void {
    void this.enqueue(async () => {
      if (this.scoped !== hold) return
      // A stream of its own closes now; the shared one stays for the linger.
      this.endScoped(hold)
      this.emit()
    })
  }

  /** Close a hold on an input of its own; its consumer sees `scoped` go. */
  private endScoped(hold: ScopedHold): void {
    if (this.scoped === hold) this.scoped = null
    hold.watch.abort()
    if (hold.muted !== null) clearTimeout(hold.muted)
    hold.muted = null
    const stream = hold.stream
    hold.stream = null
    // The shared stream stays with its consumers, or for the linger.
    if (stream !== null && hold.shared) this.lingerIfUnheld()
    else if (stream !== null) stopTracks(stream)
    if (!this.holdsDevice()) releaseMicLock()
  }

  /** Whether `deviceId` is the app's input: the one the shared stream asks for, or is on. */
  private onSharedRoute(deviceId: string | null): boolean {
    if (deviceId === this.preferredDeviceId) return true
    return (
      deviceId !== null &&
      this.stream !== null &&
      trackDeviceId(this.stream) === deviceId
    )
  }

  /** Hear `hold`'s input go: its track ended, or muted for MUTED_INPUT_LOST_MS. */
  private watchHold(hold: ScopedHold, stream: MediaStream): void {
    const options = { signal: hold.watch.signal }
    const lose = () => {
      if (hold.stream !== stream) return
      this.endScoped(hold)
      this.emit()
    }
    const muted = () => {
      if (hold.stream !== stream || hold.muted !== null) return
      hold.muted = setTimeout(lose, MUTED_INPUT_LOST_MS)
    }
    for (const track of stream.getTracks()) {
      // Muted already, as a shared stream an earlier capture muted is: no 'mute' comes.
      if (track.muted) muted()
      track.addEventListener?.('ended', lose, options)
      track.addEventListener?.('mute', muted, options)
      track.addEventListener?.(
        'unmute',
        () => {
          if (hold.muted !== null) clearTimeout(hold.muted)
          hold.muted = null
        },
        options,
      )
    }
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

      try {
        const stream = await this.openShared()
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
   * Release `consumerId`'s hold on the shared stream. When the last consumer
   * leaves, the device is torn down after a short linger (so a quick page
   * switch reuses it). An input of its own ends through its hold's release.
   */
  release(consumerId: string): void {
    void this.enqueue(async () => {
      if (!this.consumers.delete(consumerId)) return
      this.lingerIfUnheld()
      this.emit()
    })
  }

  /** The shared stream, opened on the app's input when it is closed; `gone` hears it fall back to the default. */
  private async openShared(gone?: () => void): Promise<MediaStream> {
    this.cancelLinger()
    if (this.stream !== null) return this.stream
    const stream = await this.openDevice(this.preferredDeviceId, () => {
      this.preferredDeviceId = null
      gone?.()
    })
    this.stream = stream
    this.resolvedDeviceId = trackDeviceId(stream) ?? this.preferredDeviceId
    this.attachEndedHandlers(stream)
    return stream
  }

  /** Whether nothing holds the shared stream: no consumer, and no input of its own recording from it. */
  private unheld(): boolean {
    const hold = this.scoped
    const recording =
      hold?.shared === true &&
      hold.stream !== null &&
      hold.stream === this.stream
    return this.consumers.size === 0 && !recording
  }

  /** Close the shared stream after the linger, once nothing holds it. */
  private lingerIfUnheld(): void {
    if (this.unheld()) this.scheduleLinger()
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
      if (this.unheld()) this.teardown()
    }, LINGER_MS)
  }

  private cancelLinger(): void {
    if (this.lingerTimer !== null) {
      clearTimeout(this.lingerTimer)
      this.lingerTimer = null
    }
  }

  private teardown(): void {
    this.cancelLinger()
    const stream = this.stream
    if (stream !== null) {
      stopTracks(stream)
      this.stream = null
      // An input of its own recording from it goes with it.
      const hold = this.scoped
      if (hold?.shared === true && hold.stream === stream) this.endScoped(hold)
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
