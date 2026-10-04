// ============================================================
// audio-unlock — make WebAudio actually audible on iOS Safari
// ============================================================
//
// Two separate iOS behaviours conspire to keep WebAudio silent even though
// "the speaker works":
//
//  1. An AudioContext created outside a user gesture is born 'suspended',
//     and only a resume() that runs INSIDE a gesture un-suspends it. Our
//     karaoke stage mounts from a lazy chunk, so its context is created
//     long after the tap that staged the song.
//  2. WebAudio plays through the "ambient" audio session, which the
//     hardware ring/silent switch mutes outright — while <audio> elements
//     use the "playback" session and ignore the switch. Playing ANY media
//     element during a gesture promotes the page to the playback session,
//     un-muting WebAudio with it (the well-known unmute.js trick). iPhones
//     habitually live with the switch on, so without this the page is
//     simply silent.
//
// unlockAudio(ctx) does both and is safe to call on every play gesture.
// installAudioUnlock(getCtx) additionally arms document-level listeners so
// the first tap anywhere primes the session, and re-resumes the context
// when the tab becomes visible again (iOS suspends/interrupts contexts on
// tab switch and screen lock). standUnlockClipAside() hands the clip's job
// to an element that does it already: the iOS app's lock-screen carrier.

let silentEl: HTMLAudioElement | null = null
let sessionPrimed = false
let standingAside = false
/** What takes the session for a press of play while the clip stands aside. */
let sessionTaker: (() => void) | null = null

interface AudioActivationTarget {
  getAudioContext: () => AudioContext | null
  init: () => Promise<void>
  resume: () => Promise<void>
}

export interface AudioUnlockInstallOptions {
  /**
   * Rebuild a consumer-owned graph after an app switch instead of attempting
   * to revive the same context. WebKit can report that context as running
   * while its output clock remains permanently silent.
   */
  onBackgroundReturn?: () => void
}

/** Object URL for ~0.1s of silence as a 8kHz mono 16-bit WAV — built in
 *  code so there's no risk of a corrupt hand-typed data URI. */
function silentWavUrl(): string {
  const dataBytes = 1600 // 0.1s * 8000Hz * 2 bytes
  const buf = new ArrayBuffer(44 + dataBytes)
  const v = new DataView(buf)
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  v.setUint32(4, 36 + dataBytes, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  v.setUint32(16, 16, true) // fmt chunk size
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, 8000, true) // sample rate
  v.setUint32(28, 16000, true) // byte rate
  v.setUint16(32, 2, true) // block align
  v.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  v.setUint32(40, dataBytes, true)
  // Samples stay zeroed — silence.
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

/** iOS's own context state, which the DOM's AudioContextState does not name:
 *  a call, Siri, or another app has the sound. */
function isInterrupted(ctx: AudioContext): boolean {
  return String(ctx.state) === 'interrupted'
}

function playClip(): void {
  try {
    if (silentEl === null) {
      silentEl = new Audio(silentWavUrl())
      silentEl.setAttribute('playsinline', '')
      silentEl.preload = 'auto'
    }
    silentEl.muted = false
    const p = silentEl.play()
    sessionPrimed = true
    void p?.catch(() => {
      // Autoplay-blocked outside a gesture — the next real gesture retries.
      sessionPrimed = false
    })
  } catch {
    /* media element unavailable — nothing to promote */
  }
}

function resumeClock(ctx: AudioContext | null | undefined): void {
  if (ctx && ctx.state !== 'running') {
    void ctx.resume().catch(() => {
      /* not in a gesture yet — a later gesture will retry */
    })
  }
}

/** Play the silent clip (promoting the audio session) and resume the
 *  context. Must be called from inside a user gesture to have effect;
 *  calling it anywhere else is harmless. */
export function unlockAudio(ctx?: AudioContext | null): void {
  if (standingAside) {
    // Another element holds the session (see standUnlockClipAside).
    sessionPrimed = true
  } else {
    playClip()
  }
  resumeClock(ctx)
}

/**
 * For a press of play: the playback session first, then the clock, both
 * inside the gesture and before anything is awaited. `ensure` makes the
 * clock, or hands back the one there is, and may resume it itself.
 *
 * The order is WebKit's. It activates its audio session explicitly only for
 * sound that is already playing. A clock resumed first starts its output
 * under a session nothing activated: after another app had the sound, WebKit
 * still counts the session interrupted, misses that app's next take-over, and
 * the clock reports 'running' with no output behind it. The carrier or the
 * clip playing first makes the clock's resume the activation that clears it
 * (docs/plans/mobile-native/ios-audio-handoff.md).
 */
export function unlockForPlayback(
  ensure: () => AudioContext | null,
): AudioContext | null {
  if (standingAside) {
    sessionPrimed = true
    sessionTaker?.()
  } else {
    playClip()
  }
  const ctx = ensure()
  resumeClock(ctx)
  return ctx
}

/**
 * Stand the clip aside while another element holds the playback session, and
 * bring it back after.
 *
 * In the iOS app a Karaoke song puts a carrier of its own on the lock screen
 * (mobile-runtime's webkit-now-playing): looping silence that keeps the
 * session promoted, as this clip does. Beside it the clip is a rival. WebKit
 * shows on the lock screen whichever element a tap played last, sends a
 * headset's press to whichever started last, and, once the app is on the
 * lock screen, offers even a 0.1 s clip, which would keep it there after the
 * song has gone. Aside, the clip is muted, which WebKit never offers, and an
 * unlock does not play it. Brought back, it stays muted until the next
 * unlock: unmuted at once, it would qualify again before WebKit has taken
 * the app off the lock screen.
 *
 * `take` is what a press of play does instead while the clip stands aside
 * (`unlockForPlayback`): the carrier playing at once, ahead of the clock.
 * A tap anywhere else never calls it.
 */
export function standUnlockClipAside(aside: boolean, take?: () => void): void {
  standingAside = aside
  sessionTaker = aside ? (take ?? null) : null
  if (aside) {
    if (silentEl !== null) silentEl.muted = true
    return
  }
  // Nothing holds the session now: the next tap plays the clip again.
  sessionPrimed = false
}

/**
 * Initialize WebAudio and promote it to iOS's audible playback session while
 * the caller is still inside the user's Play/Resume gesture. AudioEngine.init
 * creates its context synchronously before its first await, so getAudioContext
 * can immediately hand that context to unlockAudio.
 */
export async function activateAudioPlayback(
  target: AudioActivationTarget,
): Promise<void> {
  const initialization = target.init()
  unlockAudio(target.getAudioContext())
  await initialization
  await target.resume()
}

async function recoverAfterBackground(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'closed') return

  try {
    if (ctx.state === 'running') {
      // WebKit can keep reporting "running" after an interruption while its
      // output remains silent. Cycling the context rebinds the output session.
      await ctx.suspend()
      await ctx.resume()
      return
    }
    await ctx.resume()
  } catch {
    /* retried on the next user gesture */
  }
}

