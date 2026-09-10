// ============================================================
// Web Speech listener — the phase-1 ear for voice control
// ============================================================
//
// Wraps SpeechRecognition in the VoiceListener seam: continuous mode,
// interim results, and — unlike the lyric-capture wrapper in
// src/lib/speech-recognition.ts, which accumulates a transcript — DISCRETE
// final utterances: each final result is emitted alone, because the grammar
// matches whole utterances. Chrome ends continuous sessions on its own
// (silence, ~60 s, tab switches), so while started we respawn on `end`,
// backing off when the session dies immediately (a broken mic would
// otherwise hot-loop). Capture happens inside the browser's recognizer, NOT
// through mic-manager.ts — a phase-2 local engine must go through
// MicManager and register a mic indicator instead.
//
// ── Why this file is more careful than `r.start()` ──
//
// On iOS every assumption a desktop recognizer lets you make is wrong.
//
//  1. `start()` is only reliably permitted inside a user gesture. Voice
//     control is a persisted preference, so the start that matters happens at
//     mount — no gesture in sight — and WebKit refuses it. It refuses by
//     throwing, which this file used to swallow and then report `listening`
//     anyway: the pill said it was listening and nothing was ever connected.
//     That is the bug this file is built around. Nothing here reports
//     `listening` on its own say-so; only the recognizer's own `start` event
//     does, and until it arrives the state is `starting`.
//
//  2. A session can die with no `end` and no `error`, and the respawn logic
//     hangs off `end`, so a silent death used to be permanent. There are two
//     shapes of it and they need different answers. One never got going —
//     another audio consumer holding the mic — and `CONFIRM_START_MS` is the
//     watchdog for it: a session that does not announce itself is dead. The
//     other confirmed, worked, and then died — inside a freeze the document
//     came back from, or under Siri, a call, another app's capture — leaving
//     `live` true over nothing. A page returning from hidden or from the
//     back/forward cache replaces its session rather than trusting it, and a
//     confirmed session that fires no event at all for `STALE_SESSION_MS` is
//     presumed dead and replaced too.
//
//  3. Karaoke Night is a separate document, so walking into it and back out
//     is two full page loads, each with its own gesture-less mount. Recovery
//     therefore cannot depend on the singer finding the pill and pressing it
//     twice — while we are meant to be listening but nothing is, the next
//     touch ANYWHERE in the app respawns. That is the seam iOS leaves open,
//     and it is the same one `local-whisper-listener.ts` uses to resume its
//     AudioContext.
//
//  4. Every `start()` is a fresh capture request. On desktop that is free; on
//     iOS Chrome it is the "microphone allowed" bubble, and WebKit ends a
//     session after a few seconds of silence rather than a minute. A flat
//     300 ms respawn therefore showed the bubble every few seconds to anyone
//     who had voice control on and was not talking. So a session that heard
//     nothing costs more to respawn each time — the delay doubles per quiet
//     session — and after `QUIET_ROLLOVER_LIMIT` of them the timer stops and
//     the ear dozes: the next touch anywhere brings it back, one session per
//     touch, until it hears a word. Every wait long enough to notice is
//     announced as `dozing`, because a pill that says "listening" over a
//     recognizer that is not running is worse than one that admits it is
//     waiting for a tap. All of that is for devices where a respawn is
//     visible (`visibleRespawn`). Desktop respawns are silent, so desktop
//     keeps the flat 300 ms and never dozes: hands-free is the point of
//     voice control at a piano. Typing is not a touch — a keystroke or a
//     tap in a text field never starts a session — and neither is a tap on
//     the pill itself, which has its own meaning.

import { deviceClass } from '@/lib/device-tier'
import { micManager } from '@/lib/mic-manager'
import type { VoiceListener, VoiceListenerCallbacks } from './types'
import { probeMicrophone, recordVoiceDiagnostic, registerVoiceDiagnosticsMic, } from './voice-diagnostics'

// The recorder deliberately does not import the microphone — see the note on
// `MicSource`. This module already loads with voice control and nothing else,
// so it is the right place to hand it over.
registerVoiceDiagnosticsMic(micManager)

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string; confidence?: number }
  length: number
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult:
    | ((event: {
        resultIndex: number
        results: SpeechRecognitionResultLike[]
      }) => void)
    | null
  onerror: ((event: Event & { error: string }) => void) | null
  onend: (() => void) | null
  /** Fires when the service has actually begun listening. */
  onstart: (() => void) | null
  /**
   * The session's other lifecycle events. None of them carries words; they
   * are the recognizer saying it is still there, which is all the liveness
   * check below wants from them.
   */
  onaudiostart: (() => void) | null
  onaudioend: (() => void) | null
  onsoundstart: (() => void) | null
  onsoundend: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

