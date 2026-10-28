// ============================================================
// Merc's sampled call: his recorded "ooh" behind the CallVoice seam
// ============================================================
//
// The owner chose "Merc with vibrato" for Echo's calls (13 Oct 2026,
// decision V1). This sings them from his voice set (merc-voice-set.ts):
// each note on the nearest sample, shifted by its playback rate, held for
// the note and joined to the next one sung straight on. The seam
// (merc-call.ts) is unchanged, so the room and its demo do not know which
// voice sings.
//
// The set loads when the singer enters Echo, never at app start, and is
// decoded once for the session. Until it has loaded, or if any note of it
// fails to load or decode, the call goes to the synth "ooh" (SYNTH_CALL):
// a call is never silent, and never half one voice and half the other.
// A call with a note the set does not reach (D#2 to G5) goes to the synth
// too, at its own pitch. The call's octave is not folded: below the
// Beginner level the singer is judged on the octave Merc sang.
//
// How a note is played, with the set's own timing (its manifest), so that
// its pitch is heard on the note's onset, where the rings appear. Measured
// with the production detector on Chromium's render (PR notes, 14 Oct):
//
//   - Sung straight on from the last note, it starts at the sample's attack,
//     early by the attack's length (40 ms of sample, less on the clock when
//     played faster), so the held note lands on the onset. The last note
//     fades from 10 ms before that onset, out in 40 ms: the voice moves to
//     the next note as the synth's glides do, in the last moments of the
//     note, and the pitch arrives within 10 ms of the onset (the audition
//     clip's own timing heard it 22-46 ms late). This takes the place of the
//     synth's legato.
//   - After silence (the first note, or one after a rest) the attack is
//     itself what is heard: it starts 5 ms of sample early. Started 40 ms
//     early it was heard 22-46 ms before its onset.
//   - Before a rest, or at the end, a note closes on the house release.
//   - Each note grows its vibrato from its own attack, as the samples were
//     made and as the owner's audition clip plays them. The synth grows it
//     once per phrase; the samples cannot: skipping a later note's first
//     0.35 s leaves too little held note for a 0.9 s Beginner note.
//
// Some decoders keep the MP3 encoder's priming silence at the start of a
// decoded file (Chromium and ffmpeg drop it, so it is measured there as
// none). The loader finds each file's attack in the decoded audio and
// moves that file's timing by the silence it finds, so the onsets hold.

import { fetchAssetRead } from '@irchiinnuss/mobile-runtime/asset-fetch'
import { roomOutput } from '@/components/room-kit/room-output'
import type { AudioReport } from '@/lib/audio-diagnostics'
import { audioReporter } from '@/lib/audio-diagnostics'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type { CallVoice } from './merc-call'
import { callTimes, SYNTH_CALL } from './merc-call'
import type { VoiceSample } from './merc-voice-set'
import { MERC_SAMPLES, SAMPLE_ONSET, SAMPLE_SUSTAIN_END, SAMPLE_SUSTAIN_START, sampleFor, } from './merc-voice-set'

/**
 * The sampled voice's level before each sample's own (VoiceSample.levelDb):
 * the synth's held level (phrase-voice.ts), as the set was auditioned.
 */
export const SAMPLED_GAIN = 0.8
/** The house envelope (demo-voice.ts): release and the slack after it, s. */
const RELEASE = 0.18
const STOP_SLACK = 0.06
/** A note opens from the floor over this long, under the sample's attack. */
const OPEN = 0.01
/** After silence, the attack starts this far ahead of the onset, s of sample. */
const LEAD_FROM_SILENCE = 0.005
/** Into the next note: the last note starts to fade this long before it, s. */
const CROSSFADE_BEFORE = 0.01
/** ...and is gone in this long (five time constants), s. */
const CROSSFADE = 0.04
const FLOOR = 0.0001
/** Notes this close are sung straight on (phrase-voice.ts). */
const EPS = 1e-6

/** Where a sample's attack reads in a decode that keeps no priming, s. */
const REFERENCE_ATTACK = 0.021
/** Below this, an attack's place is the file's own variation, not priming. */
const PRIMING_TOLERANCE = 0.005
/** The attack starts where the file first reaches 60 dB under its peak. */
const ATTACK_FLOOR = 1e-3
/** The files' own rate: a decode at it changes nothing. */
const DECODE_RATE = 48_000

/** Why a call went to the synth. */
export type SynthReason = 'loading' | 'out-of-reach' | 'too-long'

/** One note of a sampled call, on the audio clock. */
export interface PlannedNote {
  readonly sampleMidi: number
  readonly rate: number
  /** Its held level over SAMPLED_GAIN, linear (the sample's levelDb). */
  readonly level: number
  /** When its source starts. */
  readonly startAt: number
  /** Where in the sample it starts, s of sample (before any priming). */
  readonly offset: number
  /** When it starts to fade: into the next note, or its own release. */
  readonly fadeAt: number
  /** The fade's time constant (setTargetAtTime). */
  readonly fadeTau: number
  /** When its source stops: the fade has died away. */
  readonly stopAt: number
}

