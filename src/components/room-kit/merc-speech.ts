// ============================================================
// Merc's speech: a line said aloud in his voice, where he has it
// ============================================================
//
// Merc's lines show in his bubble (room-lines.ts). A line he has a
// recording of is said aloud as well: so far the three Ear rooms' lines at
// rest (their opening and result lines) and Echo's opening lines,
// ElevenLabs takes in his voice (the owner's ask, 1 Nov 2026: hear him on
// TestFlight), placeholders until real recordings come, as his sung set is
// (echo/merc-voice-set.ts). A line with a field in it (a note, a count) has
// no recording and stays silent. A room hands in its recordings by line
// id, and says a line by its id as its bubble shows it (speakingLines).
//
// The rules:
//   - He speaks only at rest: a room's opening line, as the room opens and
//     after a run is stopped, and its result, as a run ends. Never over the
//     band, his own singing or the singer's turn: a room's start hushes him
//     before the mic opens, and a sound the singer asks for at the result
//     (a key or a leap again) hushes him too.
//   - What he says is what the bubble shows. A new line takes over from the
//     one he is saying, and a line he has no recording of hushes him.
//   - A hush fades him out at once (HUSH_SECONDS). A line still loading
//     when he is hushed is never said.
//   - He speaks through the room's clock and stage, like everything else
//     the room plays (room-output.ts), but he never starts the clock: a
//     parked clock waits for the singer's tap, and a resume from anywhere
//     else would take the sound back from a call or another app
//     (packages/audio-io shared-audio-context.ts). He speaks on a clock
//     something else has running (useExerciseCapture's `runningAudio()`),
//     waiting a moment for it (CLOCK_WAIT_MS): a room opens a frame or more
//     after the tap that opened it, and the shell starts the clock on that
//     tap (premium-exercise-wiring.ts, startRoomClock). A run leaves it
//     running for the result. Where it is not running in time he says
//     nothing, and the bubble still shows the line.
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
import type { LineFieldsOf, RoomLines } from './room-lines'
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

/** How long a line waits for the room's clock to be running, ms. */
export const CLOCK_WAIT_MS = 1500

/** How often a waiting line looks at the clock, ms. */
const CLOCK_LOOK_MS = 50

/** The rate the recordings are decoded at, Hz: the phones' own. */
const DECODE_RATE = 48_000

/** A room's recordings: a line's id, and where its file is served. */
export type SpokenLines = Readonly<Record<string, string>>

export interface MercSpeechDeps {
  /**
   * The room's clock if something has it running, never started here
   * (useExerciseCapture's `runningAudio()`); null while it is not.
   */
  readonly clock: () => AudioContext | null
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
    /** The clock once it runs; null if he is hushed or it does not run in time. */
    const running = new Promise<AudioContext | null>((resolve) => {
      const look = (): void => {
        if (mine !== turn) return resolve(null)
        const ctx = deps.clock()
        if (ctx !== null && ctx.state === 'running') return resolve(ctx)
        if (since() >= CLOCK_WAIT_MS) return resolve(null)
        setTimeout(look, CLOCK_LOOK_MS)
      }
      look()
    })
    void running.then(async (ctx) => {
      if (mine !== turn) return
      const clockMs = since()
      if (ctx === null) {
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

/**
 * A room's `say`: the next line for a moment to its bubble (`show`), and
 * aloud when the room asks and Merc has it. Any other line hushes him, so
 * what he says is always what the bubble shows.
 */
export function speakingLines<M extends string, F extends LineFieldsOf<F>>(
  lines: RoomLines<M, F>,
  speech: MercSpeech,
  show: (text: string) => void,
): (moment: M, fields?: F, aloud?: boolean) => void {
  return (moment, fields, aloud = false) => {
    const said = lines.line(moment, fields)
    show(said.text)
    if (aloud) speech.say(said.id)
    else speech.hush()
  }
}
