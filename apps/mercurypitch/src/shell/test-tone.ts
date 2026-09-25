// ============================================================
// The Audio panel's test tone: one second of A4, on its own context
// ============================================================
//
// Its own context, started through the same activation as the alley's
// ambient (`activateAudioPlayback`: the resume inside the tap, and the silent
// clip that moves iOS off the session the ring switch mutes). A tone that
// sounds beside an ambient that does not puts the fault in the ambient's
// path; silence from both puts it in the session or the route.
//
// The house envelope (an exponential attack from the floor, a
// `setTargetAtTime` release a fifth of its length, the source stopped after
// the release plus slack), and every step reported as source 'tone'. The
// 'stopped' entry says how far the clock advanced while it played: 0 is a
// context that never ran, which is a tone nobody heard.

import type { AudioReport } from '@/lib/audio-diagnostics'
import { audioReporter } from '@/lib/audio-diagnostics'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import { GAIN_FLOOR, RELEASE_SLACK_MS } from '../alley/alley-audio'

export const TONE_HZ = 440
export const TONE_MS = 1000
const TONE_LEVEL = 0.25
const TONE_ATTACK_S = 0.02
const TONE_RELEASE_S = 0.15

type ContextCtor = typeof AudioContext

function contextCtor(): ContextCtor | undefined {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: ContextCtor })
      .webkitAudioContext
  )
}

/** Sound a context the activation resumed, then close it. */
function sound(context: AudioContext, report: AudioReport, done: () => void) {
  const now = context.currentTime
  if (context.state !== 'running') {
    report(
      'stale',
      { reason: 'not running after resume', state: context.state },
      true,
    )
  }
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = TONE_HZ
  gain.gain.setValueAtTime(GAIN_FLOOR, now)
  gain.gain.exponentialRampToValueAtTime(TONE_LEVEL, now + TONE_ATTACK_S)
  const releaseAt = now + TONE_MS / 1000 - TONE_RELEASE_S
  gain.gain.setTargetAtTime(0, releaseAt, TONE_RELEASE_S / 5)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  report('started', {
    frequency: TONE_HZ,
    state: context.state,
    currentTime: now,
  })
  window.setTimeout(() => {
    oscillator.stop()
    oscillator.disconnect()
    gain.disconnect()
    report('stopped', {
      state: context.state,
      advanced: context.currentTime - now,
    })
    void context.close().catch(() => {})
    done()
  }, TONE_MS + RELEASE_SLACK_MS)
}

/** Play the tone. Call from inside the tap; `done` runs once it is over. */
export function playTestTone(done: () => void): void {
  const report = audioReporter('tone')
  const Ctor = contextCtor()
  if (Ctor === undefined) {
    report('context-failed', { error: 'no AudioContext on this page' }, true)
    done()
    return
  }
  let context: AudioContext | null = null
  const fail = (event: string, error: unknown): void => {
    report(event, { error }, true)
    void context?.close().catch(() => {})
    done()
  }
  void activateAudioPlayback({
    getAudioContext: () => context,
    init: () => {
      context = new Ctor()
      report('context', {
        state: context.state,
        sampleRate: context.sampleRate,
      })
      return Promise.resolve()
    },
    resume: () => context?.resume() ?? Promise.resolve(),
  }).then(
    () => {
      if (context === null) return done()
      report('activated', { state: context.state })
      try {
        sound(context, report, done)
      } catch (error) {
        fail('start-failed', error)
      }
    },
    (error: unknown) =>
      fail(context === null ? 'context-failed' : 'activation-failed', error),
  )
}