export type SampledPlan =
  | { readonly ok: true; readonly notes: readonly PlannedNote[] }
  | { readonly ok: false; readonly reason: Exclude<SynthReason, 'loading'> }

/** Two notes sung straight on: the second starts as the first ends. */
function joined(first: PhraseNote, second: PhraseNote): boolean {
  return second.at <= first.at + first.seconds + EPS
}

/**
 * The call through the set, or why the set cannot sing it. `now` is the
 * audio clock: a note due to start before it starts now, further in.
 */
export function planSampledCall(
  notes: readonly PhraseNote[],
  startAt: number,
  now: number,
): SampledPlan {
  const picks = notes.map((note) => sampleFor(note.midi))
  const placed: { sampleMidi: number; rate: number; level: number }[] = []
  for (const [i, pick] of picks.entries()) {
    if (pick === null) return { ok: false, reason: 'out-of-reach' }
    // The note's end has to fall inside the held part of the sample.
    const reached = SAMPLE_SUSTAIN_START + notes[i].seconds * pick.rate
    if (reached > SAMPLE_SUSTAIN_END + EPS)
      return { ok: false, reason: 'too-long' }
    placed.push({
      sampleMidi: pick.sample.midi,
      rate: pick.rate,
      level: 10 ** (pick.sample.levelDb / 20),
    })
  }
  const planned = notes.map((note, i): PlannedNote => {
    const { sampleMidi, rate, level } = placed[i]
    const onset = startAt + note.at
    const end = onset + note.seconds
    const previous = notes[i - 1]
    // In sample time: the whole attack after a note, a moment of it after silence.
    const lead =
      previous !== undefined && joined(previous, note)
        ? SAMPLE_SUSTAIN_START - SAMPLE_ONSET
        : LEAD_FROM_SILENCE
    let start = onset - lead / rate
    let offset = SAMPLE_ONSET
    if (start < now) {
      offset += (now - start) * rate
      start = now
    }
    const next = notes[i + 1]
    if (next !== undefined && joined(note, next)) {
      // Straight on: out as the next note's held pitch arrives.
      const fadeAt = Math.max(
        start + OPEN,
        startAt + next.at - CROSSFADE_BEFORE,
      )
      const fadeTau = CROSSFADE / 5
      return {
        sampleMidi,
        rate,
        level,
        startAt: start,
        offset,
        fadeAt,
        fadeTau,
        stopAt: fadeAt + CROSSFADE + STOP_SLACK,
      }
    }
    return {
      sampleMidi,
      rate,
      level,
      startAt: start,
      offset,
      fadeAt: end,
      fadeTau: RELEASE / 5,
      stopAt: end + RELEASE + STOP_SLACK,
    }
  })
  return { ok: true, notes: planned }
}

/** The set as decoded: a buffer per sample, and its priming silence, s. */
export interface LoadedVoice {
  readonly buffers: ReadonlyMap<number, AudioBuffer>
  readonly priming: ReadonlyMap<number, number>
}

/** Where a decoded sample's attack starts, s. */
export function attackStart(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0)
  let peak = 0
  for (const value of data) peak = Math.max(peak, Math.abs(value))
  const floor = peak * ATTACK_FLOOR
  const index = data.findIndex((value) => Math.abs(value) > floor)
  return Math.max(0, index) / buffer.sampleRate
}

/** The priming silence a decoder left before the attack, s; 0 for none. */
export function primingOf(buffer: AudioBuffer): number {
  const late = attackStart(buffer) - REFERENCE_ATTACK
  return late < PRIMING_TOLERANCE ? 0 : late
}

export interface VoiceLoaderDeps {
  /** A packaged file's bytes, and the status they came with. */
  readonly read: (
    url: string,
  ) => Promise<{ bytes: ArrayBuffer; status: number }>
  /** A context to decode with; null where there is none. */
  readonly decoder: () => BaseAudioContext | null
  readonly report: AudioReport
}

export interface VoiceLoader {
  /** Load and decode the set, once; null if it cannot be had. */
  load: () => Promise<LoadedVoice | null>
  /** The set, if it has loaded. */
  loaded: () => LoadedVoice | null
}

/**
 * Loads a voice set once: every file read and decoded, or none kept. A
 * failed load is tried again on the next `load`, the next time the singer
 * comes into the room.
 */
