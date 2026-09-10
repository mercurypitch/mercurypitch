// ============================================================
// The ear says it is listening only when it is
// ============================================================
//
// Every case here is a way iOS takes the recognizer away without saying so.
// The bug that prompted them: walking into Karaoke Night — a separate
// document, so a full page load — restarted voice control at mount, with no
// user gesture behind it. WebKit refused, the refusal was swallowed, and the
// pill reported `listening` over a recognizer that had never started. The
// singer saw a listening mic that could not hear them, and toggling it off
// and on spent the one gesture that could have fixed it.
//
// So: nothing reports `listening` on its own say-so, and every way a session
// can die quietly ends somewhere a touch can recover from.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceListenerState } from './types'
import { initVoiceDiagnostics, resetVoiceDiagnosticsForTests, voiceDiagnosticEntries, } from './voice-diagnostics'
import type { WebSpeechListenerOptions } from './webspeech-listener'
import { createWebSpeechListener } from './webspeech-listener'

/** A recognizer that does exactly what the test tells it to and nothing else. */
class FakeRecognition {
  static instances: FakeRecognition[] = []
  /** Set to make `start()` throw, as WebKit does without a gesture. */
  static startThrows: { name: string } | null = null

  continuous = false
  interimResults = false
  lang = ''
  maxAlternatives = 0
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  onstart: (() => void) | null = null
  onaudiostart: (() => void) | null = null
  onaudioend: (() => void) | null = null
  onsoundstart: (() => void) | null = null
  onsoundend: (() => void) | null = null
  onspeechstart: (() => void) | null = null
  onspeechend: (() => void) | null = null
  aborted = false
  startCalls = 0

  constructor() {
    FakeRecognition.instances.push(this)
  }

  start(): void {
    this.startCalls++
    if (FakeRecognition.startThrows !== null) {
      throw Object.assign(new Error('refused'), FakeRecognition.startThrows)
    }
  }

  stop(): void {
    this.aborted = true
  }

  abort(): void {
    this.aborted = true
  }

  /** The recognizer confirming the session, which is the only proof there is. */
  confirm(): void {
    this.onstart?.()
  }

  final(transcript: string, confidence?: number): void {
    this.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, length: 1, 0: { transcript, confidence } }],
    })
  }
}

/**
 * Every listener built here, so each test can be torn down.
 *
 * A started listener holds `pointerdown` and `visibilitychange` handlers on a
 * jsdom window that outlives the test, and one left behind answers the NEXT
 * test's gestures — which is a real property of the code, not a quirk of the
 * harness: this is why `stop()` has to let go of the page.
 */
let built: Array<{ stop: () => void }> = []

function harness(options?: WebSpeechListenerOptions) {
  const states: Array<{ state: VoiceListenerState; detail?: string }> = []
  const utterances: string[] = []
  const listener = createWebSpeechListener(
    {
      onUtterance: (text) => utterances.push(text),
      onInterim: () => {},
      onStateChange: (state, detail) => states.push({ state, detail }),
    },
    options,
  )
  built.push(listener)
  return {
    listener,
    states,
    utterances,
    last: () => states[states.length - 1],
    latest: () =>
      FakeRecognition.instances[FakeRecognition.instances.length - 1],
  }
}

beforeEach(() => {
  built = []
  FakeRecognition.instances = []
  FakeRecognition.startThrows = null
  vi.stubGlobal('SpeechRecognition', FakeRecognition)
  vi.useFakeTimers()
})

