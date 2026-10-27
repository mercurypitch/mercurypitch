// ============================================================
// Home note's band — the intro's chords, Merc's home note, the resolve
// ============================================================
//
// The band is a soft organ: each chord a bass and a close triad
// (home-note-round.ts voices them), held for CHORD_SECONDS and joined to
// the next. It plays the intro, then stops so the microphone hears only
// the singer, and plays home's chord again under a landed note, or under
// Merc's answer after a miss. Everything goes through the room's output
// (room-kit room-output.ts), so leaving the room takes it off the speakers.
//
// Every chord opens and closes on the house envelope
// (.claude/memory/audio-pop-free-playback.md): an exponential opening from
// the 1e-4 floor, a setTargetAtTime close, the oscillators stopped only
// after the tail.
//
// Merc's voice comes in through a seam, RoundVoice, the shape of Echo's
// call voice: the native screen hands the room his sampled voice, and
// without one (a browser build, a test) the room sings him with the synth
// "ooh" the rooms already use (demo-audio.ts).

import { roomOutput } from '@/components/room-kit/room-output'
import { playVoiceContour } from '@/lib/demo-audio'
import { midiToFrequency } from '@/lib/frequency-to-note'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type { HomeRound, VoicedChord } from './home-note-round'
import { voiceChord } from './home-note-round'
import type { HomeNoteLevel } from './home-note-rules'
import { CHORD_SECONDS, MERC_GAP_SECONDS, MERC_HOME_SECONDS, RESOLVE_SECONDS, SOUND_LEAD_SECONDS, } from './home-note-rules'

/** A voice that sings Merc's notes: Echo's call voice has this shape. */
export interface RoundVoice {
  sing(
    ctx: AudioContext,
    notes: readonly PhraseNote[],
    startAt: number,
  ): {
    readonly onsets: readonly number[]
    readonly endAt: number
    stop(): void
  }
}

/** A scheduled sound of the room's, on the audio clock. */
export interface BandSound {
  /** When its last note has closed, audio clock seconds. */
  readonly endAt: number
  /** Stop it now, pop-free. Safe more than once. */
  stop(): void
}

/** The organ: partials 1 to 6, soft above the third. */
const ORGAN_PARTIALS = [0, 1, 0.38, 0.2, 0.1, 0.05, 0.025]
/** A triad note's held level, and the bass's. */
const TRIAD_LEVEL = 0.055
const BASS_LEVEL = 0.075
/** A chord's opening, s: a swell under the beat, not a strike. */
const OPEN = 0.06
/** The house release and the slack after it (preview-player.ts), s. */
const RELEASE = 0.18
const STOP_SLACK = 0.06
const FLOOR = 0.0001

/** Merc's synth voice: his vibrato (merc-voice-set.ts measures the set's). */
const SYNTH_VIBRATO = { hz: 5.5, cents: 14, rampSec: 0.35 }
/** The synth voice's level while he sings (demo-audio's held level). */
const SYNTH_LEVEL = 0.8

const waves = new WeakMap<AudioContext, PeriodicWave>()

function organWave(ctx: AudioContext): PeriodicWave {
  const cached = waves.get(ctx)
  if (cached !== undefined) return cached
  const imag = new Float32Array(ORGAN_PARTIALS)
  const wave = ctx.createPeriodicWave(new Float32Array(imag.length), imag)
  waves.set(ctx, wave)
  return wave
}

/** One chord from `startAt` for `seconds`. */
export function playChord(
  ctx: AudioContext,
  chord: VoicedChord,
  startAt: number,
  seconds: number,
  destination: AudioNode = roomOutput(ctx),
): BandSound {
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 2200
  filter.Q.value = 0.5
  const gain = ctx.createGain()
  const end = startAt + seconds
  gain.gain.setValueAtTime(FLOOR, startAt)
  gain.gain.exponentialRampToValueAtTime(1, startAt + OPEN)
  gain.gain.setValueAtTime(1, end)
  gain.gain.setTargetAtTime(0, end, RELEASE / 5)
  filter.connect(gain)
  gain.connect(destination)

  const stopAt = end + RELEASE + STOP_SLACK
  const parts: readonly [number, number][] = [
    [chord.bass, BASS_LEVEL],
    ...chord.triad.map((midi): [number, number] => [midi, TRIAD_LEVEL]),
  ]
  const oscillators = parts.map(([midi, level]) => {
    const osc = ctx.createOscillator()
    osc.setPeriodicWave(organWave(ctx))
    osc.frequency.value = midiToFrequency(midi)
    const part = ctx.createGain()
    part.gain.value = level
    osc.connect(part)
    part.connect(filter)
    osc.start(startAt)
    osc.stop(stopAt)
    return { osc, part }
  })
  const first = oscillators[0]
  if (first !== undefined) {
    first.osc.onended = () => {
      for (const { osc, part } of oscillators) {
        osc.disconnect()
        part.disconnect()
      }
      filter.disconnect()
      gain.disconnect()
    }
  }

  let stopped = false
  return {
    endAt: end + RELEASE,
    stop: () => {
      if (stopped) return
      stopped = true
      const now = ctx.currentTime
      try {
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(Math.max(FLOOR, gain.gain.value), now)
        gain.gain.setTargetAtTime(0, now, RELEASE / 5)
        for (const { osc } of oscillators) osc.stop(now + RELEASE + STOP_SLACK)
      } catch {
        // The context closed, or the chord had already stopped.
      }
    },
  }
}