export function createVoiceLoader(
  samples: readonly VoiceSample[],
  deps: VoiceLoaderDeps,
): VoiceLoader {
  let voice: LoadedVoice | null = null
  let pending: Promise<LoadedVoice | null> | null = null

  const loadAll = async (): Promise<LoadedVoice | null> => {
    if (samples.some((sample) => sample.url === '')) {
      deps.report('unavailable', { reason: 'not in this build' })
      return null
    }
    const decoder = deps.decoder()
    if (decoder === null) {
      deps.report('unavailable', { reason: 'no decoder' }, true)
      return null
    }
    try {
      const decoded = await Promise.all(
        samples.map(async (sample) => {
          const read = await deps.read(sample.url)
          const bytes = read.bytes.byteLength
          const buffer = await decoder.decodeAudioData(read.bytes)
          return { sample, buffer, bytes, status: read.status }
        }),
      )
      const buffers = new Map<number, AudioBuffer>()
      const priming = new Map<number, number>()
      for (const { sample, buffer } of decoded) {
        buffers.set(sample.midi, buffer)
        priming.set(sample.midi, primingOf(buffer))
      }
      deps.report('decoded', {
        notes: decoded.length,
        bytes: decoded.reduce((sum, entry) => sum + entry.bytes, 0),
        status: decoded[0]?.status,
        rate: decoded[0]?.buffer.sampleRate,
        seconds: decoded[0]?.buffer.duration,
        primingMs: Math.round(Math.max(0, ...priming.values()) * 1000),
      })
      voice = { buffers, priming }
      return voice
    } catch (error) {
      deps.report(
        'load-failed',
        { error: error instanceof Error ? error.message : String(error) },
        true,
      )
      return null
    }
  }

  return {
    load: () => {
      if (voice !== null) return Promise.resolve(voice)
      pending ??= loadAll().then((result) => {
        pending = null
        return result
      })
      return pending
    },
    loaded: () => voice,
  }
}

/**
 * A CallVoice that sings from `loaded()`'s set, and hands a call to
 * `fallback` while there is none or when the set cannot sing it.
 */
export function samplerCall(
  loaded: () => LoadedVoice | null,
  fallback: CallVoice,
  report: AudioReport = () => undefined,
  gain = SAMPLED_GAIN,
): CallVoice {
  // Which voice sang the last call: reported when it changes, not per call.
  let last = ''
  const said = (voice: string, detail: Record<string, unknown>): void => {
    if (voice === last) return
    last = voice
    report('call', detail)
  }
  return {
    sing(ctx, notes, startAt) {
      const times = callTimes(notes, startAt)
      if (notes.length === 0) return { ...times, stop: () => undefined }
      const voice = loaded()
      const plan: SampledPlan | null =
        voice === null ? null : planSampledCall(notes, startAt, ctx.currentTime)
      if (voice === null || plan === null || !plan.ok) {
        const reason: SynthReason =
          plan === null || plan.ok ? 'loading' : plan.reason
        said(`synth:${reason}`, { voice: 'synth', reason })
        return fallback.sing(ctx, notes, startAt)
      }
      said('sampler', { voice: 'sampler' })

      const master = ctx.createGain()
      master.gain.value = gain
      master.connect(roomOutput(ctx))
      const sources: { node: AudioBufferSourceNode; stopAt: number }[] = []
      let playing = plan.notes.length
      for (const note of plan.notes) {
        const source = ctx.createBufferSource()
        source.buffer = voice.buffers.get(note.sampleMidi) ?? null
        source.playbackRate.value = note.rate
        const envelope = ctx.createGain()
        envelope.gain.setValueAtTime(FLOOR, note.startAt)
        envelope.gain.exponentialRampToValueAtTime(
          note.level,
          note.startAt + OPEN,
        )
        envelope.gain.setValueAtTime(note.level, note.fadeAt)
        envelope.gain.setTargetAtTime(0, note.fadeAt, note.fadeTau)
        source.connect(envelope)
        envelope.connect(master)
        // Nothing of the call stays in the graph once it has stopped.
        source.onended = () => {
          source.disconnect()
          envelope.disconnect()
          playing -= 1
          if (playing === 0) master.disconnect()
        }
        const priming = voice.priming.get(note.sampleMidi) ?? 0
        source.start(note.startAt, note.offset + priming)
        source.stop(note.stopAt)
        sources.push({ node: source, stopAt: note.stopAt })
      }

      let stopped = false
      return {
        ...times,
        stop: () => {
          if (stopped) return
          stopped = true
          const t = ctx.currentTime
          try {
            master.gain.cancelScheduledValues(t)
            master.gain.setValueAtTime(Math.max(FLOOR, master.gain.value), t)
            master.gain.setTargetAtTime(0, t, RELEASE / 5)
          } catch {
            // Context closed mid-stop: the nodes are already dead.
          }
          for (const { node, stopAt } of sources) {
            try {
              node.stop(Math.min(stopAt, t + RELEASE + STOP_SLACK))
            } catch {
              // Already stopped.
            }
          }
        },
      }
    },
  }
}

/** A context that decodes without touching the room's audio, or none. */
function offlineDecoder(): BaseAudioContext | null {
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

const report = audioReporter('echo-voice')

const MERC_VOICE = createVoiceLoader(MERC_SAMPLES, {
  read: fetchAssetRead,
  decoder: offlineDecoder,
  report,
})

/**
 * Start loading Merc's voice set; the room calls it as the singer enters,
 * and the demo waits on it before its first call.
 */
export function preloadMercVoice(): Promise<LoadedVoice | null> {
  return MERC_VOICE.load()
}

/** Merc's calls in his own voice, the synth until it has loaded. */
export const MERC_CALL: CallVoice = samplerCall(
  MERC_VOICE.loaded,
  SYNTH_CALL,
  report,
)