const RESTART_DELAY_MS = 300
const FAST_END_BACKOFF_MS = 3000
/** Session lifetimes under this count as "died immediately". */
const FAST_END_THRESHOLD_MS = 1000
/** Consecutive immediate deaths before the restart delay backs off. */
const FAST_END_LIMIT = 5
/**
 * How long a session gets to fire `start` before we call it stillborn.
 * Chrome answers in tens of milliseconds; this is sized for a phone that is
 * also decoding a song, not for the happy path.
 */
const CONFIRM_START_MS = 4000
/**
 * The respawn delay after a session that was live and heard nothing doubles
 * with every consecutive quiet session, and stops growing here. Short,
 * because every one of these waits is a stretch where the pill is on and the
 * room is not being heard: the doze below is the honest end state, not a
 * fifteen-second gap that still calls itself listening.
 */
const QUIET_RESPAWN_MAX_MS = 3000
/**
 * Consecutive quiet sessions before the timed respawn stops altogether and
 * the ear dozes until the next touch — where a respawn is visible (see
 * `WebSpeechListenerOptions.visibleRespawn`). Three, so the ambiguous ramp
 * is a couple of seconds rather than most of a minute: on iOS the choice is
 * between a permission bubble every few seconds and an ear that waits to be
 * woken, and the second is only tolerable if the pill says so quickly.
 */
const QUIET_ROLLOVER_LIMIT = 3
/**
 * A wait longer than this is announced as `dozing` rather than left looking
 * like listening. The pill saying "listening" over a recognizer that is not
 * running is the "it says it hears me and it does not" report: below this the
 * gap is a blink, above it the singer is owed the truth and a tap that fixes
 * it.
 */
const QUIET_ANNOUNCE_MS = 900
/**
 * A session that heard a word respawns on the next task, not after
 * `RESTART_DELAY_MS`: WebKit ends a session as soon as it delivers a final
 * result, and the 300 ms that followed swallowed the beginning of a second
 * command given straight after the first.
 */
const HEARD_RESPAWN_MS = 0
/**
 * A confirmed session that has not fired any event for this long is presumed
 * dead — WebKit drops sessions without an `end` when another capture, Siri
 * or a call takes the audio — and is replaced. Just under Chrome's own ~60 s
 * silence end, so on desktop the replacement is one quiet session traded for
 * another, not a visible restart.
 */
/**
 * Below this, `start` did no real work.
 *
 * Measured across 90 sessions on an iPhone (iOS 18.7, FxiOS 155) on
 * 2026-09-10: a session that reported `start` in under 400 ms went on to hear
 * nothing 61 times out of 63. Every session that ever heard speech took
 * between 321 ms and 2.4 s to start, and most took over a second — the time
 * the platform needs to actually stand an audio pipeline up.
 *
 * A fast start is the platform handing back a recognizer it has not really
 * provisioned, usually because the previous one is still being torn down. It
 * still fires `start` and `audiostart`, and it never delivers a sample.
 */
const HOLLOW_START_MS = 400

/**
 * How long a suspiciously fast session gets to prove it is real.
 *
 * Long enough for `soundstart` from any room that is not silent, short
 * enough that the singer is not left talking to nothing. The alternative was
 * the stale timer below, which takes twelve seconds to reach the same
 * conclusion and then does it twice more before giving up — thirty-six
 * seconds of a dead microphone that looks alive.
 */
const HOLLOW_GRACE_MS = 2_500

const STALE_SESSION_MS = 45_000
/**
 * The same check where a respawn is visible, which is also where sessions
 * are short-lived: WebKit ends one after a few seconds of silence, so a
 * confirmed session that has said nothing for this long is far more likely
 * to be a phantom than a patient one. Forty-five seconds of a pill claiming
 * to listen over a dead recognizer is the reported "he indicates he is
 * listening, he doesn't listen"; this bounds it, and the replacement counts
 * as a quiet session, so a phone that keeps doing it dozes rather than
 * rebuilding for ever.
 */