afterEach(() => {
  FakeRecognition.startThrows = null
  for (const listener of built) listener.stop()
  built = []
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('what the listener claims about itself', () => {
  it('says starting, not listening, until the recognizer confirms', () => {
    const h = harness()
    h.listener.start()

    expect(h.last().state).toBe('starting')
    expect(h.states.map((s) => s.state)).not.toContain('listening')

    h.latest().confirm()
    expect(h.last().state).toBe('listening')
  })

  it('says nothing when a healthy session simply rolls over', () => {
    // Chrome ends a continuous session on every silence, so this is the
    // normal rhythm — and `starting` is a talking state that pops the pill
    // open across the header. Announcing every respawn would undo the whole
    // point of collapsing it.
    const h = harness()
    h.listener.start()
    h.latest().confirm()
    // Healthy means it heard something: a session that did not waits longer
    // to respawn (see "a room that stays quiet").
    h.latest().final('play')
    const settled = h.states.length

    h.latest().onend?.()
    vi.advanceTimersByTime(400)
    h.latest().confirm()

    expect(FakeRecognition.instances).toHaveLength(2)
    expect(h.states.slice(settled).map((s) => s.state)).not.toContain(
      'starting',
    )
    expect(h.last().state).toBe('listening')
  })

  it('announces itself again after admitting it was not listening', () => {
    FakeRecognition.startThrows = { name: 'NotAllowedError' }
    const h = harness()
    h.listener.start()
    expect(h.last()).toEqual({ state: 'error', detail: 'needs-gesture' })

    FakeRecognition.startThrows = null
    window.dispatchEvent(new Event('pointerdown'))

    // Recovering from an error is a cold start, and the singer should see it.
    expect(h.last().state).toBe('starting')
  })

  it('accepts a result as proof, for engines that skip the start event', () => {
    const h = harness()
    h.listener.start()
    h.latest().final('play')

    expect(h.last().state).toBe('listening')
    expect(h.utterances).toEqual(['play'])
  })

  it('does not report listening when start() is refused', () => {
    // The whole bug. WebKit throws when there is no user gesture behind the
    // call, and voice control is a remembered preference — so this is the
    // ordinary path on iOS, not an edge case.
    FakeRecognition.startThrows = { name: 'NotAllowedError' }
    const h = harness()
    h.listener.start()

    expect(h.states.map((s) => s.state)).not.toContain('listening')
    expect(h.last()).toEqual({ state: 'error', detail: 'needs-gesture' })
  })

  it('retries once when start() says a session is already running', () => {
    // WebKit's abort() is asynchronous, so the session a toggle just tore
    // down can still hold the recognizer when the next start() arrives.
    // Trusting the phantom left a session that never fired `start` and
    // became "tap to resume" four seconds later — the "off and on sometimes
    // helps" of the device report. A short retry lands inside the same
    // activation window.
    FakeRecognition.startThrows = { name: 'InvalidStateError' }
    const h = harness()
    h.listener.start()
    const phantom = h.latest()

    expect(phantom.aborted).toBe(true)
    expect(h.states.map((s) => s.state)).not.toContain('error')

    FakeRecognition.startThrows = null
    vi.advanceTimersByTime(250)

    expect(FakeRecognition.instances).toHaveLength(2)
    h.latest().confirm()
    expect(h.last().state).toBe('listening')
  })

  it('waits to be touched when the retry is refused the same way', () => {
    FakeRecognition.startThrows = { name: 'InvalidStateError' }
    const h = harness()
    h.listener.start()
    vi.advanceTimersByTime(250)

    expect(FakeRecognition.instances).toHaveLength(2)
    expect(h.last()).toEqual({ state: 'error', detail: 'needs-gesture' })
    // No timed third attempt: whatever holds the recognizer is not letting go.
    vi.advanceTimersByTime(60_000)
    expect(FakeRecognition.instances).toHaveLength(2)

    // A touch is a new attempt, with a retry of its own.
    FakeRecognition.startThrows = null
    window.dispatchEvent(new Event('pointerdown'))
    expect(FakeRecognition.instances).toHaveLength(3)
  })

  it('gives up on a session that never announces itself', () => {
    // No start, no error, no end — what another audio consumer taking the mic
    // looks like from in here. Without the watchdog this state was permanent.
    const h = harness()
    h.listener.start()
    expect(h.last().state).toBe('starting')

    vi.advanceTimersByTime(5000)

    expect(h.last()).toEqual({ state: 'error', detail: 'needs-gesture' })
    expect(h.latest().aborted).toBe(true)
  })

  it('leaves a confirmed session alone', () => {
    const h = harness()
    h.listener.start()
    h.latest().confirm()
    const live = h.latest()

    vi.advanceTimersByTime(5000)

    expect(h.last().state).toBe('listening')
    expect(live.aborted).toBe(false)
  })
})

describe('getting back what iOS took away', () => {
  it('restarts on the next touch after a refused start', () => {
    FakeRecognition.startThrows = { name: 'NotAllowedError' }
    const h = harness()
    h.listener.start()
    expect(FakeRecognition.instances).toHaveLength(1)

    // The gesture that was missing at mount. Any touch, anywhere.
    FakeRecognition.startThrows = null
    window.dispatchEvent(new Event('pointerdown'))

    expect(FakeRecognition.instances).toHaveLength(2)
    h.latest().confirm()
    expect(h.last().state).toBe('listening')
  })

  it('spends only one gesture, not one per touch', () => {
    FakeRecognition.startThrows = { name: 'NotAllowedError' }
    const h = harness()
    h.listener.start()

    FakeRecognition.startThrows = null
    window.dispatchEvent(new Event('pointerdown'))
    h.latest().confirm()
    // Now listening — further touches must not churn the session.
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('pointerdown'))

    expect(FakeRecognition.instances).toHaveLength(2)
  })

  it('restarts when the page comes back from the background', () => {
    const h = harness()
    h.listener.start()
    h.latest().confirm()

    // Suspended and dropped without a word, which is the iOS app-switcher
    // case: the session object survives, the session does not.
    h.latest().onend?.()
    vi.advanceTimersByTime(400)
    const afterEnd = FakeRecognition.instances.length

    h.latest().onend?.()
    document.dispatchEvent(new Event('visibilitychange'))

    expect(FakeRecognition.instances.length).toBeGreaterThan(afterEnd)
  })

  it('replaces a session that still calls itself live after a suspension', () => {
    // The reported symptom: the mic goes quiet and stays quiet. iOS froze
    // the document, the recognizer died inside the freeze, and no end and no
    // error came back — so from in here the session still looks healthy and
    // every recovery path that trusts `live` steps over it.
    const h = harness()
    h.listener.start()
    h.latest().confirm()
    const stale = h.latest()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(stale.aborted).toBe(true)
    expect(FakeRecognition.instances).toHaveLength(2)
  })

  it('replaces the session a back/forward restore thawed', () => {
    // Walking out to Karaoke Night and back is two documents, and Safari may
    // hand the first one back from the bfcache with its JS state intact —
    // including a `live` flag over a recognizer that stopped existing.
    // `visibilitychange` is not reliably fired for this, so `pageshow` is.
    const h = harness()
    h.listener.start()
    h.latest().confirm()
    const stale = h.latest()

    window.dispatchEvent(
      Object.assign(new Event('pageshow'), { persisted: true }),
    )

    expect(stale.aborted).toBe(true)
    expect(FakeRecognition.instances).toHaveLength(2)
    h.latest().confirm()
    expect(h.last().state).toBe('listening')
  })

  it('ignores the pageshow of an ordinary load', () => {
    // Every navigation fires `pageshow`; only a restore carries `persisted`.
    const h = harness()
    h.listener.start()
    h.latest().confirm()

    window.dispatchEvent(new Event('pageshow'))

    expect(FakeRecognition.instances).toHaveLength(1)
  })

  it('respawns a session that ends while it is meant to be listening', () => {
    const h = harness()
    h.listener.start()
    h.latest().confirm()

    h.latest().onend?.()
    expect(FakeRecognition.instances).toHaveLength(1)
    // One quiet session in, the respawn waits 600 ms rather than 300 — see
    // "a room that stays quiet".
    vi.advanceTimersByTime(700)

    expect(FakeRecognition.instances).toHaveLength(2)
  })

  it('stops retrying on a timer once refusals are all it gets', () => {
    // Five stillborn sessions in a row on iOS is not a flaky mic, it is the
    // gesture rule. Timed retries are refused identically forever, so it
    // waits to be touched instead of burning the battery.
    FakeRecognition.startThrows = { name: 'NotAllowedError' }
    const h = harness()
    h.listener.start()
    vi.advanceTimersByTime(60_000)

    // One refused attempt, then silence until a gesture arrives.
    expect(FakeRecognition.instances).toHaveLength(1)
    expect(h.last()).toEqual({ state: 'error', detail: 'needs-gesture' })
  })
})

// ============================================================
// A room that stays quiet
// ============================================================
//
// Every `start()` is a capture request, and on iOS Chrome each one shows the
// "microphone allowed" bubble. WebKit ends a session a few seconds into any
// silence, and a flat 300 ms respawn then put the bubble on screen every few
// seconds for anyone with voice control on who was not talking — typing a
// song title, say. The respawn now costs more after each session that heard
// nothing, and after six of them it stops and waits to be touched.

describe('a room that stays quiet', () => {
  /**
   * Confirm the newest session, let it end without a word, and run the clock
   * to the respawn — and no further, so the session it builds can be
   * confirmed before the start watchdog gives up on it.
   */
  const quietSession = (h: ReturnType<typeof harness>) => {
    h.latest().confirm()
    h.latest().onend?.()
    vi.advanceTimersToNextTimer()
  }

  it('waits longer after each session that heard nothing', () => {
    // The clock is driven by hand here, since the delay is the point.
    const h = harness({ visibleRespawn: true })
    h.listener.start()

    h.latest().confirm()
    h.latest().onend?.()
    vi.advanceTimersByTime(500)
    expect(FakeRecognition.instances).toHaveLength(1)
    vi.advanceTimersByTime(200)
    expect(FakeRecognition.instances).toHaveLength(2)

    h.latest().confirm()
    h.latest().onend?.()
    vi.advanceTimersByTime(1100)
    expect(FakeRecognition.instances).toHaveLength(2)
    vi.advanceTimersByTime(200)
    expect(FakeRecognition.instances).toHaveLength(3)
  })

  it('stops respawning on a timer after three quiet sessions, without calling it an error', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    for (let i = 0; i < 3; i++) quietSession(h)

    // Three sessions, then nothing: no timer is running.
    expect(FakeRecognition.instances).toHaveLength(3)
    vi.advanceTimersByTime(600_000)
    expect(FakeRecognition.instances).toHaveLength(3)

    // Dozing, not failing. The sessions were healthy, and `error` would
    // expand the pill over a header the singer is trying to use.
    expect(h.last()).toEqual({ state: 'dozing', detail: undefined })
    expect(h.states.map((s) => s.state)).not.toContain('error')
    // The cold start announced itself once; the respawns did not.
    expect(h.states.filter((s) => s.state === 'starting')).toHaveLength(1)
  })

  it('wakes on the next touch, one session per touch', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    for (let i = 0; i < 3; i++) quietSession(h)
    expect(h.last().state).toBe('dozing')
    const settled = h.states.length

    window.dispatchEvent(new Event('pointerdown'))

    expect(FakeRecognition.instances).toHaveLength(4)
    // A continuation, not a cold start: nothing announced until it confirms.
    expect(h.states.slice(settled)).toEqual([])
    h.latest().confirm()
    expect(h.last().state).toBe('listening')

    // Still quiet: it ends, and it is back to waiting for a touch at once.
    h.latest().onend?.()
    vi.advanceTimersByTime(600_000)
    expect(FakeRecognition.instances).toHaveLength(4)
    expect(h.last().state).toBe('dozing')
  })

  it('never backs off or dozes where a respawn is silent', () => {
    // A pianist with both hands on the keys says "stop" after ten quiet
    // minutes. Desktop respawns are silent, so there is nothing to save by
    // waiting, and everything to lose: every quiet session comes back in
    // the same 300 ms as the first.
    const h = harness({ visibleRespawn: false })
    h.listener.start()
    for (let i = 0; i < 8; i++) quietSession(h)

    // Eight quiet sessions in, a ninth is already running: no doze, no fault.
    expect(h.states.map((s) => s.state)).not.toContain('dozing')
    expect(h.states.map((s) => s.state)).not.toContain('error')
    expect(FakeRecognition.instances).toHaveLength(9)

    // And the ninth quiet end still waits only 300 ms.
    h.latest().confirm()
    h.latest().onend?.()
    vi.advanceTimersByTime(299)
    expect(FakeRecognition.instances).toHaveLength(9)
    vi.advanceTimersByTime(1)
    expect(FakeRecognition.instances).toHaveLength(10)
  })

  it('forgets the quiet stretch the moment it hears something', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    for (let i = 0; i < 2; i++) quietSession(h)
    // Two in; a third quiet end would doze. Instead, a word.
    h.latest().confirm()
    h.latest().final('play')
    h.latest().onend?.()

    // Two quiet sessions, the one that heard, and its replacement — which
    // comes on the next task, not after a wait, so a second command given
    // straight after the first is not spoken into a dead gap.
    vi.advanceTimersByTime(0)
    expect(FakeRecognition.instances).toHaveLength(4)
    expect(h.last().state).not.toBe('dozing')

    // And the quiet stretch is forgotten: the next quiet end waits the
    // first, shortest delay again rather than the one it had reached.
    h.latest().confirm()
    h.latest().onend?.()
    vi.advanceTimersByTime(599)
    expect(FakeRecognition.instances).toHaveLength(4)
    vi.advanceTimersByTime(1)
    expect(FakeRecognition.instances).toHaveLength(5)
  })

  it('says it is paused rather than listening while it waits out a gap', () => {
    // The report: "he indicates he is listening, he doesn't listen", then it
    // comes back on its own after five to fifteen seconds. The pill kept the
    // `listening` it had from the last live session while the respawn timer
    // ran, so the gap looked like a mic that had stopped hearing the room.
    const h = harness({ visibleRespawn: true })
    h.listener.start()

    // First quiet end: a blink of a wait, not worth a word.
    quietSession(h)
    expect(h.last().state).toBe('listening')

    // The second wait is long enough to notice, so it is named.
    h.latest().confirm()
    h.latest().onend?.()
    expect(h.last()).toEqual({ state: 'dozing', detail: undefined })

    // And the session that follows says listening again on its own.
    vi.advanceTimersToNextTimer()
    h.latest().confirm()
    expect(h.last().state).toBe('listening')
  })

  it('does not announce a network hiccup', () => {
    // WebKit reports `network` often, and each one used to read "Mic
    // unavailable" and then "Loading voice engine" across the header before
    // the respawn quietly worked. It is `no-speech`-shaped: the end that
    // follows restarts the session, and that is all.
    const h = harness()
    h.listener.start()
    h.latest().confirm()
    const settled = h.states.length

    h.latest().onerror?.({ error: 'network' })
    h.latest().onend?.()
    vi.advanceTimersByTime(700)
    h.latest().confirm()

    expect(FakeRecognition.instances).toHaveLength(2)
    expect(h.states.slice(settled).map((s) => s.state)).toEqual(['listening'])
  })

  it('still says so when the microphone itself fails', () => {
    const h = harness()
    h.listener.start()
    h.latest().confirm()

    h.latest().onerror?.({ error: 'audio-capture' })

    expect(h.last()).toEqual({ state: 'error', detail: 'audio-capture' })
  })

  it('does not spend a keystroke in a text field on the recognizer', () => {
    // The gesture seam is bound to `keydown` as well as `pointerdown`, and
    // typing a song title into the search box was re-arming the capture on
    // every letter — once the ear had dozed, each keystroke was a bubble.
    FakeRecognition.startThrows = { name: 'NotAllowedError' }
    const h = harness()
    h.listener.start()
    FakeRecognition.startThrows = null
    const input = document.createElement('input')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.append(input, editable)

    input.dispatchEvent(new Event('keydown', { bubbles: true }))
    editable.dispatchEvent(new Event('keydown', { bubbles: true }))
    expect(FakeRecognition.instances).toHaveLength(1)

    // A key pressed anywhere else is still a touch.
    document.body.dispatchEvent(new Event('keydown', { bubbles: true }))
    expect(FakeRecognition.instances).toHaveLength(2)

    input.remove()
    editable.remove()
  })
})

