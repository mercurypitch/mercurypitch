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

function harness() {
  const states: Array<{ state: VoiceListenerState; detail?: string }> = []
  const utterances: string[] = []
  const listener = createWebSpeechListener({
    onUtterance: (text) => utterances.push(text),
    onInterim: () => {},
    onStateChange: (state, detail) => states.push({ state, detail }),
  })
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

  it('carries on when start() only says a session is already running', () => {
    FakeRecognition.startThrows = { name: 'InvalidStateError' }
    const h = harness()
    h.listener.start()

    // Not an error: something is running, it just was not us that started it.
    expect(h.last().state).toBe('starting')
    h.latest().confirm()
    expect(h.last().state).toBe('listening')
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

  it('respawns a session that ends while it is meant to be listening', () => {
    const h = harness()
    h.listener.start()
    h.latest().confirm()

    h.latest().onend?.()
    expect(FakeRecognition.instances).toHaveLength(1)
    vi.advanceTimersByTime(400)

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

describe('stopping means stopped', () => {
  it('lets go of the page so a later touch does not revive it', () => {
    FakeRecognition.startThrows = { name: 'NotAllowedError' }
    const h = harness()
    h.listener.start()
    h.listener.stop()

    FakeRecognition.startThrows = null
    window.dispatchEvent(new Event('pointerdown'))
    document.dispatchEvent(new Event('visibilitychange'))
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
