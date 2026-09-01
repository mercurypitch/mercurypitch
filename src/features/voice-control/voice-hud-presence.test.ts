// ============================================================
// The voice pill knows when it has stopped talking
// ============================================================
//
// Expanded, the pill is a wide bar. Docked in a phone's header it ran across
// the app's own title and stayed there for the whole session — for the one
// second in ten that it had words, and the nine that it did not. This is the
// rule that says which of those it is in, and the app header reads the same
// answer to decide whether to keep its title.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceListenerState } from './types'
import { createHasSomethingToSay, VOICE_QUIET_HOLD_MS, } from './voice-hud-presence'

interface Harness {
  hasSomethingToSay: () => boolean
  setEnabled: (v: boolean) => void
  setInterim: (v: string) => void
  setFeedback: (v: unknown) => void
  setListenerState: (v: VoiceListenerState) => void
  setSuspended: (v: boolean) => void
  dispose: () => void
}

/** Enabled and listening with nothing heard yet — the quiet steady state. */
function harness(): Harness {
  let out: Harness | null = null
  createRoot((dispose) => {
    const [enabled, setEnabled] = createSignal(true)
    const [interim, setInterim] = createSignal('')
    const [feedback, setFeedback] = createSignal<unknown>(null)
    const [listenerState, setListenerState] =
      createSignal<VoiceListenerState>('listening')
    const [suspended, setSuspended] = createSignal(false)
    const hasSomethingToSay = createHasSomethingToSay({
      enabled,
      interim,
      feedback,
      listenerState,
      suspended,
    })
    out = {
      hasSomethingToSay,
      setEnabled,
      setInterim,
      setFeedback,
      setListenerState,
      setSuspended,
      dispose,
    }
  })
  if (out === null) throw new Error('harness did not build')
  return out
}

describe('the voice pill knows when it has stopped talking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is quiet while the listener waits with nothing heard', () => {
    const h = harness()
    vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS + 100)
    expect(h.hasSomethingToSay()).toBe(false)
    h.dispose()
  })

  it('speaks up the moment a phrase starts', () => {
    const h = harness()
    vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS + 100)

    h.setInterim('go to karaoke')

    expect(h.hasSomethingToSay()).toBe(true)
    h.dispose()
  })

  it('holds the words for a beat after the phrase ends', () => {
    const h = harness()
    h.setInterim('go to karaoke')
    h.setInterim('')

    // The pause between two halves of a sentence must not collapse the pill
    // out from under the first half.
    vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS - 200)
    expect(h.hasSomethingToSay()).toBe(true)

    vi.advanceTimersByTime(400)
    expect(h.hasSomethingToSay()).toBe(false)
    h.dispose()
  })

  it('restarts the hold when the next words arrive inside it', () => {
    const h = harness()
    h.setInterim('go to')
    h.setInterim('')
    vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS - 500)

    h.setInterim('karaoke night')
    h.setInterim('')

    // A hold that had already been counting must not expire early on the
    // second phrase's clock.
    vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS - 500)
    expect(h.hasSomethingToSay()).toBe(true)
    vi.advanceTimersByTime(700)
    expect(h.hasSomethingToSay()).toBe(false)
    h.dispose()
  })

  it('keeps a verdict on screen while it stands', () => {
    const h = harness()
    h.setFeedback({ kind: 'matched', heard: 'go to karaoke' })

    vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS * 3)

    // `feedback` clears itself upstream; until it does, the words stay.
    expect(h.hasSomethingToSay()).toBe(true)
    h.dispose()
  })

  it.each<VoiceListenerState>(['idle', 'starting', 'error'])(
    'stays open on the %s state, which has a sentence and a way out',
    (state) => {
      const h = harness()
      h.setListenerState(state)

      vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS * 3)

      // These states read "Loading voice engine", "Mic unavailable" and
      // "tap the mic to restart". Collapsing over them would hide both the
      // reason and the only control that answers it.
      expect(h.hasSomethingToSay()).toBe(true)
      h.dispose()
    },
  )

  it('collapses at once when voice control is switched off', () => {
    const h = harness()
    h.setInterim('go to karaoke')
    expect(h.hasSomethingToSay()).toBe(true)

    h.setEnabled(false)

    // No hold: switching it off is a decision, and the header takes its
    // title back on the same frame rather than three seconds later.
    expect(h.hasSomethingToSay()).toBe(false)
    h.dispose()
  })

  it('drops its pending timer when the owner goes away', () => {
    const h = harness()
    h.setInterim('go to karaoke')
    h.setInterim('')
    h.dispose()

    // The timer fires into a disposed root otherwise; nothing should throw
    // and nothing should be written.
    expect(() => {
      vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS * 2)
    }).not.toThrow()
    expect(h.hasSomethingToSay()).toBe(true)
  })

  it('collapses over the pause that holds the mic for a singing voice', () => {
    // The stage mic taking the audio sets the listener to `idle`, which is
    // otherwise a talking state — and it stays that way for the length of the
    // song. Expanded, that was a bar across the header saying "Voice stopped
    // — tap the mic to restart" over a mic nothing was wrong with, offering a
    // tap that did nothing.
    const h = harness()
    h.setListenerState('idle')
    h.setSuspended(true)

    vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS + 100)

    expect(h.hasSomethingToSay()).toBe(false)
    h.dispose()
  })

  it('speaks up again the moment the pause ends badly', () => {
    // Coming back from a pause is a fresh `start()` with no gesture behind
    // it, which iOS refuses — and that one the singer does have to see.
    const h = harness()
    h.setListenerState('idle')
    h.setSuspended(true)
    vi.advanceTimersByTime(VOICE_QUIET_HOLD_MS + 100)

    h.setSuspended(false)
    h.setListenerState('error')

    expect(h.hasSomethingToSay()).toBe(true)
    h.dispose()
  })

  it('still shows a phrase heard during the pause', () => {
    const h = harness()
    h.setSuspended(true)
    h.setInterim('next song')

    expect(h.hasSomethingToSay()).toBe(true)
    h.dispose()
  })
})
