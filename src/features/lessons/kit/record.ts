// ============================================================
// Lesson recording — a sung take, kept in memory to be played back
// ============================================================
//
// The first lesson code that keeps audio (Lesson 14's Sing it, its WEB-SPEC,
// Toys 4): each take is recorded on the device so the singer can play it
// back, and nothing more. It runs over the app's own recorder
// (src/lib/voice-capture.ts), which wraps MediaRecorder over a stream the
// page already holds, never calls getUserMedia and never sends the audio
// away: here the listener's own stream (kit/listen.ts `Listener.media`),
// the mic manager's analysis stream, opened with the browser's echo
// cancellation, noise suppression and automatic gain off, so the swell
// recorded is the swell sung. A browser with none of the recorder's formats
// records nothing (`canRecord`), and its takes are drawn and not recorded.
//
// A take's recording is decoded on the page's one AudioContext into an
// AudioBuffer and kept beside its line on the page's shelf (`TakeShelf`),
// in memory only: no storage, no IndexedDB, no Cache, no network and no
// analytics (REQ-GVC-003, REQ-GVC-090). It goes on Delete, when a new take
// takes its place, and when the page is left, with the page (REQ-GVC-004).
//
// Playback plays the buffer once, from 0.2 s before the take's first voiced
// frame unless the seek bar has moved, through the page's one "now playing"
// owner (kit/now-playing.ts), so another sound stops it and it stops any
// other; every sound stopping (the Sound switch off, a hidden tab) stops it
// too. It applies one gain to the whole take, which takes the take's peak
// to one level, the same for every take, and never changes during it; it
// goes straight to the speakers, past the master bus's compressor
// (kit/sound.ts) and through no automatic gain, so a swell keeps its shape.

import type { TakeRecorder } from '@/lib/voice-capture'
import { createTakeRecorder, pickRecorderMime } from '@/lib/voice-capture'
import type { SoundOwner } from './now-playing'
import { onStopAll, Sound } from './sound'

export type { TakeRecorder }

/** Seconds of the take played before its first voiced frame. */
export const LEAD_IN_SEC = 0.2

/** The level every take's peak plays at: one gain for the whole take. */
export const PLAYBACK_PEAK = 0.5

/** A take quieter than this peak is lifted no further, so a near-silent one is never blown up into noise. */
const QUIET_FLOOR = 0.01

/** Whether this browser can record a take at all: MediaRecorder and one of the app's formats. */
export const canRecord = (): boolean => pickRecorderMime() !== null

/** A recorder over the stream the page already holds; null where the browser can't record. */
export function recorderFor(media: MediaStream): TakeRecorder | null {
  return createTakeRecorder(media)
}

/** A take as the page keeps it: its audio, its one gain, and where its voice starts. */
export interface KeptTake {
  readonly buffer: AudioBuffer
  /** The one gain the whole take plays through. */
  readonly gain: number
  /** Seconds into the recording of the take's first voiced frame. */
  readonly voicedAt: number
  /** Seconds the recording lasts. */
  readonly length: number
}

/** The largest sample, either sign, over every channel. */
export function peakOf(buffer: AudioBuffer): number {
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++)
      peak = Math.max(peak, Math.abs(data[i]))
  }
  return peak
}

/** The one gain that takes a buffer's peak to `PLAYBACK_PEAK`. */
export const gainFor = (buffer: AudioBuffer): number =>
  PLAYBACK_PEAK / Math.max(peakOf(buffer), QUIET_FLOOR)

/**
 * A recorded take, decoded on `context` and kept with its gain; null where
 * nothing was captured or it will not decode, so the take is drawn and not
 * recorded.
 */
export async function keepTake(
  blob: Blob | null,
  context: AudioContext,
  voicedAt: number,
): Promise<KeptTake | null> {
  if (blob === null) return null
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer())
    return {
      buffer,
      gain: gainFor(buffer),
      voicedAt,
      length: buffer.duration,
    }
  } catch {
    return null
  }
}

/** Where a take's playback starts by default: 0.2 s before its voice. */
export const startOf = (t: KeptTake): number =>
  Math.max(0, t.voicedAt - LEAD_IN_SEC)

/** The page's two takes, in memory only, by their number. */
export class TakeShelf {
  private readonly takes = new Map<number, KeptTake>()

  get(n: number): KeptTake | null {
    return this.takes.get(n) ?? null
  }

  /** Keeps `t` as take `n`, in place of any take `n` before it (Again's new take 2). */
  set(n: number, t: KeptTake): void {
    this.takes.set(n, t)
  }

  /** Delete: every take goes. */
  clear(): void {
    this.takes.clear()
  }

  get size(): number {
    return this.takes.size
  }
}

/** A take playing: `done` is true when it played to its end, false when stopped. */
export interface Playback {
  readonly done: Promise<boolean>
  /**
   * Seconds into the recording now; once over, where it stopped, or the
   * take's end when it played to it, so a seek bar stays where the sound
   * left off.
   */
  position(): number
  stop(): void
}

// The take playing now, stopped when every sound stops (the Sound switch
// off, a hidden tab), as the kit's runs are.
let playing: Playback | null = null
onStopAll(() => {
  playing?.stop()
})

/**
 * Plays `take` once from `from` seconds into its recording, through its one
 * gain straight to the speakers, after `owner` stops whatever sounded
 * before. Null with the sound off or a take open, when nothing may sound.
 */
export function playTake(
  take: KeptTake,
  context: AudioContext,
  owner: SoundOwner,
  from: number = startOf(take),
): Playback | null {
  if (Sound.state !== 'on' || Sound.hushed) return null
  if (context.state === 'suspended')
    void context.resume().catch(() => undefined)
  const source = context.createBufferSource()
  source.buffer = take.buffer
  const level = context.createGain()
  level.gain.value = take.gain
  source.connect(level)
  level.connect(context.destination)
  const at = Math.min(Math.max(0, from), take.length)
  const t0 = context.currentTime
  let over = false
  let reached = at
  const now = (): number => Math.min(take.length, at + context.currentTime - t0)
  let settle: (heard: boolean) => void = () => undefined
  const done = new Promise<boolean>((resolve) => {
    settle = resolve
  })
  const end = (heard: boolean): void => {
    if (over) return
    over = true
    reached = heard ? take.length : now()
    if (playing === playback) playing = null
    owner.release(stop)
    settle(heard)
  }
  const stop = (): void => {
    if (over) return
    // ended before the source says so, so its `onended` finds it over
    end(false)
    try {
      source.stop()
    } catch {
      // not started, or already stopped
    }
  }
  const playback: Playback = {
    done,
    position: () => (over ? reached : now()),
    stop,
  }
  owner.claim(stop)
  source.onended = () => end(true)
  source.start(t0, at)
  playing = playback
  return playback
}
