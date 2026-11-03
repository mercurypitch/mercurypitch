// ============================================================
// The demo's band: Josephine's lead-in, bundled and decoded once
// ============================================================
//
// The band the demo leads in on is a clip of the example's own band
// (demo-band-josephine.mp3): its first entry's `from` to its `at`, eight
// seconds, faded in and out as the song player fades its lead-ins (in
// 0.05 s, out over BAND_RELEASE_SECONDS). It ships inside the app, so a
// first visit plays it offline, and it is decoded once, off the room's
// clock, before the demo plays (the script's `ready`), so the demo starts it
// on the take's clock to the sample, where the countdown counts its beats.
//
// Read through the packaged-asset rule (mobile-runtime asset-fetch.ts): on
// iOS a bundled mp3 arrives with status 0.

import { fetchAssetBytes } from '@irchiinnuss/mobile-runtime/asset-fetch'
import { roomOutput } from '@/components/room-kit/room-output'
import bandClip from './demo-band-josephine.mp3'

/** The clip's own rate: it decodes at it, and the room's clock resamples. */
const CLIP_RATE = 44_100
/** A clip stopped early fades this fast, s: no click on Skip. */
const STOP_SECONDS = 0.06

/** Where the clip comes from and what decodes it (a test's own). */
export interface BandSource {
  readonly read: (url: string) => Promise<ArrayBuffer>
  /** A context that decodes without touching the room's audio, or none. */
  readonly decoder: () => BaseAudioContext | null
}

/** A context of its own to decode with, or none (no Web Audio here). */
function ownDecoder(): BaseAudioContext | null {
  const Offline = (
    globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }
  ).OfflineAudioContext
  if (typeof Offline !== 'function') return null
  try {
    return new Offline(1, 1, CLIP_RATE)
  } catch {
    return null
  }
}

const APP_SOURCE: BandSource = { read: fetchAssetBytes, decoder: ownDecoder }

let loading: Promise<AudioBuffer | null> | null = null
let decoded: AudioBuffer | null = null

/** The clip, once decoded; null before it has, or when it would not load. */
export function demoBand(): AudioBuffer | null {
  return decoded
}

/**
 * The clip, read and decoded once. A load that fails settles null and is
 * tried again the next time the demo asks.
 */
export function loadDemoBand(
  source: BandSource = APP_SOURCE,
): Promise<AudioBuffer | null> {
  if (decoded !== null) return Promise.resolve(decoded)
  if (loading !== null) return loading
  const pending = source
    .read(bandClip)
    .then((bytes) => {
      const ctx = source.decoder()
      if (ctx === null) throw new Error('No context to decode the band with')
      return ctx.decodeAudioData(bytes)
    })
    .then(
      (buffer) => {
        decoded = buffer
        return buffer
      },
      () => {
        loading = null
        return null
      },
    )
  loading = pending
  return pending
}

/** Forget the clip (the tests'). */
export function forgetDemoBand(): void {
  loading = null
  decoded = null
}

/** The clip from its start at `at` on `ctx`'s clock, through the room's output. */
export function playBand(
  ctx: AudioContext,
  band: AudioBuffer,
  at: number,
): { stop(): void } {
  const source = ctx.createBufferSource()
  source.buffer = band
  const gain = ctx.createGain()
  source.connect(gain)
  gain.connect(roomOutput(ctx))
  source.start(Math.max(ctx.currentTime, at))
  let stopped = false
  return {
    stop: () => {
      if (stopped) return
      stopped = true
      try {
        const now = ctx.currentTime
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(gain.gain.value, now)
        gain.gain.linearRampToValueAtTime(0, now + STOP_SECONDS)
        source.stop(now + STOP_SECONDS)
      } catch {
        // The context closed, or the clip had ended: nothing sounds.
      }
    },
  }
}
