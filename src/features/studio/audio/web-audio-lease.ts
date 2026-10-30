// Studio web lease — the Studio's own 48 kHz clock, made and started inside the press that plays, kept for every Play and closed when the Studio closes.
//
// The Studio used to borrow the app's engine context, which runs at the
// device's rate with the smallest buffers it allows ('interactive'). At
// 44.1 kHz every 48 kHz take was resampled as it played, and a busy mix had
// little room before the device ran dry. The Studio's own context runs at
// 48 kHz, the rate of its takes and its export, with 'playback' buffers. It
// is made inside the first press that plays, where WebKit lets audio start,
// after the session clip (unlockForPlayback), and every later Play and
// preview reuses it. The Studio never starts or stops the app's engine
// context. In the native app the host lends its context instead
// (useStudioTransport), and this lease is not made.
import type { AudioContextLease } from '@/lib/audio-context-lease'
import { unlockForPlayback } from '@/lib/audio-unlock'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'

export interface StudioWebLease extends AudioContextLease {
  /** The Studio closed: its context closes, and no press starts another. */
  close(): Promise<void>
}

/** 48 kHz with 'playback' buffers, or the device's own rate where 48 kHz is refused. */
export function createStudioAudioContext(
  make: (options: AudioContextOptions) => AudioContext = (options) =>
    new AudioContext(options),
): AudioContext {
  try {
    return make({ sampleRate: STUDIO_SAMPLE_RATE, latencyHint: 'playback' })
  } catch {
    return make({ latencyHint: 'playback' })
  }
}

export function createStudioWebLease(
  create: () => AudioContext = () => createStudioAudioContext(),
  unlock: (
    ensure: () => AudioContext | null,
  ) => AudioContext | null = unlockForPlayback,
): StudioWebLease {
  let context: AudioContext | null = null
  let closed = false
  return {
    ensure: () => context,
    get sampleRate() {
      return context?.sampleRate ?? STUDIO_SAMPLE_RATE
    },
    unlock() {
      if (closed) return Promise.resolve(false)
      let ctx: AudioContext | null
      try {
        // The session clip plays first, then the clock is made or resumed,
        // all before anything is awaited: the press must still be current.
        ctx = unlock(() => {
          if (context === null || context.state === 'closed') context = create()
          return context
        })
      } catch {
        return Promise.resolve(false)
      }
      if (!ctx) return Promise.resolve(false)
      const started = ctx
      if (started.state === 'running') return Promise.resolve(true)
      return started.resume().then(
        () => started.state === 'running',
        () => false,
      )
    },
    close() {
      closed = true
      const ctx = context
      context = null
      if (!ctx || ctx.state === 'closed') return Promise.resolve()
      return ctx.close().catch(() => undefined)
    },
  }
}