// ============================================================
// A session that stops talking
// ============================================================
//
// `live` used to clear only on `end` or a discard, and WebKit takes sessions
// away without either — another app's capture, Siri, a call. The pill kept
// its pulsing ring over a recognizer that had stopped existing until
// something happened to fire `end`, and no touch could replace a session
// that still called itself live.

describe('a session that stops talking', () => {
  it('replaces a confirmed session that has been silent for 45 s, without a word', () => {
    const h = harness()
    h.listener.start()
    h.latest().confirm()
    const stale = h.latest()
    const settled = h.states.length

    vi.advanceTimersByTime(44_000)
    expect(FakeRecognition.instances).toHaveLength(1)
    // Any event at all is a sign of life and resets the clock.
    stale.onsoundstart?.()
    vi.advanceTimersByTime(44_000)
    expect(FakeRecognition.instances).toHaveLength(1)

    vi.advanceTimersByTime(2000)

    expect(stale.aborted).toBe(true)
    expect(FakeRecognition.instances).toHaveLength(2)
    // Silently: no `starting`, no `error`.
    expect(h.states.slice(settled)).toEqual([])
    h.latest().confirm()
    expect(h.last().state).toBe('listening')
  })

  it('lets a touch replace a session that has been silent for 10 s', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    h.latest().confirm()
    const session = h.latest()

    // Fresh, it is left alone — see "spends only one gesture".
    vi.advanceTimersByTime(5000)
    window.dispatchEvent(new Event('pointerdown'))
    expect(FakeRecognition.instances).toHaveLength(1)

    vi.advanceTimersByTime(6000)
    window.dispatchEvent(new Event('pointerdown'))

    expect(session.aborted).toBe(true)
    expect(FakeRecognition.instances).toHaveLength(2)
  })
})