/**
 * Arm document-level unlock: every tap re-checks the context (cheap no-op
 * once running + primed), and visibility changes recover a context iOS
 * suspended in the background. Returns an uninstaller.
 *
 * Neither touches a context iOS interrupted: a call, Siri or another app has
 * the sound then, and a tap on the page, or the page coming back, is not a
 * press of play. Taking the sound back is play's to do (`unlockForPlayback`);
 * from anywhere else it stops the other app, and leaves this one's clock
 * reporting 'running' with no output (docs/plans/mobile-native/
 * ios-audio-handoff.md).
 */
export function installAudioUnlock(
  getCtx: () => AudioContext | null,
  options: AudioUnlockInstallOptions = {},
): () => void {
  let wasBackgrounded = document.visibilityState !== 'visible'

  const onGesture = (): void => {
    const ctx = getCtx()
    if (ctx !== null && isInterrupted(ctx)) return
    if (sessionPrimed && (ctx === null || ctx.state === 'running')) return
    unlockAudio(ctx)
  }
  const onVisible = (): void => {
    if (document.visibilityState !== 'visible') {
      wasBackgrounded = true
      // iOS can discard the promoted playback audio session while keeping the
      // AudioContext state as "running". Require the next real gesture to
      // replay the silent media element and promote the session again.
      sessionPrimed = false
      return
    }

    const returnedFromBackground = wasBackgrounded
    if (returnedFromBackground) {
      wasBackgrounded = false
      if (options.onBackgroundReturn !== undefined) {
        options.onBackgroundReturn()
        return
      }
    }

    const ctx = getCtx()
    if (!ctx || isInterrupted(ctx)) return

    if (returnedFromBackground) {
      void recoverAfterBackground(ctx)
    } else if (ctx.state !== 'running' && ctx.state !== 'closed') {
      void ctx.resume().catch(() => {
        /* retried on the next gesture */
      })
    }
  }
  // Capture phase so stopPropagation-happy UI handlers can't starve it.
  document.addEventListener('touchend', onGesture, {
    capture: true,
    passive: true,
  })
  document.addEventListener('pointerup', onGesture, {
    capture: true,
    passive: true,
  })
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    document.removeEventListener('touchend', onGesture, { capture: true })
    document.removeEventListener('pointerup', onGesture, { capture: true })
    document.removeEventListener('visibilitychange', onVisible)
  }
}