const VISIBLE_STALE_SESSION_MS = 12_000
/**
 * A user gesture may replace a session that still calls itself live but has
 * been event-free this long: a phantom is indistinguishable from a quiet
 * room, and the gesture is the one moment iOS will surely accept a fresh
 * `start()`.
 */
const GESTURE_STALE_MS = 10_000
/**
 * `start()` throwing `InvalidStateError` usually means the session this one
 * replaced has not finished tearing down — WebKit's `abort()` is
 * asynchronous. One retry after a short wait lands inside the same
 * activation window; trusting the phantom instead left a session that never
 * fired `start` and became `needs-gesture` four seconds later.
 */
const INVALID_STATE_RETRY_MS = 250

/** Permission-shaped errors: do not restart, the user has to act first. */
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed'])

/**
 * Errors the session recovers from on its own: `end` follows and the respawn
 * handles it. Announcing them flipped the HUD to "Mic unavailable" and back
 * again on every WebKit network hiccup.
 */
const QUIET_ERRORS = new Set(['no-speech', 'aborted', 'network'])

/** `start()` throws this when a session is already running. */
const ALREADY_RUNNING = 'InvalidStateError'

/** Where a keystroke or a tap is typing, not a touch to spend on the recognizer. */
const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])"
/**
 * The pill and its menu. A tap there is the singer operating voice control
 * — toggling it, opening the menu — and the controller answers it on
 * `click`; spending the `pointerdown` on a session first made the same tap
 * mean two different things depending on which landed sooner.
 */
const VOICE_HUD_SELECTOR = '[data-voice-control-hud]'

/**
 * Finals with a REAL low confidence estimate are dropped before they reach
 * the grammar. Chrome reports 0 when it has no estimate at all, so only a
 * positive-but-low value blocks the utterance.
 */
const MIN_FINAL_CONFIDENCE = 0.3

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null

const isVoiceHudTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(VOICE_HUD_SELECTOR) !== null

export interface WebSpeechListenerOptions {
  /**
   * Every `start()` is something the user notices — the permission bubble on
   * iOS, the start chime on Android. Quiet sessions then respawn with a
   * growing delay and, after `QUIET_ROLLOVER_LIMIT` of them, not at all
   * until the next touch; a touch may also replace a session that calls
   * itself live but has been silent for `GESTURE_STALE_MS`. Defaults to
   * phones, tablets and TVs, never to desktop, whose respawns are silent and
   * whose user may have both hands on an instrument.
   */
  visibleRespawn?: boolean
}