describe('a microphone the user refused', () => {
  // The browser's `not-allowed` is not the iOS gesture refusal: no touch
  // can grant it, only the user in the browser's permission UI. Before
  // this, the listener kept the gesture seam armed and every tap anywhere
  // in the app respawned the recognizer — and with the controller turning
  // voice control off on each refusal, toasted on every tap.
  it('stands down for good and says so once', () => {
    const h = harness()
    h.listener.start()
    h.latest().confirm()
    h.latest().onerror?.({ error: 'not-allowed' })

    vi.advanceTimersByTime(60_000)
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('keydown'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(
      Object.assign(new Event('pageshow'), { persisted: true }),
    )
    vi.advanceTimersByTime(60_000)

    expect(FakeRecognition.instances).toHaveLength(1)
    expect(FakeRecognition.instances[0].aborted).toBe(true)
    expect(
      h.states.filter((s) => s.state === 'error' && s.detail === 'not-allowed'),
    ).toHaveLength(1)
    expect(h.last()).toEqual({ state: 'error', detail: 'not-allowed' })
  })

  it('does not respawn when the dead session reports its end', () => {
    const h = harness()
    h.listener.start()
    const first = h.latest()
    first.onerror?.({ error: 'not-allowed' })
    first.onend?.()
    vi.advanceTimersByTime(60_000)

    expect(FakeRecognition.instances).toHaveLength(1)
    expect(h.last()).toEqual({ state: 'error', detail: 'not-allowed' })
  })

  it('starts again only when asked to', () => {
    const h = harness()
    h.listener.start()
    h.latest().onerror?.({ error: 'service-not-allowed' })
    expect(FakeRecognition.instances).toHaveLength(1)

    h.listener.start()
    expect(FakeRecognition.instances).toHaveLength(2)
    expect(h.last()).toEqual({ state: 'starting', detail: undefined })
  })
})

describe('stopping means stopped', () => {
  it('lets go of the page so a later touch does not revive it', () => {
    FakeRecognition.startThrows = { name: 'NotAllowedError' }
    const h = harness()
    h.listener.start()
    h.listener.stop()

    FakeRecognition.startThrows = null
    window.dispatchEvent(new Event('pointerdown'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(
      Object.assign(new Event('pageshow'), { persisted: true }),
    )
    vi.advanceTimersByTime(60_000)

    expect(FakeRecognition.instances).toHaveLength(1)
    expect(h.last().state).toBe('idle')
  })

  it('drops the session it was holding', () => {
    const h = harness()
    h.listener.start()
    h.latest().confirm()
    const live = h.latest()

    h.listener.stop()

    expect(live.aborted).toBe(true)
    expect(h.last().state).toBe('idle')
  })

  it('does not let a dead session report anything after a stop', () => {
    const h = harness()
    h.listener.start()
    const first = h.latest()
    h.listener.stop()
    const statesAfter = h.states.length

    first.onend?.()
    first.final('play')

    expect(h.states).toHaveLength(statesAfter)
    expect(h.utterances).toEqual([])
  })
})

describe('what reaches the grammar', () => {
  it('drops a final the engine is not confident about', () => {
    const h = harness()
    h.listener.start()
    h.latest().confirm()

    h.latest().final('play', 0.1)
    h.latest().final('stop', 0.9)
    // Zero means "no estimate", not "no confidence" — Chrome reports it often.
    h.latest().final('next', 0)

    expect(h.utterances).toEqual(['stop', 'next'])
  })
})

describe('a browser with no recognizer at all', () => {
  it('reports unsupported rather than pretending', () => {
    vi.stubGlobal('SpeechRecognition', undefined)
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    const listener = createWebSpeechListener({
      onUtterance: () => {},
      onInterim: () => {},
      onStateChange: () => {},
    })

    expect(listener.isSupported).toBe(false)
    // And is inert, so a caller that ignores the flag cannot crash.
    expect(() => {
      listener.start()
      listener.stop()
    }).not.toThrow()
  })
})

describe('a session that goes silent without ending', () => {
  it('is replaced sooner where sessions are short-lived', () => {
    // WebKit drops a session under Siri, a call or another capture with no
    // `end` and no `error`, and `live` stays true over nothing: the pill
    // says listening and the room is not heard. On a phone, where a healthy
    // session ends after a few seconds of silence anyway, waiting 45 s to
    // notice is most of a minute of the pill lying.
    const phone = harness({ visibleRespawn: true })
    phone.listener.start()
    phone.latest().confirm()

    vi.advanceTimersByTime(11_999)
    expect(FakeRecognition.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeRecognition.instances).toHaveLength(2)
    phone.listener.stop()

    // Desktop keeps the longer window: Chrome's own sessions legitimately
    // sit quiet for the best part of a minute.
    FakeRecognition.instances = []
    const desktop = harness({ visibleRespawn: false })
    desktop.listener.start()
    desktop.latest().confirm()
    vi.advanceTimersByTime(12_000)
    expect(FakeRecognition.instances).toHaveLength(1)
    vi.advanceTimersByTime(33_000)
    expect(FakeRecognition.instances).toHaveLength(2)
  })
})

describe('what counts as a touch', () => {
  /** `QUIET_ROLLOVER_LIMIT` in the listener. */
  const QUIET_SESSIONS_BEFORE_DOZE = 3
  const quiet = (h: ReturnType<typeof harness>) => {
    h.latest().confirm()
    h.latest().onend?.()
    vi.advanceTimersToNextTimer()
  }
  const dozeOff = () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    for (let i = 0; i < QUIET_SESSIONS_BEFORE_DOZE; i++) quiet(h)
    expect(h.last().state).toBe('dozing')
    return h
  }

  it('does not spend a return to the foreground on a dozing ear', () => {
    // Locking and unlocking a dozing phone used to `start()` outside any
    // gesture, which iOS refuses, and the refusal expanded the pill over the
    // header as "needs a tap". Nothing was running, so nothing needed
    // replacing; the next touch wakes it as before.
    const h = dozeOff()
    const settled = h.states.length

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    const pageShow = new Event('pageshow') as Event & { persisted?: boolean }
    pageShow.persisted = true
    window.dispatchEvent(pageShow)

    expect(FakeRecognition.instances).toHaveLength(QUIET_SESSIONS_BEFORE_DOZE)
    expect(h.states.slice(settled)).toEqual([])
  })

  it('leaves a tap on the pill to the pill', () => {
    // The controller answers that tap on `click` — toggle, or open the menu.
    // Spending its `pointerdown` on a session first made the same tap turn
    // voice control off whenever the session confirmed before the click.
    dozeOff()
    const hud = document.createElement('div')
    hud.setAttribute('data-voice-control-hud', '')
    const button = document.createElement('button')
    hud.append(button)
    document.body.append(hud)

    button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(FakeRecognition.instances).toHaveLength(QUIET_SESSIONS_BEFORE_DOZE)

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(FakeRecognition.instances).toHaveLength(
      QUIET_SESSIONS_BEFORE_DOZE + 1,
    )
    hud.remove()
  })

  it('does not spend a tap in a text field either', () => {
    const h = dozeOff()
    const input = document.createElement('input')
    document.body.append(input)

    input.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(FakeRecognition.instances).toHaveLength(QUIET_SESSIONS_BEFORE_DOZE)
    expect(h.last().state).toBe('dozing')
    input.remove()
  })

  it('replaces a long-silent live session on a touch only where a respawn is visible', () => {
    // On a phone a session that has said nothing for ten seconds may be a
    // phantom, and the touch is the one moment iOS will take a fresh start.
    // On desktop the same click would abort a healthy session for nothing;
    // the stale timer covers the phantom there.
    const phone = harness({ visibleRespawn: true })
    phone.listener.start()
    phone.latest().confirm()
    vi.advanceTimersByTime(11_000)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(FakeRecognition.instances).toHaveLength(2)
    phone.listener.stop()

    FakeRecognition.instances = []
    const desktop = harness({ visibleRespawn: false })
    desktop.listener.start()
    desktop.latest().confirm()
    vi.advanceTimersByTime(11_000)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(FakeRecognition.instances).toHaveLength(1)
  })
})

// ── The record the device sends back ────────────────────────────
//
// The plan for VC-1 turns on one question: when the pill dimmed on that
// iPhone, was the recognizer dead, or was it the doze — the deliberate stop
// added the day before the retest? Nothing in the app could tell those apart
// from outside, which is why this recording exists. These tests are the
// promise that the log answers it, because a log that does not is worse than
// none: it looks like evidence.

describe('what the diagnostics record says happened', () => {
  const events = () => voiceDiagnosticEntries().map((entry) => entry.event)

  beforeEach(() => {
    resetVoiceDiagnosticsForTests()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    initVoiceDiagnostics('?voicelog=1')
  })

  afterEach(() => {
    resetVoiceDiagnosticsForTests()
  })

  const quietSession = (h: ReturnType<typeof harness>) => {
    h.latest().confirm()
    h.latest().onend?.()
    vi.advanceTimersToNextTimer()
  }

  it('names the doze, with the count that caused it', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    for (let i = 0; i < 3; i++) quietSession(h)

    // The single line that would settle VC-1 on a device. Without it the log
    // just stops, which is indistinguishable from the recognizer dying.
    expect(events()).toContain('doze')
    const doze = voiceDiagnosticEntries().find((e) => e.event === 'doze')
    expect(doze?.detail).toEqual({ quiet: 3, limit: 3 })
  })

  it('shows the ear alive and hearing nothing, rather than simply stopping', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    for (let i = 0; i < 3; i++) quietSession(h)

    // Three healthy sessions that each confirmed and ended without a word.
    // "Alive and quiet" reads straight off this; a dead recognizer would
    // show a spin-up with no start after it.
    expect(events().filter((e) => e === 'start')).toHaveLength(3)
    const ends = voiceDiagnosticEntries().filter((e) => e.event === 'end')
    expect(ends).toHaveLength(3)
    expect(ends.every((e) => e.detail.wasLive === true)).toBe(true)
    expect(ends.every((e) => e.detail.wasQuiet === true)).toBe(true)
  })

  it('separates a session from the one that replaced it', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    quietSession(h)

    // A phantom and its replacement being the same number is how a log like
    // this gets misread as one long healthy session, so every spin-up gets
    // its own, in order. (`start-requested` is session 0: it happens before
    // there is a session at all.)
    const spinUps = voiceDiagnosticEntries()
      .filter((entry) => entry.event === 'spin-up')
      .map((entry) => entry.session)
    expect(spinUps).toEqual([1, 2])
    expect(voiceDiagnosticEntries()[0]).toMatchObject({
      event: 'start-requested',
      session: 0,
    })
  })

  it('records the touch that woke it, so a recovery is not a mystery', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    for (let i = 0; i < 3; i++) quietSession(h)

    window.dispatchEvent(new Event('pointerdown'))

    // VC-3 — "it sometimes comes back on its own" — is this line, or it is
    // something we have never seen. Either answer is progress.
    expect(events()).toContain('gesture-wake')
  })

  it('records a refused start as a refusal, not as silence', () => {
    FakeRecognition.startThrows = { name: 'NotAllowedError' }
    const h = harness({ visibleRespawn: true })
    h.listener.start()

    const threw = voiceDiagnosticEntries().find(
      (entry) => entry.event === 'start-threw',
    )
    expect(threw?.detail.name).toBe('NotAllowedError')
    expect(events()).toContain('needs-gesture')
  })

  it('records a stillborn session, which is what a stolen mic looks like', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    // No confirm: the session never announces itself.
    vi.advanceTimersByTime(5000)

    expect(events()).toContain('stillborn')
    // And the app's own microphone at that moment, which is the other
    // consumer this failure shape blames.
    const stillborn = voiceDiagnosticEntries().find(
      (entry) => entry.event === 'stillborn',
    )
    expect(typeof stillborn?.env.mic).toBe('string')
  })

  it('never carries what the singer said', () => {
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    h.latest().confirm()
    h.latest().final('take me to the piano room')

    const text = JSON.stringify(voiceDiagnosticEntries())
    // The shape of a result is diagnostic. Its content is the user's speech,
    // and this log gets pasted into chat messages.
    expect(text).not.toContain('piano room')
    expect(events()).toContain('first-result')
  })

  it('costs nothing when nobody turned it on', () => {
    resetVoiceDiagnosticsForTests()
    // Explicitly off: the stored preference from this suite's beforeEach
    // outlives a reset, which is the whole point of remembering it.
    initVoiceDiagnostics('?voicelog=0')
    const h = harness({ visibleRespawn: true })
    h.listener.start()
    for (let i = 0; i < 3; i++) quietSession(h)

    expect(voiceDiagnosticEntries()).toHaveLength(0)
  })
})