/** Merc sung by the synth "ooh", at any pitch, exactly. */
export const SYNTH_VOICE: RoundVoice = {
  sing(ctx, notes, startAt) {
    const onsets = notes.map((note) => startAt + note.at)
    const endAt = notes.reduce(
      (latest, note) => Math.max(latest, startAt + note.at + note.seconds),
      startAt,
    )
    if (notes.length === 0) return { onsets, endAt, stop: () => undefined }
    const ref = notes[0].midi
    const points = notes.flatMap((note) => {
      const cents = (note.midi - ref) * 100
      const end = note.at + note.seconds
      return [
        { t: note.at, cents, level: SYNTH_LEVEL },
        { t: end, cents, level: SYNTH_LEVEL },
        { t: end, cents, level: 0 },
      ]
    })
    const sound = playVoiceContour(ctx, points, {
      hz: midiToFrequency(ref),
      startAt,
      destination: roomOutput(ctx),
      vibrato: SYNTH_VIBRATO,
      lowNoteOctave: true,
    })
    return { onsets, endAt, stop: () => sound.stop() }
  },
}

/** Several sounds as one. */
function together(sounds: readonly BandSound[], endAt: number): BandSound {
  return {
    endAt,
    stop: () => {
      for (const sound of sounds) sound.stop()
    },
  }
}

/**
 * The round's intro, from a moment from now: the band's chords and, where
 * the level asks, Merc singing home after them. `endAt` is when the last of
 * it has closed.
 */
export function playIntro(
  ctx: AudioContext,
  round: HomeRound,
  level: HomeNoteLevel,
  voice: RoundVoice,
): BandSound {
  const start = ctx.currentTime + SOUND_LEAD_SECONDS
  const sounds: BandSound[] = level.intro.map((chord, i) =>
    playChord(
      ctx,
      voiceChord(round.home, chord),
      start + i * CHORD_SECONDS,
      CHORD_SECONDS,
    ),
  )
  let endAt = sounds.reduce((latest, sound) => Math.max(latest, sound.endAt), 0)
  if (level.mercSingsHome) {
    const at = start + level.intro.length * CHORD_SECONDS + MERC_GAP_SECONDS
    const merc = voice.sing(
      ctx,
      [{ midi: round.home, at: 0, seconds: MERC_HOME_SECONDS }],
      at,
    )
    sounds.push({ endAt: merc.endAt + RELEASE, stop: () => merc.stop() })
    endAt = Math.max(endAt, merc.endAt + RELEASE)
  }
  return together(sounds, endAt)
}

/**
 * Home's chord under the singer's landed note, or, after a miss, under
 * Merc singing home: the answer, heard in its key.
 */
export function playResolve(
  ctx: AudioContext,
  round: HomeRound,
  answer: RoundVoice | null,
): BandSound {
  const start = ctx.currentTime + SOUND_LEAD_SECONDS
  const chord = playChord(
    ctx,
    voiceChord(round.home, 'I'),
    start,
    RESOLVE_SECONDS,
  )
  if (answer === null) return chord
  const merc = answer.sing(
    ctx,
    [{ midi: round.home, at: 0, seconds: MERC_HOME_SECONDS }],
    start + 0.12,
  )
  return together(
    [chord, { endAt: merc.endAt + RELEASE, stop: () => merc.stop() }],
    Math.max(chord.endAt, merc.endAt + RELEASE),
  )
}

/** How far the speaker is behind the audio clock, s. */
export function outputLatency(ctx: AudioContext): number {
  const out = ctx.outputLatency
  if (Number.isFinite(out) && out > 0) return out
  const base = ctx.baseLatency
  return Number.isFinite(base) && base > 0 ? base : 0
}