export function createWebSpeechListener(
  callbacks: VoiceListenerCallbacks,
  options: WebSpeechListenerOptions = {},
): VoiceListener {
  const visibleRespawn = options.visibleRespawn ?? deviceClass() !== 'desktop'
  const w = window as unknown as Record<string, unknown>
  const RecognitionCtor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined

  if (RecognitionCtor === undefined) {
    return { isSupported: false, start: () => {}, stop: () => {} }
  }

  /** The caller wants us listening. Independent of whether we manage to. */
  let started = false
  /** The recognizer has confirmed this session with its own `start` event. */
  let live = false
  /**
   * Some session, at some point, actually worked.
   *
   * Chrome ends a continuous session on every silence, so respawning is the
   * normal rhythm rather than an event — and `starting` is a talking state
   * that pops the pill open over the header (see voice-hud-presence.ts). A
   * respawn after a healthy session is a continuation and says nothing; only
   * a cold start, or a restart after we have admitted an error, announces
   * itself. The watchdog still catches a respawn that turns out to be dead.
   */
  let hasBeenLive = false
  let recognition: SpeechRecognitionLike | null = null
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let confirmTimer: ReturnType<typeof setTimeout> | null = null
  let staleTimer: ReturnType<typeof setTimeout> | null = null
  let listeningForGesture = false
  let spinUpAt = 0
  let fastEnds = 0
  /** Consecutive sessions that were live and ended without a result. */
  let quietRollovers = 0
  /** The current session has produced a result since it started. */
  let heardResult = false
  /** When the current session last said anything at all. */
  let lastEventAt = 0
  /** The one `InvalidStateError` retry this start attempt gets has been spent. */
  let invalidStateRetried = false
  /**
   * Which session each record belongs to. A phantom and the session that
   * replaced it are different numbers; reading a log that conflates them is
   * how "it stopped hearing me" gets mistaken for "it never started".
   */
  let sessionSeq = 0
  /** Records one transition against the session that is running now. */
  const log = (event: string, detail: Record<string, unknown> = {}) => {
    recordVoiceDiagnostic(event, sessionSeq, detail)
  }

  const clearRestartTimer = () => {
    if (restartTimer !== null) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  const clearConfirmTimer = () => {
    if (confirmTimer !== null) {
      clearTimeout(confirmTimer)
      confirmTimer = null
    }
  }

  const clearStaleTimer = () => {
    if (staleTimer !== null) {
      clearTimeout(staleTimer)
      staleTimer = null
    }
  }

  /** Drop a session we no longer believe in, without hearing from it again. */
  const discard = () => {
    const r = recognition
    recognition = null
    live = false
    heardResult = false
    clearConfirmTimer()
    clearStaleTimer()
    clearHollowTimer()
    if (r === null) return
    r.onresult = null
    r.onerror = null
    r.onend = null
    r.onstart = null
    r.onaudiostart = null
    r.onaudioend = null
    r.onsoundstart = null
    r.onsoundend = null
    r.onspeechstart = null
    r.onspeechend = null
    try {
      // `abort` drops the session without waiting for a final result; `stop`
      // is the graceful form and is all some engines implement.
      if (typeof r.abort === 'function') r.abort()
      else r.stop()
    } catch {
      // Already gone, which is the state we wanted.
    }
  }

  /**
   * 300 ms after a session that heard something; doubling after each that
   * did not, where a respawn is visible. Silent respawns stay at 300 ms.
   */
  const quietRespawnDelay = (): number =>
    visibleRespawn
      ? Math.min(RESTART_DELAY_MS * 2 ** quietRollovers, QUIET_RESPAWN_MAX_MS)
      : RESTART_DELAY_MS

  const scheduleRestart = (delay: number) => {
    clearRestartTimer()
    // A wait the singer would notice is a pause, and is named one. The next
    // session's own `start` event puts the pill back to listening, and the
    // gesture seam can cut the wait short in the meantime. Only where a
    // respawn is visible: desktop's own three-second backoff after a run of
    // stillborn sessions is not a pause the user has to do anything about,
    // and this file promises desktop never dozes.
    if (visibleRespawn && delay >= QUIET_ANNOUNCE_MS) {
      callbacks.onStateChange('dozing')
    }
    log('restart-scheduled', {
      delay,
      announced: visibleRespawn && delay >= QUIET_ANNOUNCE_MS,
      quiet: quietRollovers,
      fastEnds,
    })
    restartTimer = setTimeout(() => {
      restartTimer = null
      if (started) spinUp()
    }, delay)
  }

  // ── The gesture seam ──────────────────────────────────────────
  //
  // iOS grants `start()` inside a user gesture and, often enough, nowhere
  // else. So while we are meant to be listening, a touch anywhere in the app
  // is spent on the recognizer whenever the recognizer could use it: nothing
  // running (dozing, refused, or waiting out a backoff), or a session that
  // calls itself live but has said nothing for a while and may be a phantom.
  // Armed for the whole run. Capture phase and passive, so it never
  // interferes with what the user was actually doing — and a keystroke that
  // is typing, inside a text field, is left to the text field.

  const onGesture = (event: Event) => {
    if (!started) return
    if (isEditableTarget(event.target) || isVoiceHudTarget(event.target)) return
    if (recognition === null) {
      // The touch is the restart; a timer waiting to do the same is moot,
      // and a start that failed on `InvalidStateError` before gets its retry
      // back, because this attempt is a new one.
      log('gesture-wake', { kind: event.type, pending: restartTimer !== null })
      clearRestartTimer()
      invalidStateRetried = false
      spinUp()
      return
    }
    // A silent desktop session is not a phantom worth an abort-and-start on
    // every click; the stale timer covers it there.
    if (!visibleRespawn) return
    if (live && Date.now() - lastEventAt > GESTURE_STALE_MS) {
      log('gesture-replace', { sinceLastEvent: Date.now() - lastEventAt })
      spinUp()
    }
  }

  const listenForGesture = () => {
    if (listeningForGesture) return
    listeningForGesture = true
    window.addEventListener('pointerdown', onGesture, {
      capture: true,
      passive: true,
    })
    window.addEventListener('keydown', onGesture, { capture: true })
  }

  const stopListeningForGesture = () => {
    if (!listeningForGesture) return
    listeningForGesture = false
    window.removeEventListener('pointerdown', onGesture, { capture: true })
    window.removeEventListener('keydown', onGesture, { capture: true })
  }

  /**
   * Admit that nothing is listening and wait to be touched. The one exit from
   * every way iOS takes the recognizer away silently. The seam is already
   * armed; this only says so.
   */
  const failToGesture = (detail: string) => {
    log('needs-gesture', { detail })
    hasBeenLive = false
    callbacks.onStateChange('error', detail)
  }

  /**
   * Stop respawning on a timer and wait to be touched, without admitting
   * anything: the sessions were healthy, they just heard nothing. `hasBeenLive`
   * stays, so the session the next touch starts is a continuation and says
   * nothing either — the HUD shows a mic at rest, not a fault.
   */
  const doze = () => {
    // The leading hypothesis for VC-1 is that this is what the singer sees
    // and reads as a death. If that is right, this line is the whole answer.
    log('doze', { quiet: quietRollovers, limit: QUIET_ROLLOVER_LIMIT })
    callbacks.onStateChange('dozing')
  }

  /** Let go of everything that could bring a session back: timers, the
   *  gesture seam, and the page hooks below. */
  const letGoOfPage = () => {
    started = false
    hasBeenLive = false
    frozenWithSession = false
    clearRestartTimer()
    clearConfirmTimer()
    clearStaleTimer()
    clearHollowTimer()
    stopListeningForGesture()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pageshow', onPageShow)
    window.removeEventListener('pagehide', onPageHide)
  }

  /** Give up until start() is called again, and say why. The exit for
   *  errors only the user can fix. */
  const standDown = (detail: string) => {
    log('stand-down', { detail })
    letGoOfPage()
    discard()
    callbacks.onInterim('')
    callbacks.onStateChange('error', detail)
  }

  // ── Coming back to a page that was put away ───────────────────
  //
  // iOS suspends a backgrounded document and does not always tell the
  // recognizer, so a tab returning from the app switcher, from a lock, or
  // from the back/forward cache can hold a session that will never speak
  // again — `live` stays true over a recognizer that stopped existing, which
  // is the shape of "it just does not hear me any more".
  //
  // Nothing here can ask a session whether it is still alive, and the only
  // proof is a result the room may never produce. So a page that was put away
  // replaces its session rather than trusting it. The cost is one restart the
  // singer cannot see — a respawn after a healthy session says nothing (see
  // `hasBeenLive`) — against a mic that is otherwise deaf until the tab is
  // reloaded.

  /**
   * A session was given back because the document was being frozen, and a
   * restore should bring it back. Distinct from dozing, which also leaves
   * nothing running but means the opposite: stay quiet until a touch.
   */
  let frozenWithSession = false
  /** Set while a suspiciously fast session is on probation. */
  let hollowTimer: ReturnType<typeof setTimeout> | null = null

  const clearHollowTimer = () => {
    if (hollowTimer === null) return
    clearTimeout(hollowTimer)
    hollowTimer = null
  }

  const onVisibility = () => {
    log('visibilitychange', { to: document.visibilityState, started })
    // `visibilitychange` only fires on a transition, so arriving here at
    // `visible` means the document was hidden until a moment ago.
    if (!started || document.visibilityState !== 'visible') return
    // Dozing — nothing running and nothing scheduled — stays dozing: a
    // gesture-less `start()` here is one iOS refuses, and the refusal would
    // expand the pill over the header. The next touch wakes it.
    if (recognition === null && restartTimer === null) return
    clearRestartTimer()
    spinUp()
  }

  const onPageHide = (event: Event) => {
    if (!started) return
    const persisted = (event as { persisted?: boolean }).persisted === true
    // Logged as it is branched on, and the pending restart shown separately.
    // A line whose whole job is to be read literally must not report `false`
    // for a case the code then acts on — that is how "it never started" gets
    // concluded from a page that was about to start.
    const hadSession = recognition !== null || restartTimer !== null
    log('pagehide', {
      persisted,
      live,
      hadSession,
      pendingRestart: restartTimer !== null,
    })
    if (!hadSession) return
    // Hand the recognizer back before the document is put away.
    //
    // `persisted` means FROZEN, not destroyed: the document keeps its
    // JavaScript state, a running recognizer included, and on iOS that
    // session goes on owning the platform's speech recognition while the
    // NEXT document runs. Measured on a device 2026-09-10, walking from here
    // into Karaoke Night: this page froze with `live=true`, and from then on
    // every session in every later document started in 40ms, reported
    // `audiostart`, and received nothing at all — while `getUserMedia`
    // probed the microphone itself as `free`. The rooms here are separate
    // documents, so this is not an edge case; it is every navigation.
    //
    // A destroyed document would let go on its own, but only eventually, and
    // letting go twice costs nothing.
    frozenWithSession = true
    clearRestartTimer()
    discard()
  }

  const onPageShow = (event: Event) => {
    // `persisted` is the back/forward-cache tell: the document was frozen
    // whole and thawed with its JS state intact, which is exactly the case
    // where a stale `live` looks healthy. iOS does not reliably fire
    // `visibilitychange` for it, so it is listened for separately.
    if (!started) return
    const persisted = (event as { persisted?: boolean }).persisted === true
    // Logged either way. "Came back and it was a fresh document" and "came
    // back to the frozen one" lead to completely different explanations, and
    // logging only the second left the first looking like no event at all.
    log(persisted ? 'pageshow-restored' : 'pageshow-fresh')
    if (!persisted) return
    // Whatever was running was handed back on the way out, so `recognition`
    // is null by design here. The flag is what remembers there was something
    // to bring back; without it the check below would read a thawed document
    // as one that had been dozing and leave it silent.
    const wasFrozen = frozenWithSession
    frozenWithSession = false
    if (!wasFrozen && recognition === null && restartTimer === null) return
    clearRestartTimer()
    spinUp()
  }

  /**
   * The liveness check for a confirmed session. Every event the recognizer
   * fires re-arms it; expiry means it has said nothing at all — no sound, no
   * speech, no result — for the whole window. Dead or merely quiet, it is
   * replaced the same way, and it counts as a quiet rollover: a recognizer
   * that keeps dying silently dozes like one that keeps ending silently,
   * instead of being rebuilt forever.
   */
  /**
   * Note a session that started implausibly fast. Diagnostic only.
   *
   * The start time is a real signal — across 90 sessions on a device, a
   * `start` under `HOLLOW_START_MS` went on to hear nothing 61 times out of
   * 63 — but it is not something to ACT on, and two runs proved why.
   *
   * Acting on it needs a second condition, "and then heard nothing", and
   * there is no honest deadline for that. Healthy sessions in the same relay
   * reached `speechstart` anywhere from 1.4 s to 4.9 s, and in a silent room
   * a perfectly good session produces nothing at all for as long as nobody
   * speaks. Any window short enough to be useful kills good sessions; any
   * window long enough to be safe is the stale timer, which already exists.
   *
   * And the remedy did not work regardless. Replacing a hollow session after
   * 600 ms, 1200 ms and a full 3 s all came back hollow again (`afterMs=9`
   * after the three-second wait). Leaving the platform alone is not what it
   * wants.
   *
   * So this only writes the line down. `hollow-start` in a record means "the
   * platform handed this one back without opening anything", which is worth
   * knowing and is not worth a guess.
   */
  const armHollowTimer = (r: SpeechRecognitionLike, afterMs: number) => {
    clearHollowTimer()
    hollowTimer = setTimeout(() => {
      hollowTimer = null
      if (!started || recognition !== r) return
      log('hollow-start', { afterMs, graceMs: HOLLOW_GRACE_MS })
      const hollowSession = sessionSeq
      void probeMicrophone().then((result) => {
        if (result !== 'not-probed')
          recordVoiceDiagnostic('mic-probe', hollowSession, { result })
      })
    }, HOLLOW_GRACE_MS)
  }

  const armStaleTimer = (r: SpeechRecognitionLike) => {
    clearStaleTimer()
    staleTimer = setTimeout(
      () => {
        staleTimer = null
        if (!started || recognition !== r || !live) return
        // A confirmed session that has said nothing at all. This is the
        // "live over nothing" shape; the count says how often it happens.
        log('stale-replace', {
          after: visibleRespawn ? VISIBLE_STALE_SESSION_MS : STALE_SESSION_MS,
          sinceLastEvent: Date.now() - lastEventAt,
        })
        // A confirmed session that heard nothing at all is either a broken
        // recognizer or a microphone somebody else is holding, and only the
        // platform can say which. No-ops unless diagnostics are recording.
        const deafSession = sessionSeq
        void probeMicrophone().then((result) => {
          if (result !== 'not-probed')
            recordVoiceDiagnostic('mic-probe', deafSession, { result })
        })
        quietRollovers += 1
        discard()
        callbacks.onInterim('')
        if (visibleRespawn && quietRollovers >= QUIET_ROLLOVER_LIMIT) {
          doze()
          return
        }
        spinUp()
      },
      visibleRespawn ? VISIBLE_STALE_SESSION_MS : STALE_SESSION_MS,
    )
  }

  const spinUp = () => {
    discard()
    sessionSeq += 1
    log('spin-up', { visibleRespawn, hasBeenLive })

    const r = new RecognitionCtor()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'
    r.maxAlternatives = 1

    /** The session is still there. Only a live one runs the liveness clock. */
    const ping = () => {
      if (recognition !== r) return
      lastEventAt = Date.now()
      if (live) armStaleTimer(r)
    }

    /**
     * These six were already keeping the session alive; now they say so.
     *
     * `audiostart` is the one that decides everything. It means the browser
     * really opened an audio stream for this session, and its absence is the
     * difference between a recognizer that is listening and one that agreed
     * to listen to nothing. Until this was logged, the two were identical in
     * the record: both show a clean `start` and then silence.
     *
     * First of each per session only. `audiostart` and `audioend` fire once
     * anyway; the sound and speech pairs fire per utterance, and a line each
     * would bury the session they belong to.
     */
    const heardSoFar = new Set<string>()
    const heard = (event: string) => () => {
      if (recognition !== r) return
      if (!heardSoFar.has(event)) {
        heardSoFar.add(event)
        log(event, { afterMs: Date.now() - spinUpAt })
      }
      // `audiostart` proves nothing — a hollow session fires it too, within a
      // few milliseconds. Sound is the proof, so only sound ends probation.
      if (event !== 'audiostart' && event !== 'audioend') clearHollowTimer()
      ping()
    }
    r.onaudiostart = heard('audiostart')
    r.onaudioend = heard('audioend')
    r.onsoundstart = heard('soundstart')
    r.onsoundend = heard('soundend')
    r.onspeechstart = heard('speechstart')
    r.onspeechend = heard('speechend')

    r.onstart = () => {
      if (recognition !== r) return
      const afterMs = Date.now() - spinUpAt
      log('start', { afterMs })
      // A start this fast provisioned nothing — see HOLLOW_START_MS. Put it
      // on probation rather than trusting the stale timer, which needs twelve
      // seconds to reach the same conclusion and then repeats itself twice.
      // Only where respawns are visible, which is this file's name for the
      // mobile path. A fast start on desktop is a healthy one — the platform
      // has the pipeline standing already, and the record this was measured
      // from is entirely iOS.
      if (visibleRespawn && afterMs < HOLLOW_START_MS)
        armHollowTimer(r, afterMs)
      live = true
      hasBeenLive = true
      fastEnds = 0
      invalidStateRetried = false
      clearConfirmTimer()
      ping()
      callbacks.onStateChange('listening')
    }

    r.onresult = (event) => {
      if (recognition === r) {
        // Words are the strongest proof of all.
        clearHollowTimer()
        // Some engines deliver results without ever firing `start`. Hearing
        // one is proof enough that the session is alive.
        if (!live) {
          live = true
          hasBeenLive = true
          clearConfirmTimer()
          callbacks.onStateChange('listening')
        }
        // A word, even a half-formed interim one, ends the quiet stretch.
        // Logged by shape, never by content: the point is "did it hear
        // anything", and the transcript is the singer's own speech.
        if (!heardResult)
          log('first-result', { sinceStart: Date.now() - spinUpAt })
        heardResult = true
        quietRollovers = 0
        invalidStateRetried = false
        ping()
      }
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const alternative = result[0]
          const text = alternative.transcript.trim()
          const confidence = alternative.confidence
          const tooUncertain =
            typeof confidence === 'number' &&
            confidence > 0 &&
            confidence < MIN_FINAL_CONFIDENCE
          if (text !== '' && !tooUncertain) callbacks.onUtterance(text)
        } else {
          interim += result[0].transcript
        }
      }
      callbacks.onInterim(interim.trim())
    }

    r.onerror = (event) => {
      log('error', { code: event.error, live })
      // A session we have already replaced may still complain on its way
      // out, and announcing that would paint an error over the state its
      // replacement is in.
      if (recognition !== r) return
      if (QUIET_ERRORS.has(event.error)) return
      if (FATAL_ERRORS.has(event.error)) {
        // The user has to act, and nothing here can act for them: a refused
        // permission is refused again by every timed restart and by every
        // touch spent on it. Spending touches was how a denied mic kept
        // respawning the recognizer and toasting on every tap anywhere in
        // the app. Stand down for good and say why once; the controller
        // turns voice control off and the next toggle is a fresh start().
        standDown(event.error)
        return
      }
      // What is left is the mic itself (`audio-capture`) and the odd engine
      // complaint, which the user should see. `end` follows and restarts
      // because `started` is still true.
      hasBeenLive = false
      callbacks.onStateChange('error', event.error)
    }

    r.onend = () => {
      if (recognition !== r) return
      recognition = null
      const wasLive = live
      const wasQuiet = wasLive && !heardResult
      live = false
      heardResult = false
      clearConfirmTimer()
      clearStaleTimer()
      callbacks.onInterim('')
      if (!started) return
      const lifetime = Date.now() - spinUpAt
      log('end', { lifetime, wasLive, wasQuiet, quiet: quietRollovers })
      fastEnds = lifetime < FAST_END_THRESHOLD_MS ? fastEnds + 1 : 0
      // A session that never got going is not worth respawning on a timer —
      // on iOS that is the gesture refusal, and every timed retry is refused
      // in exactly the same way. Wait to be touched instead.
      if (!wasLive && fastEnds >= FAST_END_LIMIT) {
        failToGesture('needs-gesture')
        return
      }
      if (wasQuiet) {
        quietRollovers += 1
        if (visibleRespawn && quietRollovers >= QUIET_ROLLOVER_LIMIT) {
          doze()
          return
        }
      }
      scheduleRestart(
        Math.max(
          fastEnds >= FAST_END_LIMIT ? FAST_END_BACKOFF_MS : 0,
          wasQuiet || !wasLive ? quietRespawnDelay() : HEARD_RESPAWN_MS,
        ),
      )
    }

    recognition = r
    live = false
    heardResult = false
    spinUpAt = Date.now()
    lastEventAt = spinUpAt
    if (!hasBeenLive) callbacks.onStateChange('starting')

    try {
      r.start()
    } catch (err) {
      const name = (err as { name?: string } | null)?.name
      log('start-threw', {
        name: name ?? 'unknown',
        retried: invalidStateRetried,
      })
      discard()
      if (name === ALREADY_RUNNING && !invalidStateRetried) {
        // Something still holds the recognizer — as a rule the session this
        // one replaced, mid-teardown. Not ours to trust: retry once after it
        // has had a moment to let go.
        invalidStateRetried = true
        scheduleRestart(INVALID_STATE_RETRY_MS)
        return
      }
      invalidStateRetried = false
      // The iOS refusal, a second `InvalidStateError` in a row, and any other
      // hard failure. Saying `listening` here is what made this bug invisible
      // for so long.
      failToGesture('needs-gesture')
      return
    }

    // Nothing above proves a session exists — only `onstart` does.
    clearConfirmTimer()
    confirmTimer = setTimeout(() => {
      confirmTimer = null
      if (!started || recognition !== r || live) return
      // Stillborn: no start, no error, no end. Another consumer holding the
      // mic looks exactly like this on iOS — which is why the record carries
      // what the app's own microphone was doing at the time.
      log('stillborn', { after: CONFIRM_START_MS })
      discard()
      callbacks.onInterim('')
      failToGesture('needs-gesture')
    }, CONFIRM_START_MS)
  }

  return {
    isSupported: true,
    start: () => {
      if (started) return
      log('start-requested')
      started = true
      fastEnds = 0
      quietRollovers = 0
      invalidStateRetried = false
      document.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('pageshow', onPageShow)
      window.addEventListener('pagehide', onPageHide)
      listenForGesture()
      spinUp()
    },
    stop: () => {
      log('stop-requested')
      letGoOfPage()
      discard()
      callbacks.onInterim('')
      callbacks.onStateChange('idle')
    },
  }
}
