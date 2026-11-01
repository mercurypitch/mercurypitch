// ============================================================
// Merc's speech: a line said aloud in his voice, where he has it
// ============================================================
//
// Merc's lines show in his bubble (room-lines.ts). A line he has a
// recording of is said aloud as well: so far the three Ear rooms' opening
// lines, ElevenLabs takes in his voice (the owner's ask, 1 Nov 2026: hear
// him on TestFlight), placeholders until real recordings come, as his sung
// set is (echo/merc-voice-set.ts). A room hands in its recordings by line
// id, and says a line by its id as its bubble shows it.
//
// The rules:
//   - He speaks only at rest: a room's opening line, as the room opens and
//     after a run is stopped. Never over the band, his own singing or the
//     singer's turn: a room's start hushes him before the mic opens.
//   - What he says is what the bubble shows. A new line takes over from the
//     one he is saying, and a line he has no recording of hushes him.
//   - A hush fades him out at once (HUSH_SECONDS). A line still loading
//     when he is hushed is never said.
//   - He speaks through the room's clock and stage, like everything else
//     the room plays (useExerciseCapture's `audio()`, room-output.ts). On a
//     phone that is the app's one AudioContext, which iOS starts only from
//     a tap. A room opens a frame or more after the tap that opened it, so
//     the shell starts the clock on that tap (premium-exercise-wiring.ts,
//     startRoomClock). Where the clock will not start he says nothing, and
//     the bubble still shows the line.
//   - A recording is read and decoded the first time he says it, and kept
//     while the room is open. It decodes on a context of its own, as his
//     sung set does (echo/merc-sampler.ts), while the clock starts: on the
//     room's clock it would wait behind whatever the room decodes there as
//     it opens, First note's song among them.
//   - In a build without the premium exercises every recording is an empty
//     URL (apps/mercurypitch/vite.config.ts, PREMIUM_VOICES), and he says
//     nothing.

import { fetchAssetRead } from '@irchiinnuss/mobile-runtime/asset-fetch'
import type { AudioReport } from '@/lib/audio-diagnostics'
import { audioReporter } from '@/lib/audio-diagnostics'
import { roomOutput } from './room-output'

/**
 * His spoken lines' level. The recordings are -18 LUFS, as his sung set
 * is, and play at the set's level (merc-sampler.ts SAMPLED_GAIN).
 */
export const SPEECH_GAIN = 0.8

/** A line starts this long after it is asked for, s: the room settles first. */
export const SPEECH_LEAD_SECONDS = 0.35

/** A hush takes him to silence over this long, s. */
export const HUSH_SECONDS = 0.08

/** The rate the recordings are decoded at, Hz: the phones' own. */
const DECODE_RATE = 48_000

/** A room's recordings: a line's id, and where its file is served. */
export type SpokenLines = Readonly<Record<string, string>>

export interface MercSpeechDeps {
  /**
   * The room's clock, running (useExerciseCapture's `audio()`); null where
   * it will not start.
   */
  readonly audio: () => Promise<AudioContext | null>
  /** A packaged file's bytes. */
  readonly read?: (url: string) => Promise<{ readonly bytes: ArrayBuffer }>
  /** A context to decode with, apart from the room's clock; null for none. */
  readonly decoder?: () => BaseAudioContext | null
  readonly report?: AudioReport
}

export interface MercSpeech {
  /** Say the line with this id aloud if he has it; else hush. */
  say(id: string): void
  /** Fade out what he is saying, and drop a line still loading. */
  hush(): void
  /** A line is sounding: from its start until it ends or is hushed. */
  speaking(): boolean
  /** Hush, and let the recordings go: the room is going. */
  dispose(): void
}

interface Sounding {
  readonly ctx: AudioContext
  readonly source: AudioBufferSourceNode
  readonly gain: GainNode
}

/** A context that decodes without touching the room's audio, or none. */
function ownDecoder(): BaseAudioContext | null {
  const Offline = (
    globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }
  ).OfflineAudioContext
  if (typeof Offline !== 'function') return null
  try {
    return new Offline(1, 1, DECODE_RATE)
  } catch {
    return null
  }
}

/** Merc's voice for a room's lines that have recordings. */
export function createMercSpeech(
  lines: SpokenLines,
  deps: MercSpeechDeps,
): MercSpeech {
  const read = deps.read ?? fetchAssetRead
  const decoder = deps.decoder ?? ownDecoder
  const report = deps.report ?? audioReporter('merc-speech')
  const decoded = new Map<string, Promise<AudioBuffer | null>>()
  /** Counts says and hushes, so a line that loads late is not said. */
  let turn = 0
  let disposed = false
  let sounding: Sounding | null = null

  const decode = (id: string, url: string): Promise<AudioBuffer | null> => {
    const known = decoded.get(url)
    if (known !== undefined) return known
    const pending = read(url)
      .then((file) => {
        const ctx = decoder()
        if (ctx === null) throw new Error('No context to decode with')
        return ctx.decodeAudioData(file.bytes)
      })
      .catch((error: unknown) => {
        // Tried again the next time he says it.
        decoded.delete(url)
        report(
          'load-failed',
          { id, error: error instanceof Error ? error.message : String(error) },
          true,
        )
        return null
      })
    decoded.set(url, pending)
    return pending
  }

  const fadeOut = (): void => {
    const line = sounding
    sounding = null
    if (line === null) return
    try {
      const t = line.ctx.currentTime
      line.gain.gain.cancelScheduledValues(t)
      line.gain.gain.setValueAtTime(line.gain.gain.value, t)
      line.gain.gain.setTargetAtTime(0, t, HUSH_SECONDS / 4)
      line.source.stop(t + HUSH_SECONDS)
    } catch {
      // The context closed, or the line had ended: nothing sounds.
    }
  }

  const hush = (): void => {
    turn += 1
    fadeOut()
  }

  /** How long a line waited for the clock, and in all, ms: for the device's log. */
  interface Waited {
    readonly clockMs: number
    readonly readyMs: number
  }

  const speak = (
    ctx: AudioContext,
    id: string,
    buffer: AudioBuffer,
    waited: Waited,
  ): void => {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = SPEECH_GAIN
    source.connect(gain)
    gain.connect(roomOutput(ctx))
    const line: Sounding = { ctx, source, gain }
    // Nothing of the line stays in the graph once it has ended.
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      if (sounding === line) sounding = null
    }
    source.start(ctx.currentTime + SPEECH_LEAD_SECONDS)
    sounding = line
    report('said', {
      id,
      seconds: Math.round(buffer.duration * 100) / 100,
      ...waited,
    })
  }

  const say = (id: string): void => {
    hush()
    const url = Object.hasOwn(lines, id) ? lines[id] : ''
    if (disposed || url === '') return
    const mine = turn
    const asked = performance.now()
    const since = (): number => Math.round(performance.now() - asked)
    // The recording decodes while the clock starts.
    const recording = decode(id, url)
    void deps.audio().then(async (ctx) => {
      if (mine !== turn) return
      const clockMs = since()
      // A clock that did not start would hold the line and play it the
      // next time it runs: on the singer's next tap, over the mic.
      if (ctx === null || ctx.state !== 'running') {
        report('no-clock', { id })
        return
      }
      const buffer = await recording
      if (buffer !== null && mine === turn) {
        speak(ctx, id, buffer, { clockMs, readyMs: since() })
      }
    })
  }

  return {
    say,
    hush,
    speaking: () => sounding !== null,
    dispose: () => {
      disposed = true
      hush()
      decoded.clear()
    },
  }
}
